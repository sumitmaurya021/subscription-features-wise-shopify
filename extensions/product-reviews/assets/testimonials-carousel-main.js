(function (window, document) {
  if (window.TestimonialsCarouselApp) return;

  const DEFAULT_FETCH_LIMIT = 120;
  const SWIPE_THRESHOLD = 40;
  const SWIPE_DETECT_THRESHOLD = 14;

  const SAMPLE_REVIEWS = [
    {
      id: "sample-1",
      reviewType: "product",
      rating: 5,
      customerName: "Barbara S.",
      message:
        "After trying out a variety of brands, I finally discovered one that perfectly matches my unique style and personality. The fit is absolutely incredible, and the fabric feels wonderfully soft and luxurious against my skin. Additionally, the shape and vibrant color beautifully complete the overall look.",
      productTitle: "Radiant Glow Foundation 5mL",
      productId: "1001",
      productHandle: "radiant-glow-foundation-5ml",
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
      isPinned: false,
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
      productId: "1002",
      productHandle: "classic-everyday-serum",
      collectionIds: ["2001"],
      collectionHandles: ["summer-glow"],
      isVerified: true,
      isPinned: false,
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
      productId: "1003",
      productHandle: "hydra-repair-cream",
      collectionIds: ["2002"],
      collectionHandles: ["best-sellers"],
      isVerified: false,
      isPinned: true,
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
      isPinned: false,
      createdAt: "2026-03-03T08:15:00Z",
    },
  ];

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function normalizeId(value) {
    const text = safeText(value).trim();
    if (!text) return "";
    const numeric = text.replace(/[^\d]/g, "");
    return numeric || text;
  }

  function normalizeHandle(value) {
    return safeText(value).trim().toLowerCase();
  }

  function parseIdList(value) {
    return safeText(value)
      .split(",")
      .map(function (item) {
        return normalizeId(item);
      })
      .filter(Boolean);
  }

  function parseHandleList(value) {
    return safeText(value)
      .split(",")
      .map(function (item) {
        return normalizeHandle(item);
      })
      .filter(Boolean);
  }

  function parsePossibleList(value) {
    if (Array.isArray(value)) {
      return value
        .map(function (item) {
          return safeText(item).trim();
        })
        .filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map(function (item) {
          return item.trim();
        })
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

    if (
      type === "store" ||
      type === "store_review" ||
      type === "store reviews" ||
      type === "store-reviews"
    ) {
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
        review.verified_buyer ||
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
    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
  }

  function getAverageRating(items) {
    if (!items.length) return 0;
    const total = items.reduce(function (sum, item) {
      return sum + getRatingValue(item);
    }, 0);
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

  function getReviewId(review, index) {
    const id = safeText(review.id || review.reviewId || review._id || "").trim();
    if (id) return id;

    const fallback = [
      safeText(review.customerName || review.customer_name || "").trim(),
      safeText(review.message || review.review || review.content || "").trim(),
      safeText(review.productId || review.product_id || "").trim(),
      String(parseDateValue(review.createdAt || review.updatedAt || 0)),
      String(index || 0),
    ].join("|");

    return fallback;
  }

  function dedupeReviews(items) {
    const seen = new Set();
    const output = [];

    (Array.isArray(items) ? items : []).forEach(function (item, index) {
      const key = getReviewId(item, index);
      if (seen.has(key)) return;
      seen.add(key);
      output.push(item);
    });

    return output;
  }

  function getProductId(review) {
    return normalizeId(
      review.productId ||
        review.product_id ||
        (review.product && review.product.id) ||
        ""
    );
  }

  function getProductHandle(review) {
    return normalizeHandle(
      review.productHandle ||
        review.product_handle ||
        (review.product && review.product.handle) ||
        ""
    );
  }

  function getCollectionIds(review) {
    const base = [
      review.collectionId,
      review.collection_id,
      review.targetId,
      review.target_id,
      review.collection && review.collection.id,
    ]
      .map(function (item) {
        return normalizeId(item);
      })
      .filter(Boolean);

    return base
      .concat(
        parsePossibleList(review.collectionIds).map(normalizeId),
        parsePossibleList(review.collection_ids).map(normalizeId)
      )
      .filter(Boolean);
  }

  function getCollectionHandles(review) {
    const base = [
      review.collectionHandle,
      review.collection_handle,
      review.targetHandle,
      review.target_handle,
      review.collection && review.collection.handle,
    ]
      .map(function (item) {
        return normalizeHandle(item);
      })
      .filter(Boolean);

    return base
      .concat(
        parsePossibleList(review.collectionHandles).map(normalizeHandle),
        parsePossibleList(review.collection_handles).map(normalizeHandle)
      )
      .filter(Boolean);
  }

  function getProductTitle(review) {
    const title = safeText(
      review.productTitle ||
        review.product_title ||
        review.targetTitle ||
        review.target_title ||
        (review.product && review.product.title) ||
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

  function initAllTestimonialsCarousels(scope) {
    const context = scope && scope.querySelectorAll ? scope : document;
    const roots = Array.from(context.querySelectorAll(".tc-root"));

    if (!roots.length) return;

    roots.forEach(function (root) {
      if (root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initTestimonialsCarousel(root);
    });
  }

  function initTestimonialsCarousel(root) {
    const endpoint = root.dataset.endpoint || "";
    const shop = root.dataset.shop || "";
    const reviewSelection = safeText(root.dataset.reviewSelection || "all")
      .trim()
      .toLowerCase();
    const starRatingFilter = safeText(root.dataset.starRatingFilter || "all")
      .trim()
      .toLowerCase();
    const maxReviews = Math.max(1, Number(root.dataset.maxReviews || 20));
    const showSampleReviews =
      safeText(root.dataset.showSampleReviews || "false").toLowerCase() === "true";
    const transitionSpeedSeconds = Math.max(
      2,
      Number(root.dataset.transitionSpeed || 60)
    );

    const currentProductId = normalizeId(root.dataset.productId || "");
    const currentProductHandle = normalizeHandle(root.dataset.productHandle || "");
    const currentCollectionId = normalizeId(root.dataset.collectionId || "");
    const currentCollectionHandle = normalizeHandle(root.dataset.collectionHandle || "");
    const selectedProductIds = parseIdList(root.dataset.selectedProductIds || "");
    const selectedProductHandles = parseHandleList(
      root.dataset.selectedProductHandles || ""
    );

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
      root.querySelectorAll(".tc-arrow--prev, .tc-arrow--prev-bottom")
    );
    const nextButtons = Array.from(
      root.querySelectorAll(".tc-arrow--next, .tc-arrow--next-bottom")
    );

    let reviews = [];
    let currentIndex = 0;
    let autoplayTimer = null;
    let isHovered = false;
    let isDestroyed = false;
    let startX = 0;
    let moved = false;

    if (!root.hasAttribute("tabindex")) {
      root.setAttribute("tabindex", "0");
    }

    function setState(state) {
      root.dataset.tcState = state || "ready";
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
        reviewCollectionIds.indexOf(currentCollectionId) !== -1
      ) {
        return true;
      }

      if (
        currentCollectionHandle &&
        reviewCollectionHandles.length &&
        reviewCollectionHandles.indexOf(currentCollectionHandle) !== -1
      ) {
        return true;
      }

      return false;
    }

    function matchesCustomProducts(review) {
      const reviewProductId = getProductId(review);
      const reviewProductHandle = getProductHandle(review);

      if (
        selectedProductIds.length &&
        reviewProductId &&
        selectedProductIds.indexOf(reviewProductId) !== -1
      ) {
        return true;
      }

      if (
        selectedProductHandles.length &&
        reviewProductHandle &&
        selectedProductHandles.indexOf(reviewProductHandle) !== -1
      ) {
        return true;
      }

      return false;
    }

    function matchesStarFilter(review) {
      const rating = getRatingValue(review);

      if (starRatingFilter === "5") return rating === 5;
      if (starRatingFilter === "4-5") return rating >= 4 && rating <= 5;
      if (starRatingFilter === "3-5") return rating >= 3 && rating <= 5;

      return true;
    }

    function getFilteredReviews(rawReviews) {
      let items = Array.isArray(rawReviews) ? rawReviews.slice() : [];

      items = dedupeReviews(items);
      items = items.filter(function (review) {
        return isApproved(review);
      });

      if (reviewSelection === "store_reviews") {
        items = items.filter(function (review) {
          return getReviewType(review) === "store";
        });
      } else if (reviewSelection === "product_reviews") {
        items = items.filter(function (review) {
          return getReviewType(review) === "product";
        });
      } else if (reviewSelection === "current_product") {
        items = items.filter(function (review) {
          return getReviewType(review) === "product" && matchesCurrentProduct(review);
        });
      } else if (reviewSelection === "current_collection") {
        items = items.filter(function (review) {
          return getReviewType(review) === "product" && matchesCurrentCollection(review);
        });
      } else if (reviewSelection === "featured") {
        items = items.filter(function (review) {
          return isFeatured(review);
        });
      } else if (reviewSelection === "custom_products") {
        items = items.filter(function (review) {
          return getReviewType(review) === "product" && matchesCustomProducts(review);
        });
      }

      items = items.filter(matchesStarFilter);

      items.sort(function (a, b) {
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
        headerRatingCountEl.textContent = "(" + total + ")";
      }
    }

    function showLoading() {
      setState("loading");
      if (loadingEl) loadingEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
    }

    function hideLoading() {
      if (loadingEl) loadingEl.hidden = true;
    }

    function showEmpty() {
      setState("empty");
      hideLoading();

      if (track) {
        track.innerHTML = "";
      }

      if (emptyEl) {
        emptyEl.hidden = false;
      }

      reviews = [];
      currentIndex = 0;
      setArrowState();
      stopAutoplay();
    }

    function hideEmpty() {
      if (emptyEl) {
        emptyEl.hidden = true;
      }
    }

    function setArrowState() {
      const disabled = reviews.length <= 1;

      prevButtons.forEach(function (button) {
        button.disabled = disabled;
      });

      nextButtons.forEach(function (button) {
        button.disabled = disabled;
      });
    }

    function updateSlidesA11y() {
      if (!track) return;
      const slides = Array.from(track.querySelectorAll(".tc-slide"));

      slides.forEach(function (slide, index) {
        const active = index === currentIndex;
        slide.setAttribute("aria-hidden", active ? "false" : "true");
      });
    }

    function updateTrackPosition(animate) {
      if (!track) return;

      if (animate === false) {
        track.style.transition = "none";
        track.style.transform = "translateX(-" + currentIndex * 100 + "%)";

        requestAnimationFrame(function () {
          if (!track) return;
          track.style.transition = "";
        });
      } else {
        track.style.transform = "translateX(-" + currentIndex * 100 + "%)";
      }

      updateSlidesA11y();
    }

    function goToSlide(index, animate) {
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
      goToSlide(currentIndex + 1, true);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1, true);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      stopAutoplay();

      if (isDestroyed) return;
      if (reviews.length <= 1) return;
      if (isHovered) return;
      if (document.hidden) return;

      autoplayTimer = setInterval(function () {
        nextSlide();
      }, transitionSpeedSeconds * 1000);
    }

    function renderSlides(items) {
      if (!track || !templateEl) return;

      setState("ready");
      hideLoading();
      hideEmpty();

      currentIndex = 0;
      track.innerHTML = "";

      const fragment = document.createDocumentFragment();

      items.forEach(function (review) {
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
          starsEl.setAttribute("aria-label", rating + " out of 5 stars");
        }

        if (authorEl) {
          authorEl.textContent = author;
        }

        if (verifiedWrapEl) {
          verifiedWrapEl.hidden = !verified;
        }

        if (productEl) {
          productEl.textContent = productTitle;
          productEl.hidden = !productTitle;
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

    function buildRequestParams() {
      const params = new URLSearchParams();

      params.set("shop", shop);
      params.set("approvedOnly", "true");
      params.set(
        "limit",
        String(Math.max(DEFAULT_FETCH_LIMIT, maxReviews * 4))
      );

      if (reviewSelection === "store_reviews") {
        params.set("reviewType", "store");
      } else if (reviewSelection === "product_reviews") {
        params.set("reviewType", "product");
      } else if (reviewSelection === "current_product") {
        params.set("reviewType", "product");

        if (currentProductId) {
          params.set("productId", currentProductId);
        }
      } else if (reviewSelection === "current_collection") {
        if (currentCollectionId) {
          params.set("collectionId", currentCollectionId);
        } else if (currentCollectionHandle) {
          params.set("collectionHandle", currentCollectionHandle);
        } else {
          params.set("reviewType", "product");
        }
      } else if (reviewSelection === "featured") {
        params.set("featuredOnly", "true");
      } else if (reviewSelection === "custom_products") {
        params.set("reviewType", "product");

        if (selectedProductIds.length) {
          params.set("productIds", selectedProductIds.join(","));
        }
      }

      if (starRatingFilter === "5") {
        params.set("starRating", "5");
      } else if (starRatingFilter === "4-5") {
        params.set("minRating", "4");
      } else if (starRatingFilter === "3-5") {
        params.set("minRating", "3");
      }

      return params;
    }

    async function fetchReviewsFromApi() {
      if (!endpoint || !shop) return [];

      const params = buildRequestParams();
      const response = await fetch(endpoint + "?" + params.toString(), {
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
        throw new Error(result.message || "Failed to load testimonials.");
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

      if (
        reviewSelection === "current_product" &&
        !currentProductId &&
        !currentProductHandle
      ) {
        showEmpty();
        return;
      }

      if (
        reviewSelection === "current_collection" &&
        !currentCollectionId &&
        !currentCollectionHandle
      ) {
        showEmpty();
        return;
      }

      if (
        reviewSelection === "custom_products" &&
        !selectedProductIds.length &&
        !selectedProductHandles.length
      ) {
        showEmpty();
        return;
      }

      try {
        const rawReviews = await fetchReviewsFromApi();
        const filteredReviews = getFilteredReviews(rawReviews);

        updateHeader(filteredReviews);

        if (!filteredReviews.length) {
          showEmpty();
          return;
        }

        renderSlides(filteredReviews);
      } catch (error) {
        console.error("Testimonials Carousel load error:", error);
        showEmpty();
      }
    }

    prevButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        stopAutoplay();
        prevSlide();
        startAutoplay();
      });
    });

    nextButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        stopAutoplay();
        nextSlide();
        startAutoplay();
      });
    });

    if (widget) {
      widget.addEventListener("mouseenter", function () {
        isHovered = true;
        stopAutoplay();
      });

      widget.addEventListener("mouseleave", function () {
        isHovered = false;
        startAutoplay();
      });

      widget.addEventListener("focusin", function () {
        isHovered = true;
        stopAutoplay();
      });

      widget.addEventListener("focusout", function () {
        isHovered = false;
        startAutoplay();
      });
    }

    if (viewport) {
      viewport.addEventListener(
        "touchstart",
        function (event) {
          if (!event.touches || !event.touches.length) return;
          startX = event.touches[0].clientX;
          moved = false;
          stopAutoplay();
        },
        { passive: true }
      );

      viewport.addEventListener(
        "touchmove",
        function (event) {
          if (!event.touches || !event.touches.length) return;
          const diffX = event.touches[0].clientX - startX;
          if (Math.abs(diffX) > SWIPE_DETECT_THRESHOLD) {
            moved = true;
          }
        },
        { passive: true }
      );

      viewport.addEventListener(
        "touchend",
        function (event) {
          if (!event.changedTouches || !event.changedTouches.length) {
            startAutoplay();
            return;
          }

          const diffX = event.changedTouches[0].clientX - startX;

          if (moved && diffX > SWIPE_THRESHOLD) {
            prevSlide();
          } else if (moved && diffX < -SWIPE_THRESHOLD) {
            nextSlide();
          }

          startAutoplay();
        },
        { passive: true }
      );
    }

    root.addEventListener("keydown", function (event) {
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

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });

    window.addEventListener("resize", function () {
      updateTrackPosition(false);
    });

    root.__tcDestroy = function () {
      isDestroyed = true;
      stopAutoplay();
    };

    loadReviews();
  }

  window.TestimonialsCarouselApp = {
    initRoot: function (root) {
      if (!root || root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initTestimonialsCarousel(root);
    },
    initAll: function (scope) {
      initAllTestimonialsCarousels(scope || document);
    },
  };
})(window, document);
