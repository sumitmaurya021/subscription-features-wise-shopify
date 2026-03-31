(function () {
  const ROOT_SELECTOR = ".rsn-root";
  const instances = new WeakMap();

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function toBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value) === "true";
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeWhitespace(value) {
    return safeText(value).replace(/\s+/g, " ").trim();
  }

  function truncateText(value, limit) {
    const text = normalizeWhitespace(value);
    const max = Math.max(20, Number(limit) || 140);

    if (!text) return "";
    if (text.length <= max) return text;

    return `${text.slice(0, max).trim()}…`;
  }

  function renderStars(rating) {
    const safeRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
  }

  function getShadowValue(strength) {
    if (strength === "strong") return "0 22px 50px rgba(0, 0, 0, 0.16)";
    if (strength === "soft") return "0 10px 24px rgba(0, 0, 0, 0.06)";
    return "0 16px 40px rgba(0, 0, 0, 0.10)";
  }

  function getSampleReviews(targetTitle) {
    const cleanTarget = targetTitle || "this product";

    return [
      {
        id: "sample-1",
        customerName: "Darlene Robertson",
        rating: 5,
        title: "Amazing purchase",
        message: `The ${cleanTarget} is incredibly convenient for everyday use, and the quality feels much better than expected. Highly recommended.`,
        isPinned: true,
        status: "approved",
      },
      {
        id: "sample-2",
        customerName: "Esther Howard",
        rating: 5,
        title: "Worth it",
        message: `I loved the finish and overall quality of ${cleanTarget}. Delivery was quick and everything arrived in perfect condition.`,
        isPinned: false,
        status: "approved",
      },
      {
        id: "sample-3",
        customerName: "Kristin Watson",
        rating: 4,
        title: "Looks beautiful",
        message: `Really happy with ${cleanTarget}. It looks premium, works well, and matches exactly what I was expecting from the store.`,
        isPinned: false,
        status: "approved",
      },
    ];
  }

  function getShopifyRoot() {
    const root = window.Shopify?.routes?.root || "/";
    return root.endsWith("/") ? root : `${root}/`;
  }

  function showInlineNotice(instance, message, type = "success") {
    const notice = instance.elements.notice;
    if (!notice) return;

    notice.hidden = false;
    notice.textContent = message;
    notice.classList.remove("is-success", "is-error");
    notice.classList.add(type === "error" ? "is-error" : "is-success");

    clearTimeout(instance.state.noticeTimer);
    instance.state.noticeTimer = window.setTimeout(() => {
      if (notice) {
        notice.hidden = true;
        notice.textContent = "";
        notice.classList.remove("is-success", "is-error");
      }
    }, 2500);
  }

  async function addVariantToCart(variantId, quantity = 1) {
    const root = getShopifyRoot();

    const response = await fetch(`${root}cart/add.js`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        id: Number(variantId),
        quantity: Number(quantity) || 1,
      }),
    });

    let result = null;

    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(result?.description || result?.message || "Failed to add product to cart");
    }

    return result;
  }

  function buildWidgetMarkup(settings) {
    const prevButton = settings.showArrows
      ? `
        <button
          type="button"
          class="rsn-nav rsn-nav--prev"
          aria-label="Previous review"
        >
          ‹
        </button>
      `
      : "";

    const nextButton = settings.showArrows
      ? `
        <button
          type="button"
          class="rsn-nav rsn-nav--next"
          aria-label="Next review"
        >
          ›
        </button>
      `
      : "";

    const addToCartMarkup =
      settings.showAddToCart && settings.addToCartVariantId
        ? `
          <div class="rsn-actions">
            <button
              type="button"
              class="rsn-add-to-cart-btn"
              data-rsn-add-to-cart
            >
              ${escapeHtml(settings.addToCartLabel)}
            </button>
            <div class="rsn-inline-notice" data-rsn-inline-notice hidden></div>
          </div>
        `
        : "";

    return `
      <div class="rsn-shell">
        <div class="rsn-slider" aria-live="polite">
          ${prevButton}

          <div class="rsn-card-wrap">
            <div class="rsn-card">
              <div class="rsn-card-inner">
                <div class="rsn-head">
                  <div class="rsn-stars" data-rsn-stars>★★★★★</div>
                  <div class="rsn-author-wrap">
                    <div class="rsn-author" data-rsn-author>Darlene Robertson</div>
                    ${
                      settings.showVerifiedBadge
                        ? `<span class="rsn-verified-badge" data-rsn-verified hidden>Verified buyer</span>`
                        : ""
                    }
                  </div>
                </div>

                <div class="rsn-body">
                  <p class="rsn-message" data-rsn-message>
                    The USB smoothie blender is incredibly convenient for on-the-go use, blending fruits and veggies effortlessly in seconds….
                  </p>
                </div>

                ${addToCartMarkup}
              </div>
            </div>
          </div>

          ${nextButton}
        </div>
      </div>
    `;
  }

  function buildReviewsUrl(settings) {
    const params = new URLSearchParams();

    params.set("shop", settings.shop);
    params.set("approvedOnly", "true");
    params.set("reviewType", settings.reviewType);

    if (settings.maxReviews > 0) {
      params.set("limit", String(settings.maxReviews));
    }

    if (settings.minRating) {
      params.set("minRating", String(settings.minRating));
    }

    if (settings.reviewType === "product") {
      if (settings.targetId) {
        params.set("targetId", settings.targetId);
      }
    } else if (settings.reviewType === "collection") {
      if (settings.targetId) {
        params.set("targetId", settings.targetId);
      }
      if (settings.targetHandle) {
        params.set("targetHandle", settings.targetHandle);
      }
    }

    return `${settings.endpoint}?${params.toString()}`;
  }

  function normalizeReview(review) {
    return {
      id: safeText(review?.id || ""),
      customerName: normalizeWhitespace(review?.customerName || "Anonymous"),
      rating: Math.max(1, Math.min(5, Number(review?.rating) || 0)),
      title: normalizeWhitespace(review?.title || ""),
      message: normalizeWhitespace(review?.message || ""),
      isPinned: Boolean(review?.isPinned),
      status: safeText(review?.status || "approved"),
    };
  }

  function sortReviews(reviews) {
    return [...reviews].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return 0;
    });
  }

  function renderLoading(root) {
    root.innerHTML = `
      <div class="rsn-shell">
        <div class="rsn-slider">
          <div class="rsn-card-wrap">
            <div class="rsn-card rsn-card--loading">
              <div class="rsn-skeleton rsn-skeleton--stars"></div>
              <div class="rsn-skeleton rsn-skeleton--name"></div>
              <div class="rsn-skeleton rsn-skeleton--line"></div>
              <div class="rsn-skeleton rsn-skeleton--line rsn-skeleton--line-short"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderEmpty(root, settings) {
    root.innerHTML = `
      <div class="rsn-shell">
        <div class="rsn-slider">
          <div class="rsn-card-wrap">
            <div class="rsn-card rsn-card--empty">
              <div class="rsn-card-inner">
                <p class="rsn-empty-text">${escapeHtml(settings.emptyText)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function updateCard(instance) {
    const { state, elements, settings } = instance;
    const reviews = state.reviews || [];
    const activeReview = reviews[state.currentIndex];

    if (!activeReview) return;

    elements.stars.textContent = renderStars(activeReview.rating);

    if (settings.showReviewerName) {
      elements.author.textContent = activeReview.customerName || "Anonymous";
      elements.author.hidden = false;
    } else {
      elements.author.textContent = "";
      elements.author.hidden = true;
    }

    if (elements.verified) {
      elements.verified.hidden = !settings.showVerifiedBadge;
    }

    elements.message.textContent = truncateText(
      activeReview.message || activeReview.title || "",
      settings.excerptLength
    );

    if (elements.prevButton) {
      elements.prevButton.hidden = reviews.length <= 1;
    }

    if (elements.nextButton) {
      elements.nextButton.hidden = reviews.length <= 1;
    }

    if (elements.addToCartButton) {
      elements.addToCartButton.hidden = !(
        settings.showAddToCart && settings.addToCartVariantId
      );
      elements.addToCartButton.textContent = settings.addToCartLabel;
      elements.addToCartButton.disabled = false;
      elements.addToCartButton.classList.remove("is-loading");
    }

    if (elements.card) {
      elements.card.classList.remove("is-animating");
      requestAnimationFrame(() => {
        elements.card.classList.add("is-animating");
      });
    }
  }

  function goTo(instance, nextIndex) {
    const total = instance.state.reviews.length;
    if (!total) return;

    let finalIndex = nextIndex;

    if (finalIndex < 0) {
      finalIndex = total - 1;
    } else if (finalIndex >= total) {
      finalIndex = 0;
    }

    instance.state.currentIndex = finalIndex;
    updateCard(instance);
  }

  function startAutoplay(instance) {
    stopAutoplay(instance);

    if (!instance.settings.autoplay) return;
    if ((instance.state.reviews || []).length <= 1) return;

    instance.state.autoplayTimer = window.setInterval(() => {
      if (instance.state.isHovered && instance.settings.pauseOnHover) return;
      goTo(instance, instance.state.currentIndex + 1);
    }, Math.max(2000, instance.settings.autoplaySpeed * 1000));
  }

  function stopAutoplay(instance) {
    if (instance.state.autoplayTimer) {
      clearInterval(instance.state.autoplayTimer);
      instance.state.autoplayTimer = null;
    }
  }

  function bindEvents(instance) {
    const { elements } = instance;

    if (elements.prevButton) {
      elements.prevButton.addEventListener("click", () => {
        goTo(instance, instance.state.currentIndex - 1);
      });
    }

    if (elements.nextButton) {
      elements.nextButton.addEventListener("click", () => {
        goTo(instance, instance.state.currentIndex + 1);
      });
    }

    if (elements.shell) {
      elements.shell.addEventListener("mouseenter", () => {
        instance.state.isHovered = true;
      });

      elements.shell.addEventListener("mouseleave", () => {
        instance.state.isHovered = false;
      });
    }

    if (elements.addToCartButton) {
      elements.addToCartButton.addEventListener("click", async () => {
        const variantId = instance.settings.addToCartVariantId;
        if (!variantId) return;

        const originalLabel = instance.settings.addToCartLabel || "Add to cart";

        try {
          elements.addToCartButton.disabled = true;
          elements.addToCartButton.classList.add("is-loading");
          elements.addToCartButton.textContent = "Adding...";

          await addVariantToCart(variantId, 1);

          if (instance.settings.redirectToCart) {
            window.location.href = `${getShopifyRoot()}cart`;
            return;
          }

          elements.addToCartButton.textContent = "Added";
          showInlineNotice(instance, "Product added to cart.", "success");

          window.setTimeout(() => {
            if (elements.addToCartButton) {
              elements.addToCartButton.disabled = false;
              elements.addToCartButton.classList.remove("is-loading");
              elements.addToCartButton.textContent = originalLabel;
            }
          }, 1200);
        } catch (error) {
          elements.addToCartButton.disabled = false;
          elements.addToCartButton.classList.remove("is-loading");
          elements.addToCartButton.textContent = originalLabel;
          showInlineNotice(
            instance,
            error?.message || "Unable to add product to cart.",
            "error"
          );
        }
      });
    }
  }

  async function fetchReviews(settings) {
    const response = await fetch(buildReviewsUrl(settings), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Failed to fetch reviews");
    }

    const reviews = Array.isArray(result?.data) ? result.data.map(normalizeReview) : [];
    return sortReviews(reviews);
  }

  function createInstance(root) {
    const settings = {
      shop: safeText(root.dataset.shop),
      endpoint: safeText(root.dataset.endpoint || "/apps/reviews"),
      reviewType: safeText(root.dataset.reviewType || "product").toLowerCase(),
      targetId: safeText(root.dataset.targetId),
      targetHandle: safeText(root.dataset.targetHandle),
      targetTitle: safeText(root.dataset.targetTitle),
      minRating: safeText(root.dataset.minRating),
      maxReviews: toNumber(root.dataset.maxReviews, 8),
      showArrows: toBoolean(root.dataset.showArrows, true),
      autoplay: toBoolean(root.dataset.autoplay, true),
      autoplaySpeed: toNumber(root.dataset.autoplaySpeed, 5),
      pauseOnHover: toBoolean(root.dataset.pauseOnHover, true),
      showReviewerName: toBoolean(root.dataset.showReviewerName, true),
      showVerifiedBadge: toBoolean(root.dataset.showVerifiedBadge, false),
      excerptLength: toNumber(root.dataset.excerptLength, 140),
      emptyText: safeText(root.dataset.emptyText || "No reviews available right now."),
      shadowStrength: safeText(root.dataset.shadowStrength || "medium"),
      showAddToCart: toBoolean(root.dataset.showAddToCart, false),
      addToCartLabel: safeText(root.dataset.addToCartLabel || "Add to cart"),
      addToCartVariantId: safeText(root.dataset.addToCartVariantId),
      redirectToCart: toBoolean(root.dataset.redirectToCart, true),
    };

    root.style.setProperty("--rsn-card-shadow", getShadowValue(settings.shadowStrength));
    root.innerHTML = buildWidgetMarkup(settings);

    const instance = {
      root,
      settings,
      state: {
        reviews: [],
        currentIndex: 0,
        autoplayTimer: null,
        isHovered: false,
        noticeTimer: null,
      },
      elements: {
        shell: root.querySelector(".rsn-shell"),
        card: root.querySelector(".rsn-card"),
        stars: root.querySelector("[data-rsn-stars]"),
        author: root.querySelector("[data-rsn-author]"),
        verified: root.querySelector("[data-rsn-verified]"),
        message: root.querySelector("[data-rsn-message]"),
        prevButton: root.querySelector(".rsn-nav--prev"),
        nextButton: root.querySelector(".rsn-nav--next"),
        addToCartButton: root.querySelector("[data-rsn-add-to-cart]"),
        notice: root.querySelector("[data-rsn-inline-notice]"),
      },
    };

    bindEvents(instance);
    instances.set(root, instance);

    return instance;
  }

  async function initRoot(root) {
    if (!root) return;

    if (root.dataset.rsnInitialized === "true") {
      return;
    }

    root.dataset.rsnInitialized = "true";
    renderLoading(root);

    const instance = createInstance(root);

    try {
      let reviews = await fetchReviews(instance.settings);

      if (!reviews.length && window.Shopify && Shopify.designMode) {
        reviews = getSampleReviews(instance.settings.targetTitle).map(normalizeReview);
      }

      if (!reviews.length) {
        renderEmpty(root, instance.settings);
        return;
      }

      instance.state.reviews = reviews;
      instance.state.currentIndex = 0;
      updateCard(instance);
      startAutoplay(instance);
    } catch (error) {
      if (window.Shopify && Shopify.designMode) {
        instance.state.reviews = getSampleReviews(instance.settings.targetTitle).map(normalizeReview);
        instance.state.currentIndex = 0;
        updateCard(instance);
        startAutoplay(instance);
        return;
      }

      renderEmpty(root, instance.settings);
    }
  }

  function initAll(scope = document) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));
    roots.forEach(initRoot);
  }

  window.ReviewSnippetsMain = {
    initAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener("shopify:section:load", function (event) {
    initAll(event.target || document);
  });
})();
