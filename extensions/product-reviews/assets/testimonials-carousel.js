(function () {
  const DEFAULT_FETCH_LIMIT = 120;

  const SAMPLE_REVIEWS = [
    {
      id: "sample-1",
      reviewType: "product",
      rating: 5,
      customerName: "Barbara S.",
      message:
        "After trying out a variety of brands, I finally discovered one that perfectly matches my unique style and personality. The fit is absolutely incredible, and the fabric feels wonderfully soft and luxurious against my skin. Additionally, the shape and vibrant color beautifully complete the overall look.",
      productTitle: "Radiant Glow Foundation 5mL",
      isVerified: true,
      isPinned: true,
      createdAt: "2026-03-10T10:00:00Z",
    },
    {
      id: "sample-2",
      reviewType: "store",
      rating: 5,
      customerName: "Priya K.",
      message:
        "Excellent shopping experience from start to finish. The delivery was quick, the product quality was impressive, and customer support was very responsive when I had a question.",
      productTitle: "Store review",
      isVerified: true,
      createdAt: "2026-03-08T09:00:00Z",
    },
    {
      id: "sample-3",
      reviewType: "product",
      rating: 4,
      customerName: "Jacob F.",
      message:
        "The product looks premium and performs really well. Packaging was clean and secure. I would definitely purchase again and recommend it to friends.",
      productTitle: "Classic Everyday Serum",
      isVerified: true,
      createdAt: "2026-03-06T11:30:00Z",
    },
    {
      id: "sample-4",
      reviewType: "product",
      rating: 5,
      customerName: "Ananya P.",
      message:
        "Super happy with this purchase. The texture, build quality, and overall finish feel much better than I expected for the price.",
      productTitle: "Hydra Repair Cream",
      isVerified: false,
      createdAt: "2026-03-05T13:45:00Z",
    },
    {
      id: "sample-5",
      reviewType: "store",
      rating: 4,
      customerName: "Rohit M.",
      message:
        "Ordering process was smooth and easy. The team kept me updated and the item arrived in great condition. Very nice overall experience.",
      productTitle: "Store review",
      isVerified: true,
      createdAt: "2026-03-03T08:15:00Z",
    },
  ];

  function initAllTestimonialsCarousels(scope = document) {
    const roots = Array.from(scope.querySelectorAll(".tc-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      if (root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initTestimonialsCarousel(root);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAllTestimonialsCarousels(document);
  });

  document.addEventListener("shopify:section:load", (event) => {
    initAllTestimonialsCarousels(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    initAllTestimonialsCarousels(event.target || document);
  });

  function initTestimonialsCarousel(root) {
    const endpoint = root.dataset.endpoint || "";
    const shop = root.dataset.shop || "";
    const reviewSelection = (root.dataset.reviewSelection || "all").trim().toLowerCase();
    const starRatingFilter = (root.dataset.starRatingFilter || "all").trim().toLowerCase();
    const maxReviews = Math.max(1, Number(root.dataset.maxReviews || 20));
    const showSampleReviews =
      String(root.dataset.showSampleReviews || "false").toLowerCase() === "true";
    const transitionSpeedSeconds = Math.max(
      2,
      Number(root.dataset.transitionSpeed || 60)
    );

    const currentProductId = normalizeId(root.dataset.productId || "");
    const currentProductHandle = normalizeHandle(root.dataset.productHandle || "");
    const currentCollectionId = normalizeId(root.dataset.collectionId || "");
    const currentCollectionHandle = normalizeHandle(root.dataset.collectionHandle || "");
    const selectedProductIds = parseIdList(root.dataset.selectedProductIds || "");

    const widget = root.querySelector(".tc-widget");
    const viewport = root.querySelector(".tc-viewport");
    const track = root.querySelector(".tc-track");
    const loadingEl = root.querySelector(".tc-loading");
    const emptyEl = root.querySelector(".tc-empty");
    const templateEl = root.querySelector(".tc-card-template");

    const headerRatingEl = root.querySelector(".tc-header-rating");
    const headerStarsEl = root.querySelector(".tc-header-stars");
    const headerRatingValueEl = root.querySelector(".tc-header-rating-value");
    const headerRatingCountEl = root.querySelector(".tc-header-rating-count");

    const prevButtons = Array.from(
      root.querySelectorAll(
        ".tc-arrow--prev, .tc-arrow--prev-bottom"
      )
    );
    const nextButtons = Array.from(
      root.querySelectorAll(
        ".tc-arrow--next, .tc-arrow--next-bottom"
      )
    );

    let reviews = [];
    let currentIndex = 0;
    let autoplayTimer = null;
    let isHovered = false;

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

    function normalizeId(value) {
      const text = safeText(value).trim();
      if (!text) return "";
      return text.replace(/[^\d]/g, "") || text;
    }

    function normalizeHandle(value) {
      return safeText(value).trim().toLowerCase();
    }

    function parseIdList(value) {
      return safeText(value)
        .split(",")
        .map((item) => normalizeId(item))
        .filter(Boolean);
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

    function getReviewType(review) {
      const type = safeText(
        review.reviewType ||
          review.review_type ||
          review.type ||
          ""
      )
        .trim()
        .toLowerCase();

      if (type === "store" || type === "store_review" || type === "store reviews") {
        return "store";
      }

      return "product";
    }

    function isApproved(review) {
      const rawStatus = safeText(review.status).trim().toLowerCase();
      if (!rawStatus) return true;
      return rawStatus === "approved";
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

    function isFeatured(review) {
      return Boolean(
        review.isPinned ||
          review.pinned ||
          review.featured ||
          review.isFeatured
      );
    }

    function getRatingValue(review) {
      const rating = Number(review.rating) || 0;
      return Math.max(0, Math.min(5, rating));
    }

    function renderStarsText(rating) {
      const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
      const rounded = Math.round(safeRating);
      return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
    }

    function getAverageRating(items) {
      if (!items.length) return 0;
      const total = items.reduce((sum, item) => sum + getRatingValue(item), 0);
      return total / items.length;
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

    function matchesCurrentProduct(review) {
      if (!currentProductId && !currentProductHandle) return false;

      const reviewProductId = getProductId(review);
      const reviewProductHandle = getProductHandle(review);

      if (currentProductId && reviewProductId && currentProductId === reviewProductId) {
        return true;
      }

      if (
        currentProductHandle &&
        reviewProductHandle &&
        currentProductHandle === reviewProductHandle
      ) {
        return true;
      }

      return false;
    }

    function matchesCurrentCollection(review) {
      if (!currentCollectionId && !currentCollectionHandle) return false;

      const reviewCollectionIds = getCollectionIds(review);
      const reviewCollectionHandles = getCollectionHandles(review);

      if (
        currentCollectionId &&
        reviewCollectionIds.length &&
        reviewCollectionIds.includes(currentCollectionId)
      ) {
        return true;
      }

      if (
        currentCollectionHandle &&
        reviewCollectionHandles.length &&
        reviewCollectionHandles.includes(currentCollectionHandle)
      ) {
        return true;
      }

      return false;
    }

    function matchesCustomProducts(review) {
      if (!selectedProductIds.length) return false;
      const reviewProductId = getProductId(review);
      return Boolean(reviewProductId && selectedProductIds.includes(reviewProductId));
    }

    function matchesStarFilter(review) {
      const rating = getRatingValue(review);

      if (starRatingFilter === "5") return rating === 5;
      if (starRatingFilter === "4-5") return rating >= 4 && rating <= 5;
      if (starRatingFilter === "3-5") return rating >= 3 && rating <= 5;

      return true;
    }

    function getProductTitle(review) {
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

    function getCustomerName(review) {
      const name = safeText(
        review.customerName ||
          review.customer_name ||
          review.name ||
          ""
      ).trim();

      return name || "Anonymous";
    }

    function getReviewMessage(review) {
      return safeText(review.message || review.review || review.content || "").trim();
    }

    function getFilteredReviews(rawReviews) {
      let items = Array.isArray(rawReviews) ? rawReviews.slice() : [];

      items = items.filter((review) => isApproved(review));

      if (reviewSelection === "store_reviews") {
        items = items.filter((review) => getReviewType(review) === "store");
      } else if (reviewSelection === "product_reviews") {
        items = items.filter((review) => getReviewType(review) === "product");
      } else if (reviewSelection === "current_product") {
        items = items.filter(
          (review) =>
            getReviewType(review) === "product" && matchesCurrentProduct(review)
        );
      } else if (reviewSelection === "current_collection") {
        items = items.filter(
          (review) =>
            getReviewType(review) === "product" && matchesCurrentCollection(review)
        );
      } else if (reviewSelection === "featured") {
        items = items.filter((review) => isFeatured(review));
      } else if (reviewSelection === "custom_products") {
        items = items.filter(
          (review) =>
            getReviewType(review) === "product" && matchesCustomProducts(review)
        );
      }

      items = items.filter(matchesStarFilter);

      items.sort((a, b) => {
        const pinA = isFeatured(a) ? 1 : 0;
        const pinB = isFeatured(b) ? 1 : 0;

        if (pinA !== pinB) return pinB - pinA;

        const dateA = parseDateValue(a.updatedAt || a.createdAt);
        const dateB = parseDateValue(b.updatedAt || b.createdAt);
        if (dateA !== dateB) return dateB - dateA;

        return getRatingValue(b) - getRatingValue(a);
      });

      return items.slice(0, maxReviews);
    }

    function updateHeader(items) {
      if (!headerRatingEl) return;

      const total = items.length;
      const average = getAverageRating(items);

      if (headerStarsEl) {
        headerStarsEl.textContent = renderStarsText(average);
      }

      if (headerRatingValueEl) {
        headerRatingValueEl.textContent = average.toFixed(2);
      }

      if (headerRatingCountEl) {
        headerRatingCountEl.textContent = `(${total})`;
      }
    }

    function showLoading() {
      if (loadingEl) loadingEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
    }

    function hideLoading() {
      if (loadingEl) loadingEl.hidden = true;
    }

    function showEmpty() {
      hideLoading();
      if (track) {
        track.innerHTML = "";
      }
      if (emptyEl) {
        emptyEl.hidden = false;
      }
      setArrowState();
    }

    function hideEmpty() {
      if (emptyEl) {
        emptyEl.hidden = true;
      }
    }

    function setArrowState() {
      const disabled = reviews.length <= 1;

      prevButtons.forEach((button) => {
        button.disabled = disabled;
      });

      nextButtons.forEach((button) => {
        button.disabled = disabled;
      });
    }

    function updateTrackPosition(animate = true) {
      if (!track) return;

      if (!animate) {
        track.style.transition = "none";
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        requestAnimationFrame(() => {
          track.style.transition = "";
        });
        return;
      }

      track.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    function goToSlide(index, animate = true) {
      if (!reviews.length) return;

      const lastIndex = reviews.length - 1;

      if (index < 0) {
        currentIndex = lastIndex;
      } else if (index > lastIndex) {
        currentIndex = 0;
      } else {
        currentIndex = index;
      }

      updateTrackPosition(animate);
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();

      if (reviews.length <= 1) return;
      if (isHovered) return;

      autoplayTimer = setInterval(() => {
        nextSlide();
      }, transitionSpeedSeconds * 1000);
    }

    function renderSlides(items) {
      if (!track || !templateEl) return;

      hideLoading();
      hideEmpty();

      currentIndex = 0;
      track.innerHTML = "";

      const fragment = document.createDocumentFragment();

      items.forEach((review) => {
        const slide = document.createElement("div");
        slide.className = "tc-slide";

        const templateContent = templateEl.content.cloneNode(true);
        const card = templateContent.querySelector(".tc-card");
        const messageEl = templateContent.querySelector(".tc-review-message");
        const starsEl = templateContent.querySelector(".tc-review-stars");
        const authorEl = templateContent.querySelector(".tc-review-author");
        const verifiedWrapEl = templateContent.querySelector(".tc-review-verified");
        const productEl = templateContent.querySelector(".tc-review-product");

        const message = getReviewMessage(review);
        const rating = getRatingValue(review);
        const author = getCustomerName(review);
        const productTitle = getProductTitle(review);
        const verified = isVerified(review);

        if (messageEl) {
          messageEl.textContent = message;
        }

        if (starsEl) {
          starsEl.textContent = renderStarsText(rating);
        }

        if (authorEl) {
          authorEl.textContent = author;
        }

        if (verifiedWrapEl) {
          verifiedWrapEl.hidden = !verified;
        }

        if (productEl) {
          productEl.textContent = productTitle;
        }

        slide.appendChild(card || templateContent);
        fragment.appendChild(slide);
      });

      track.appendChild(fragment);
      reviews = items.slice();

      updateTrackPosition(false);
      setArrowState();
      startAutoplay();
    }

    async function fetchReviewType(reviewType) {
      const params = new URLSearchParams();
      params.set("shop", shop);
      params.set("approvedOnly", "true");
      params.set("reviewType", reviewType);
      params.set("limit", String(Math.max(DEFAULT_FETCH_LIMIT, maxReviews * 3)));

      if (reviewSelection === "current_product" && currentProductId) {
        params.set("productId", currentProductId);
      }

      const response = await fetch(`${endpoint}?${params.toString()}`, {
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
      showLoading();

      if (showSampleReviews) {
        const filteredSampleReviews = getFilteredReviews(SAMPLE_REVIEWS);
        updateHeader(filteredSampleReviews);

        if (!filteredSampleReviews.length) {
          showEmpty();
          return;
        }

        renderSlides(filteredSampleReviews);
        return;
      }

      if (!endpoint || !shop) {
        showEmpty();
        return;
      }

      const needsStore =
        reviewSelection === "all" || reviewSelection === "store_reviews";
      const needsProduct =
        reviewSelection === "all" ||
        reviewSelection === "product_reviews" ||
        reviewSelection === "current_product" ||
        reviewSelection === "current_collection" ||
        reviewSelection === "featured" ||
        reviewSelection === "custom_products";

      const requests = [];

      if (needsStore) {
        requests.push(fetchReviewType("store"));
      }

      if (needsProduct) {
        requests.push(fetchReviewType("product"));
      }

      try {
        const settled = await Promise.allSettled(requests);
        const merged = [];

        settled.forEach((result) => {
          if (result.status === "fulfilled" && Array.isArray(result.value)) {
            merged.push(...result.value);
          }
        });

        const filteredReviews = getFilteredReviews(merged);
        updateHeader(filteredReviews);

        if (!filteredReviews.length) {
          showEmpty();
          return;
        }

        renderSlides(filteredReviews);
      } catch (error) {
        showEmpty();
      }
    }

    prevButtons.forEach((button) => {
      button.addEventListener("click", () => {
        stopAutoplay();
        prevSlide();
        startAutoplay();
      });
    });

    nextButtons.forEach((button) => {
      button.addEventListener("click", () => {
        stopAutoplay();
        nextSlide();
        startAutoplay();
      });
    });

    if (widget) {
      widget.addEventListener("mouseenter", () => {
        isHovered = true;
        stopAutoplay();
      });

      widget.addEventListener("mouseleave", () => {
        isHovered = false;
        startAutoplay();
      });
    }

    if (viewport) {
      let startX = 0;
      let moved = false;

      viewport.addEventListener(
        "touchstart",
        (event) => {
          if (!event.touches || !event.touches.length) return;
          startX = event.touches[0].clientX;
          moved = false;
          stopAutoplay();
        },
        { passive: true }
      );

      viewport.addEventListener(
        "touchmove",
        (event) => {
          if (!event.touches || !event.touches.length) return;
          const diffX = event.touches[0].clientX - startX;
          if (Math.abs(diffX) > 14) {
            moved = true;
          }
        },
        { passive: true }
      );

      viewport.addEventListener(
        "touchend",
        (event) => {
          if (!moved || !event.changedTouches || !event.changedTouches.length) {
            startAutoplay();
            return;
          }

          const diffX = event.changedTouches[0].clientX - startX;

          if (diffX > 40) {
            prevSlide();
          } else if (diffX < -40) {
            nextSlide();
          }

          startAutoplay();
        },
        { passive: true }
      );
    }

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        stopAutoplay();
        prevSlide();
        startAutoplay();
      } else if (event.key === "ArrowRight") {
        stopAutoplay();
        nextSlide();
        startAutoplay();
      }
    });

    loadReviews();
  }
})();
