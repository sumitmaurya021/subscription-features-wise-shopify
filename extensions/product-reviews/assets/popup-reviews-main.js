(function (window, document) {
  if (window.PopupReviewsApp) return;

  const ENTER_ANIMATION_MS = 500;
  const EXIT_ANIMATION_MS = 340;
  const DEFAULT_FETCH_LIMIT = 120;

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function safeLower(value) {
    return safeText(value).trim().toLowerCase();
  }

  function parseBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value).toLowerCase() === "true";
  }

  function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function normalizeId(value) {
    const text = safeText(value).trim();
    if (!text) return "";
    return text.replace(/[^\d]/g, "") || text;
  }

  function normalizeHandle(value) {
    return safeText(value).trim().toLowerCase();
  }

  function parsePossibleList(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => safeText(item).trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function parseDateValue(dateValue) {
    if (!dateValue) return 0;

    const parsedValue =
      typeof dateValue === "string" && /^\d+$/.test(dateValue)
        ? Number(dateValue)
        : dateValue;

    const date = new Date(parsedValue);
    const time = date.getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function shuffleArray(items) {
    const arr = items.slice();

    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }

    return arr;
  }

  function renderStarsText(rating) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const rounded = Math.round(safeRating);
    return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
  }

  function forceReflow(element) {
    if (!element) return;
    void element.offsetWidth;
  }

  function getReviewId(review) {
    return safeText(review.id || review._id || review.reviewId || review.review_id);
  }

  function getReviewType(review) {
    const type = safeLower(
      review.reviewType || review.review_type || review.type || ""
    );

    if (type === "store" || type === "store_review" || type === "store reviews") {
      return "store";
    }

    return "product";
  }

  function getRatingValue(review) {
    const rating = Number(review.rating) || 0;
    return Math.max(0, Math.min(5, rating));
  }

  function isApproved(review) {
    const rawStatus = safeLower(review.status || "");
    if (!rawStatus) return true;
    return rawStatus === "approved";
  }

  function isFeatured(review) {
    return Boolean(
      review.isPinned ||
        review.pinned ||
        review.featured ||
        review.isFeatured
    );
  }

  function isVerified(review) {
    return Boolean(
      review.isVerified ||
        review.verified ||
        review.verifiedBuyer ||
        review.verified_reviewer ||
        review.verifiedReviewer
    );
  }

  function getProductId(review) {
    return normalizeId(
      review.productId ||
        review.product_id ||
        review.product?.id ||
        ""
    );
  }

  function getProductHandle(review) {
    return normalizeHandle(
      review.productHandle ||
        review.product_handle ||
        review.product?.handle ||
        ""
    );
  }

  function getCollectionIds(review) {
    const base = [
      review.collectionId,
      review.collection_id,
      review.collection?.id,
    ]
      .map((item) => normalizeId(item))
      .filter(Boolean);

    return [
      ...base,
      ...parsePossibleList(review.collectionIds).map(normalizeId),
      ...parsePossibleList(review.collection_ids).map(normalizeId),
    ].filter(Boolean);
  }

  function getCollectionHandles(review) {
    const base = [
      review.collectionHandle,
      review.collection_handle,
      review.collection?.handle,
    ]
      .map((item) => normalizeHandle(item))
      .filter(Boolean);

    return [
      ...base,
      ...parsePossibleList(review.collectionHandles).map(normalizeHandle),
      ...parsePossibleList(review.collection_handles).map(normalizeHandle),
    ].filter(Boolean);
  }

  function getReviewMessage(review) {
    return safeText(review.message || review.review || review.content || "").trim();
  }

  function getCustomerName(review) {
    const name = safeText(
      review.customerName ||
        review.customer_name ||
        review.name ||
        ""
    ).trim();

    return name || "Anonymous";
  }

  function getDisplayTitle(review) {
    const title = safeText(
      review.productTitle ||
        review.product_title ||
        review.product?.title ||
        ""
    ).trim();

    if (title) return title;
    if (getReviewType(review) === "store") return "Store review";
    return "";
  }

  function getImageUrl(review) {
    const directCandidates = [
      review.reviewImage,
      review.review_image,
      review.image,
      review.imageUrl,
      review.image_url,
      review.productImage,
      review.product_image,
      review.product?.image,
      review.product?.imageUrl,
      review.product?.featuredImage,
    ]
      .map((item) => safeText(item).trim())
      .filter(Boolean);

    if (directCandidates.length) return directCandidates[0];

    const arraysToCheck = [
      review.reviewImages,
      review.review_images,
      review.images,
      review.media,
    ];

    for (const item of arraysToCheck) {
      if (Array.isArray(item) && item.length) {
        const first = item[0];

        if (typeof first === "string" && first.trim()) {
          return first.trim();
        }

        if (first && typeof first === "object") {
          const objectUrl = safeText(
            first.url || first.src || first.secure_url || first.image
          ).trim();

          if (objectUrl) return objectUrl;
        }
      }
    }

    return "";
  }

  function getConfig(root) {
    return {
      endpoint: safeText(root.dataset.endpoint),
      shop: safeText(root.dataset.shop),
      reviewSource: safeLower(root.dataset.reviewSource || "store_reviews"),
      maxReviews: Math.max(1, parseNumber(root.dataset.maxReviews, 20)),
      popupDelayMs: Math.max(1000, parseNumber(root.dataset.popupDelay, 8) * 1000),
      popupRepeatIntervalMs: Math.max(
        3000,
        parseNumber(root.dataset.popupRepeatInterval, 45) * 1000
      ),
      popupAutoCloseMs: Math.max(
        2000,
        parseNumber(root.dataset.popupAutoClose, 10) * 1000
      ),
      showProductName: parseBoolean(root.dataset.showProductName, true),
      showReviewImage: parseBoolean(root.dataset.showReviewImage, true),
      showVerifiedBadge: parseBoolean(root.dataset.showVerifiedBadge, true),
      pauseOnHover: parseBoolean(root.dataset.pauseOnHover, true),
      currentProductId: normalizeId(root.dataset.currentProductId || ""),
      currentProductHandle: normalizeHandle(root.dataset.currentProductHandle || ""),
      currentCollectionId: normalizeId(root.dataset.currentCollectionId || ""),
      currentCollectionHandle: normalizeHandle(
        root.dataset.currentCollectionHandle || ""
      ),
    };
  }

  function matchesCurrentProduct(review, config) {
    if (!config.currentProductId && !config.currentProductHandle) return false;

    const reviewProductId = getProductId(review);
    const reviewProductHandle = getProductHandle(review);

    if (
      config.currentProductId &&
      reviewProductId &&
      config.currentProductId === reviewProductId
    ) {
      return true;
    }

    if (
      config.currentProductHandle &&
      reviewProductHandle &&
      config.currentProductHandle === reviewProductHandle
    ) {
      return true;
    }

    return false;
  }

  function matchesCurrentCollection(review, config) {
    if (!config.currentCollectionId && !config.currentCollectionHandle) return false;

    const reviewCollectionIds = getCollectionIds(review);
    const reviewCollectionHandles = getCollectionHandles(review);

    if (
      config.currentCollectionId &&
      reviewCollectionIds.length &&
      reviewCollectionIds.includes(config.currentCollectionId)
    ) {
      return true;
    }

    if (
      config.currentCollectionHandle &&
      reviewCollectionHandles.length &&
      reviewCollectionHandles.includes(config.currentCollectionHandle)
    ) {
      return true;
    }

    return false;
  }

  function getFilteredReviews(rawReviews, config) {
    let items = Array.isArray(rawReviews) ? rawReviews.slice() : [];

    items = items.filter((review) => isApproved(review));
    items = items.filter((review) => getReviewMessage(review));

    if (config.reviewSource === "store_reviews") {
      items = items.filter((review) => getReviewType(review) === "store");
    } else if (config.reviewSource === "product_reviews") {
      items = items.filter((review) => getReviewType(review) === "product");
    } else if (config.reviewSource === "current_product") {
      items = items.filter(
        (review) =>
          getReviewType(review) === "product" &&
          matchesCurrentProduct(review, config)
      );
    } else if (config.reviewSource === "current_collection") {
      items = items.filter(
        (review) =>
          getReviewType(review) === "product" &&
          matchesCurrentCollection(review, config)
      );
    } else if (config.reviewSource === "featured_reviews") {
      items = items.filter((review) => isFeatured(review));
    }

    items.sort((a, b) => {
      const pinA = isFeatured(a) ? 1 : 0;
      const pinB = isFeatured(b) ? 1 : 0;

      if (pinA !== pinB) return pinB - pinA;

      const ratingDiff = getRatingValue(b) - getRatingValue(a);
      if (ratingDiff !== 0) return ratingDiff;

      const dateA = parseDateValue(a.updatedAt || a.createdAt);
      const dateB = parseDateValue(b.updatedAt || b.createdAt);
      return dateB - dateA;
    });

    return items.slice(0, config.maxReviews);
  }

  function createPopupController(root) {
    const config = getConfig(root);

    const popup = root.querySelector(".prp-popup");
    const closeBtn = root.querySelector(".prp-close");
    const mediaWrap = root.querySelector(".prp-media");
    const mediaImage = root.querySelector(".prp-media-image");
    const starsEl = root.querySelector(".prp-stars");
    const verifiedEl = root.querySelector(".prp-verified");
    const messageEl = root.querySelector(".prp-message");
    const authorEl = root.querySelector(".prp-author");
    const productEl = root.querySelector(".prp-product");

    if (!popup || !messageEl || !authorEl || !starsEl) return null;

    let reviews = [];
    let rotationPool = [];
    let rotationIndex = 0;

    let isOpen = false;
    let isAnimating = false;
    let isHovered = false;

    let openTimer = null;
    let autoCloseTimer = null;
    let hideTimer = null;

    let autoCloseDeadline = 0;
    let remainingAutoCloseMs = config.popupAutoCloseMs;

    function clearTimer(type) {
      if (type === "open" && openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }

      if (type === "autoClose" && autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = null;
      }

      if (type === "hide" && hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function clearAllTimers() {
      clearTimer("open");
      clearTimer("autoClose");
      clearTimer("hide");
    }

    function buildRotationPool() {
      if (!reviews.length) {
        rotationPool = [];
        rotationIndex = 0;
        return;
      }

      const previousCurrent =
        rotationPool.length && rotationIndex > 0
          ? rotationPool[(rotationIndex - 1 + rotationPool.length) % rotationPool.length]
          : null;

      rotationPool = shuffleArray(reviews);

      if (
        previousCurrent &&
        rotationPool.length > 1 &&
        rotationPool[0] &&
        getReviewId(rotationPool[0]) === getReviewId(previousCurrent)
      ) {
        const moved = rotationPool.shift();
        rotationPool.push(moved);
      }

      rotationIndex = 0;
    }

    function getNextReview() {
      if (!rotationPool.length) buildRotationPool();
      if (!rotationPool.length) return null;

      if (rotationIndex >= rotationPool.length) {
        buildRotationPool();
      }

      const review = rotationPool[rotationIndex] || null;
      rotationIndex += 1;
      return review;
    }

    function updatePopupContent(review) {
      if (!review) return;

      const message = getReviewMessage(review);
      const author = getCustomerName(review);
      const title = getDisplayTitle(review);
      const rating = getRatingValue(review);
      const imageUrl = config.showReviewImage ? getImageUrl(review) : "";
      const verified = config.showVerifiedBadge && isVerified(review);

      messageEl.textContent = message;
      authorEl.textContent = author;
      starsEl.textContent = renderStarsText(rating);

      if (verifiedEl) {
        verifiedEl.hidden = !verified;
      }

      if (productEl) {
        if (config.showProductName && title) {
          productEl.hidden = false;
          productEl.textContent = title;
        } else {
          productEl.hidden = true;
          productEl.textContent = "";
        }
      }

      if (mediaWrap && mediaImage) {
        if (imageUrl) {
          mediaWrap.hidden = false;
          mediaImage.src = imageUrl;
          mediaImage.alt = title || author || "Review image";
          popup.classList.remove("prp-has-no-image");
        } else {
          mediaWrap.hidden = true;
          mediaImage.removeAttribute("src");
          mediaImage.alt = "";
          popup.classList.add("prp-has-no-image");
        }
      }
    }

    function closeOtherPopups() {
      const otherRoots = Array.from(
        document.querySelectorAll(".prp-root[data-initialized='true']")
      );

      otherRoots.forEach((otherRoot) => {
        if (otherRoot === root) return;
        otherRoot.dispatchEvent(new CustomEvent("prp:close-self"));
      });
    }

    function scheduleAutoClose(durationMs) {
      clearTimer("autoClose");

      if (!isOpen) return;

      if (durationMs <= 0) {
        closePopup("auto");
        return;
      }

      autoCloseDeadline = Date.now() + durationMs;
      remainingAutoCloseMs = durationMs;

      autoCloseTimer = setTimeout(() => {
        closePopup("auto");
      }, durationMs);
    }

    function scheduleNextOpen(delayMs) {
      clearTimer("open");

      if (!reviews.length) return;

      openTimer = setTimeout(() => {
        showNextReview();
      }, Math.max(500, delayMs));
    }

    function openPopup() {
      if (isOpen || isAnimating || !popup) return;

      closeOtherPopups();
      clearTimer("hide");

      popup.hidden = false;
      forceReflow(popup);

      popup.classList.remove("prp-is-closing");
      popup.classList.remove("prp-is-open");
      popup.classList.add("prp-is-visible", "prp-is-entering");

      isAnimating = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          popup.classList.remove("prp-is-entering");
          popup.classList.add("prp-is-open");
        });
      });

      setTimeout(() => {
        isAnimating = false;
        isOpen = true;

        if (!isHovered || !config.pauseOnHover) {
          scheduleAutoClose(config.popupAutoCloseMs);
        }
      }, ENTER_ANIMATION_MS);
    }

    function closePopup(reason) {
      if (!popup || (!isOpen && !isAnimating)) {
        if (reason !== "silent") {
          scheduleNextOpen(config.popupRepeatIntervalMs);
        }
        return;
      }

      clearTimer("autoClose");
      clearTimer("hide");

      popup.classList.remove("prp-is-entering", "prp-is-open");
      popup.classList.add("prp-is-closing", "prp-is-visible");

      isAnimating = true;
      isOpen = false;

      hideTimer = setTimeout(() => {
        popup.classList.remove("prp-is-closing", "prp-is-visible");
        popup.hidden = true;
        isAnimating = false;
        remainingAutoCloseMs = config.popupAutoCloseMs;

        if (reason !== "silent") {
          scheduleNextOpen(config.popupRepeatIntervalMs);
        }
      }, EXIT_ANIMATION_MS);
    }

    function showNextReview() {
      if (!reviews.length) return;

      if (document.hidden) {
        scheduleNextOpen(5000);
        return;
      }

      const review = getNextReview();
      if (!review) return;

      updatePopupContent(review);
      openPopup();
    }

    async function fetchReviewType(reviewType, extraParams = {}) {
      const params = new URLSearchParams();
      params.set("shop", config.shop);
      params.set("approvedOnly", "true");
      params.set("reviewType", reviewType);
      params.set(
        "limit",
        String(Math.max(DEFAULT_FETCH_LIMIT, config.maxReviews * 3))
      );

      Object.keys(extraParams).forEach((key) => {
        const value = safeText(extraParams[key]).trim();
        if (value) params.set(key, value);
      });

      const response = await fetch(`${config.endpoint}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      let result = {};
      try {
        result = await response.json();
      } catch (error) {
        result = {};
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Failed to load ${reviewType} reviews.`);
      }

      return Array.isArray(result.data) ? result.data : [];
    }

    async function loadReviews() {
      if (!config.endpoint || !config.shop) return;

      const requests = [];

      if (config.reviewSource === "store_reviews") {
        requests.push(fetchReviewType("store"));
      } else if (config.reviewSource === "product_reviews") {
        requests.push(fetchReviewType("product"));
      } else if (config.reviewSource === "current_product") {
        if (!config.currentProductId && !config.currentProductHandle) return;
        const extraParams = config.currentProductId
          ? { productId: config.currentProductId }
          : {};
        requests.push(fetchReviewType("product", extraParams));
      } else if (config.reviewSource === "current_collection") {
        requests.push(fetchReviewType("product"));
      } else if (config.reviewSource === "featured_reviews") {
        requests.push(fetchReviewType("store"));
        requests.push(fetchReviewType("product"));
      } else {
        requests.push(fetchReviewType("store"));
        requests.push(fetchReviewType("product"));
      }

      const settled = await Promise.allSettled(requests);
      const merged = [];

      settled.forEach((result) => {
        if (result.status === "fulfilled" && Array.isArray(result.value)) {
          merged.push(...result.value);
        }
      });

      const filtered = getFilteredReviews(merged, config);
      if (!filtered.length) return;

      reviews = filtered;
      buildRotationPool();
      scheduleNextOpen(config.popupDelayMs);
    }

    function bindEvents() {
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          closePopup("manual");
        });
      }

      popup.addEventListener("mouseenter", () => {
        isHovered = true;

        if (config.pauseOnHover && isOpen) {
          clearTimer("autoClose");
          remainingAutoCloseMs = Math.max(0, autoCloseDeadline - Date.now());
        }
      });

      popup.addEventListener("mouseleave", () => {
        isHovered = false;

        if (config.pauseOnHover && isOpen) {
          scheduleAutoClose(remainingAutoCloseMs || config.popupAutoCloseMs);
        }
      });

      root.addEventListener("prp:close-self", () => {
        closePopup("silent");
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          clearTimer("autoClose");
          clearTimer("open");

          if (isOpen && config.pauseOnHover) {
            remainingAutoCloseMs = Math.max(0, autoCloseDeadline - Date.now());
          }
        } else {
          if (isOpen) {
            if (config.pauseOnHover && !isHovered) {
              scheduleAutoClose(remainingAutoCloseMs || config.popupAutoCloseMs);
            }
          } else if (reviews.length) {
            scheduleNextOpen(3000);
          }
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && isOpen) {
          closePopup("manual");
        }
      });
    }

    function init() {
      bindEvents();

      loadReviews().catch(() => {
        clearAllTimers();
      });
    }

    return { init };
  }

  function initRoot(root) {
    if (!root || root.dataset.initialized === "true") return;

    const controller = createPopupController(root);
    if (!controller) return;

    root.dataset.initialized = "true";
    controller.init();
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".prp-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      initRoot(root);
    });
  }

  window.PopupReviewsApp = {
    initRoot,
    initAll,
  };
})(window, document);
