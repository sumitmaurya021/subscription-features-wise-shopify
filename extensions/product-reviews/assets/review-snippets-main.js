(function () {
  const ROOT_SELECTOR = ".rsn-root";
  const instances = new WeakMap();

  function getRoots(scope) {
    if (!scope) return [];

    const roots = [];

    if (
      scope.nodeType === 1 &&
      typeof scope.matches === "function" &&
      scope.matches(ROOT_SELECTOR)
    ) {
      roots.push(scope);
    }

    if (typeof scope.querySelectorAll === "function") {
      roots.push(...Array.from(scope.querySelectorAll(ROOT_SELECTOR)));
    }

    return roots;
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeWhitespace(value) {
    return safeText(value).replace(/\s+/g, " ").trim();
  }

  function toBoolean(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value) === "true";
  }

  function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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

  function getShopifyRoot() {
    const root = window.Shopify?.routes?.root || "/";
    return root.endsWith("/") ? root : `${root}/`;
  }

  function isDesignMode() {
    return Boolean(window.Shopify && Shopify.designMode);
  }

  function buildSignature(settings) {
    return JSON.stringify(settings);
  }

  function extractSettings(root) {
    return {
      shop: safeText(root.dataset.shop),
      endpoint: safeText(root.dataset.endpoint || "/apps/reviews"),
      reviewSelection: safeText(root.dataset.reviewSelection || "current_product"),
      reviewType: safeText(root.dataset.reviewType || "product").toLowerCase(),
      targetId: safeText(root.dataset.targetId),
      targetHandle: safeText(root.dataset.targetHandle),
      targetTitle: safeText(root.dataset.targetTitle),
      contextImage: safeText(root.dataset.contextImage),
      minRating: safeText(root.dataset.minRating),
      maxReviews: Math.max(1, toNumber(root.dataset.maxReviews, 8)),
      showArrows: toBoolean(root.dataset.showArrows, true),
      autoplay: toBoolean(root.dataset.autoplay, true),
      autoplaySpeed: Math.max(2, toNumber(root.dataset.autoplaySpeed, 5)),
      pauseOnHover: toBoolean(root.dataset.pauseOnHover, true),
      showReviewerName: toBoolean(root.dataset.showReviewerName, true),
      showVerifiedBadge: toBoolean(root.dataset.showVerifiedBadge, false),
      excerptLength: Math.max(40, toNumber(root.dataset.excerptLength, 140)),
      emptyText: safeText(root.dataset.emptyText || "No reviews available right now."),
      shadowStrength: safeText(root.dataset.shadowStrength || "medium"),
      showAddToCart: toBoolean(root.dataset.showAddToCart, false),
      addToCartLabel: safeText(root.dataset.addToCartLabel || "Add to cart"),
      addToCartVariantId: safeText(root.dataset.addToCartVariantId),
      redirectToCart: toBoolean(root.dataset.redirectToCart, true),
    };
  }

  function applyRootStyles(root, settings) {
    root.style.setProperty("--rsn-card-shadow", getShadowValue(settings.shadowStrength));
  }

  function setLoadingState(root, isLoading) {
    if (!root) return;
    root.classList.toggle("is-loading", Boolean(isLoading));
    root.setAttribute("aria-busy", isLoading ? "true" : "false");
  }

  function getSampleReviews(targetTitle) {
    const cleanTarget = targetTitle || "this item";
    return [
      {
        id: "sample-1",
        customerName: "Darlene Robertson",
        rating: 5,
        title: "Amazing quality",
        message: `The ${cleanTarget} feels premium, works exactly as expected, and arrived in excellent condition. I would definitely buy again.`,
        isPinned: true,
        isVerified: true,
        status: "approved",
        createdAt: "2026-03-01T10:00:00Z",
      },
      {
        id: "sample-2",
        customerName: "Esther Howard",
        rating: 5,
        title: "Worth every penny",
        message: `Really happy with ${cleanTarget}. The experience was smooth from ordering to delivery, and the product quality is genuinely impressive.`,
        isPinned: false,
        isVerified: true,
        status: "approved",
        createdAt: "2026-02-20T10:00:00Z",
      },
      {
        id: "sample-3",
        customerName: "Kristin Watson",
        rating: 4,
        title: "Looks beautiful",
        message: `The finish, feel, and overall presentation of ${cleanTarget} are very good. It blends nicely with the rest of my setup.`,
        isPinned: false,
        isVerified: true,
        status: "approved",
        createdAt: "2026-02-10T10:00:00Z",
      },
    ];
  }

  function normalizeReview(review) {
    const createdAt = safeText(review?.createdAt || review?.updatedAt || "");
    const createdAtTs = createdAt ? Date.parse(createdAt) : 0;

    return {
      id: safeText(review?.id || ""),
      customerName: normalizeWhitespace(review?.customerName || "Anonymous"),
      rating: Math.max(1, Math.min(5, Number(review?.rating) || 0)),
      title: normalizeWhitespace(review?.title || ""),
      message: normalizeWhitespace(review?.message || ""),
      isPinned: Boolean(review?.isPinned),
      isVerified: review?.isVerified === false || review?.verified === false ? false : true,
      status: safeText(review?.status || "approved"),
      createdAt,
      createdAtTs: Number.isFinite(createdAtTs) ? createdAtTs : 0,
    };
  }

  function sortReviews(reviews) {
    return [...reviews].sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      if ((b.createdAtTs || 0) !== (a.createdAtTs || 0)) {
        return (b.createdAtTs || 0) - (a.createdAtTs || 0);
      }
      return (b.rating || 0) - (a.rating || 0);
    });
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
    setLoadingState(root, false);
  }

  function showInlineNotice(instance, message, type) {
    const notice = instance.elements.notice;
    if (!notice) return;

    notice.hidden = false;
    notice.textContent = message;
    notice.classList.remove("is-success", "is-error");
    notice.classList.add(type === "error" ? "is-error" : "is-success");

    if (instance.state.noticeTimer) {
      clearTimeout(instance.state.noticeTimer);
      instance.state.noticeTimer = null;
    }

    instance.state.noticeTimer = window.setTimeout(() => {
      if (!instance.elements.notice) return;
      instance.elements.notice.hidden = true;
      instance.elements.notice.textContent = "";
      instance.elements.notice.classList.remove("is-success", "is-error");
    }, 2500);
  }

  async function addVariantToCart(variantId, quantity) {
    const response = await fetch(`${getShopifyRoot()}cart/add.js`, {
      method: "POST",
      credentials: "same-origin",
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
    const showButtons = settings.showArrows;
    const prevButton = showButtons
      ? `<button type="button" class="rsn-nav rsn-nav--prev" aria-label="Previous review">‹</button>`
      : "";
    const nextButton = showButtons
      ? `<button type="button" class="rsn-nav rsn-nav--next" aria-label="Next review">›</button>`
      : "";

    const addToCartMarkup =
      settings.showAddToCart && settings.addToCartVariantId
        ? `
          <div class="rsn-actions">
            <button type="button" class="rsn-add-to-cart-btn" data-rsn-add-to-cart>
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
            <div class="rsn-card${showButtons ? " has-nav-space" : ""}">
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
                    This product looks amazing and feels very premium. Highly recommended.
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

    if (settings.shop) params.set("shop", settings.shop);
    params.set("approvedOnly", "true");

    if (settings.maxReviews > 0) {
      params.set("limit", String(settings.maxReviews));
    }

    if (settings.minRating) {
      params.set("minRating", String(settings.minRating));
    }

    if (settings.reviewType === "product") {
      params.set("reviewType", "product");
      if (settings.targetId) {
        params.set("targetId", settings.targetId);
        params.set("productId", settings.targetId);
      }
      if (settings.targetHandle) {
        params.set("targetHandle", settings.targetHandle);
      }
    } else if (settings.reviewType === "collection") {
      params.set("reviewType", "collection");
      if (settings.targetId) {
        params.set("targetId", settings.targetId);
        params.set("collectionId", settings.targetId);
      }
      if (settings.targetHandle) {
        params.set("targetHandle", settings.targetHandle);
        params.set("collectionHandle", settings.targetHandle);
      }
    } else {
      params.set("reviewType", "store");
    }

    return `${settings.endpoint}?${params.toString()}`;
  }

  async function fetchReviews(settings, signal) {
    const response = await fetch(buildReviewsUrl(settings), {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    let result = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Failed to fetch reviews");
    }

    const reviews = Array.isArray(result?.data) ? result.data.map(normalizeReview) : [];
    return sortReviews(reviews).slice(0, settings.maxReviews);
  }

  function stopAutoplay(instance) {
    if (instance.state.autoplayTimer) {
      clearInterval(instance.state.autoplayTimer);
      instance.state.autoplayTimer = null;
    }
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

  function updateNavState(instance) {
    const total = (instance.state.reviews || []).length;
    const canNavigate = total > 1 && instance.settings.showArrows;

    if (instance.elements.prevButton) {
      instance.elements.prevButton.hidden = !canNavigate;
    }

    if (instance.elements.nextButton) {
      instance.elements.nextButton.hidden = !canNavigate;
    }

    if (instance.elements.card) {
      instance.elements.card.classList.toggle("has-nav-space", canNavigate);
    }
  }

  function updateCard(instance) {
    const reviews = instance.state.reviews || [];
    const activeReview = reviews[instance.state.currentIndex];
    if (!activeReview) return;

    instance.elements.stars.textContent = renderStars(activeReview.rating);

    if (instance.settings.showReviewerName) {
      instance.elements.author.hidden = false;
      instance.elements.author.textContent = activeReview.customerName || "Anonymous";
    } else {
      instance.elements.author.hidden = true;
      instance.elements.author.textContent = "";
    }

    if (instance.elements.verified) {
      const shouldShowVerified =
        instance.settings.showVerifiedBadge && activeReview.isVerified !== false;
      instance.elements.verified.hidden = !shouldShowVerified;
    }

    instance.elements.message.textContent = truncateText(
      activeReview.message || activeReview.title || "",
      instance.settings.excerptLength
    );

    if (instance.elements.addToCartButton) {
      const canShowCartButton =
        instance.settings.showAddToCart && Boolean(instance.settings.addToCartVariantId);
      instance.elements.addToCartButton.hidden = !canShowCartButton;
      instance.elements.addToCartButton.disabled = false;
      instance.elements.addToCartButton.classList.remove("is-loading");
      instance.elements.addToCartButton.textContent = instance.settings.addToCartLabel;
    }

    updateNavState(instance);

    if (instance.elements.card) {
      instance.elements.card.classList.remove("is-animating");
      requestAnimationFrame(() => {
        if (instance.elements.card) {
          instance.elements.card.classList.add("is-animating");
        }
      });
    }
  }

  function goTo(instance, nextIndex) {
    const total = (instance.state.reviews || []).length;
    if (!total) return;

    let finalIndex = nextIndex;
    if (finalIndex < 0) finalIndex = total - 1;
    if (finalIndex >= total) finalIndex = 0;

    instance.state.currentIndex = finalIndex;
    updateCard(instance);
  }

  function bindEvents(instance) {
    const { root, elements } = instance;

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

    root.addEventListener("keydown", (event) => {
      if ((instance.state.reviews || []).length <= 1) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(instance, instance.state.currentIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(instance, instance.state.currentIndex + 1);
      }
    });

    if (elements.addToCartButton) {
      elements.addToCartButton.addEventListener("click", async () => {
        const variantId = instance.settings.addToCartVariantId;
        if (!variantId) return;

        const button = elements.addToCartButton;
        const originalLabel = instance.settings.addToCartLabel || "Add to cart";

        try {
          button.disabled = true;
          button.classList.add("is-loading");
          button.textContent = "Adding...";

          await addVariantToCart(variantId, 1);

          if (instance.settings.redirectToCart) {
            window.location.href = `${getShopifyRoot()}cart`;
            return;
          }

          button.textContent = "Added";
          showInlineNotice(instance, "Product added to cart.", "success");

          window.setTimeout(() => {
            if (!button) return;
            button.disabled = false;
            button.classList.remove("is-loading");
            button.textContent = originalLabel;
          }, 1200);
        } catch (error) {
          button.disabled = false;
          button.classList.remove("is-loading");
          button.textContent = originalLabel;
          showInlineNotice(
            instance,
            error?.message || "Unable to add product to cart.",
            "error"
          );
        }
      });
    }
  }

  function createInstance(root, settings) {
    root.innerHTML = buildWidgetMarkup(settings);
    setLoadingState(root, false);
    root.tabIndex = 0;

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

  function abortPendingRequest(root) {
    if (root && root.__rsnPendingController) {
      try {
        root.__rsnPendingController.abort();
      } catch {}
    }

    if (root) {
      root.__rsnPendingController = null;
      root.__rsnPendingSignature = null;
    }
  }

  function destroyRoot(root) {
    abortPendingRequest(root);

    const instance = instances.get(root);
    if (!instance) return;

    stopAutoplay(instance);

    if (instance.state.noticeTimer) {
      clearTimeout(instance.state.noticeTimer);
      instance.state.noticeTimer = null;
    }

    instances.delete(root);
  }

  async function initRoot(root, options) {
    if (!root) return;

    const force = Boolean(options && options.force);
    const settings = extractSettings(root);
    const signature = buildSignature(settings);

    if (!force) {
      if (root.__rsnPendingSignature === signature) return;
      if (root.dataset.rsnInitKey === signature && instances.has(root)) return;
    }

    destroyRoot(root);

    root.dataset.rsnInitKey = signature;
    root.__rsnPendingSignature = signature;

    applyRootStyles(root, settings);
    setLoadingState(root, true);
    root.innerHTML = "";

    const controller = new AbortController();
    root.__rsnPendingController = controller;

    try {
      let reviews = await fetchReviews(settings, controller.signal);

      if (!reviews.length && isDesignMode()) {
        reviews = getSampleReviews(settings.targetTitle).map(normalizeReview);
      }

      if (root.__rsnPendingController !== controller) {
        return;
      }

      root.__rsnPendingController = null;
      root.__rsnPendingSignature = null;

      if (!reviews.length) {
        renderEmpty(root, settings);
        return;
      }

      const instance = createInstance(root, settings);
      instance.state.reviews = reviews;
      instance.state.currentIndex = 0;
      updateCard(instance);
      startAutoplay(instance);
    } catch (error) {
      if (error?.name === "AbortError") {
        if (root.__rsnPendingController === controller) {
          root.__rsnPendingController = null;
          root.__rsnPendingSignature = null;
        }
        return;
      }

      if (root.__rsnPendingController === controller) {
        root.__rsnPendingController = null;
        root.__rsnPendingSignature = null;
      }

      if (isDesignMode()) {
        const instance = createInstance(root, settings);
        instance.state.reviews = getSampleReviews(settings.targetTitle).map(normalizeReview);
        instance.state.currentIndex = 0;
        updateCard(instance);
        startAutoplay(instance);
        return;
      }

      renderEmpty(root, settings);
    }
  }

  function initAll(scope = document, options) {
    const roots = getRoots(scope);
    roots.forEach((root) => initRoot(root, options));
  }

  function destroyAll(scope = document) {
    const roots = getRoots(scope);
    roots.forEach((root) => destroyRoot(root));
  }

  window.ReviewSnippetsMain = {
    initAll,
    initRoot,
    destroyAll,
  };
})();
