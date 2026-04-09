(function (window, document) {
  if (window.ReviewCardsCarouselApp) return;

  const SWIPER_JS_URL =
    "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
  const SWIPER_CSS_URL =
    "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";

  const SAMPLE_REVIEWS = [
    {
      id: "sample-1",
      customerName: "Jacob F.",
      productTitle: "Classic Cable Knit Sweater",
      rating: 5,
      message:
        "The sweater is super warm and looks premium, but feels a bit heavy after long wear.",
      reviewImages: [
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
      ],
      reviewVideoUrl: null,
      reviewYoutubeUrl: null,
      createdAt: new Date().toISOString(),
      isPinned: true,
      reviewType: "product",
      productId: "101",
      targetId: "101",
    },
    {
      id: "sample-2",
      customerName: "Hannah L.",
      productTitle: "Classic Cable Knit Sweater",
      rating: 5,
      message:
        "Every cable and stitch is done with care. It looks expensive and feels amazing. The cuffs are super cozy.",
      reviewImages: [
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
      ],
      reviewVideoUrl: null,
      reviewYoutubeUrl: null,
      createdAt: new Date().toISOString(),
      isPinned: false,
      reviewType: "product",
      productId: "101",
      targetId: "101",
    },
    {
      id: "sample-3",
      customerName: "Noah V.",
      productTitle: "Classic Cable Knit Sweater",
      rating: 3,
      message:
        "Fabric quality is nice, but the fit felt tighter than expected on the shoulders.",
      reviewImages: [],
      reviewVideoUrl: "https://res.cloudinary.com/demo/video/upload/dog.mp4",
      reviewYoutubeUrl: null,
      createdAt: new Date().toISOString(),
      isPinned: false,
      reviewType: "product",
      productId: "102",
      targetId: "102",
    },
    {
      id: "sample-4",
      customerName: "Aline D.",
      productTitle: "",
      rating: 5,
      message:
        "J'adore ce pull. Il est chaud, doux et très bien coupé. Il garde bien sa forme même après lavage.",
      reviewImages: [],
      reviewVideoUrl: null,
      reviewYoutubeUrl: null,
      createdAt: new Date().toISOString(),
      isPinned: false,
      reviewType: "store",
      productId: "",
      targetId: "",
    },
    {
      id: "sample-5",
      customerName: "Chris M.",
      productTitle: "Classic Cable Knit Sweater",
      rating: 4,
      message:
        "Looks beautiful in person. Great style and texture. Delivery was also quick.",
      reviewImages: [
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
      ],
      reviewVideoUrl: null,
      reviewYoutubeUrl: null,
      createdAt: new Date().toISOString(),
      isPinned: false,
      reviewType: "product",
      productId: "103",
      targetId: "103",
    },
  ];

  let swiperStylePromise = null;
  let swiperScriptPromise = null;

  function ensureSwiperStyle() {
    if (swiperStylePromise) return swiperStylePromise;

    swiperStylePromise = new Promise((resolve) => {
      if (document.getElementById("prcc-swiper-css")) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.id = "prcc-swiper-css";
      link.rel = "stylesheet";
      link.href = SWIPER_CSS_URL;
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });

    return swiperStylePromise;
  }

  function ensureSwiperScript() {
    if (window.Swiper) return Promise.resolve();
    if (swiperScriptPromise) return swiperScriptPromise;

    swiperScriptPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById("prcc-swiper-js");

      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Swiper")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.id = "prcc-swiper-js";
      script.src = SWIPER_JS_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Swiper"));
      document.body.appendChild(script);
    });

    return swiperScriptPromise;
  }

  function parseBoolean(value) {
    return String(value) === "true";
  }

  function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
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

  function parseCsvIds(value) {
    return safeText(value)
      .split(/[,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeImages(review) {
    if (Array.isArray(review?.reviewImages)) return review.reviewImages.filter(Boolean);

    if (typeof review?.reviewImages === "string") {
      try {
        const parsed = JSON.parse(review.reviewImages);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (_) {}
    }

    if (Array.isArray(review?.images)) return review.images.filter(Boolean);
    return [];
  }

  function formatStars(rating) {
    const full = "★".repeat(
      Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)))
    );
    const empty = "☆".repeat(5 - full.length);
    return `${full}${empty}`;
  }

  function normalizeReviewType(value) {
    const type = safeText(value).trim().toLowerCase();
    if (type === "product" || type === "collection" || type === "store") return type;
    return "";
  }

  function normalizeId(value) {
    return safeText(value).trim();
  }

  function getReviewProductId(review) {
    return (
      normalizeId(review?.productId) ||
      (normalizeReviewType(review?.reviewType) === "product"
        ? normalizeId(review?.targetId)
        : "")
    );
  }

  function getYoutubeIdFromUrl(url) {
    if (!url) return "";

    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "").trim();
      }

      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
      }

      return "";
    } catch {
      return "";
    }
  }

  function getYoutubeThumbnail(url) {
    const videoId = getYoutubeIdFromUrl(url);
    if (!videoId) return "";
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  function getYoutubeEmbedUrl(url, autoplay = false) {
    const videoId = getYoutubeIdFromUrl(url);
    if (!videoId) return "";
    return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&controls=1&modestbranding=1&disablekb=0${autoplay ? "&autoplay=1" : ""}`;
  }

  function hasMedia(review) {
    return (
      normalizeImages(review).length > 0 ||
      Boolean(review?.reviewVideoUrl) ||
      Boolean(review?.reviewYoutubeUrl)
    );
  }

  function getPrimaryMediaHtml(review, config) {
    if (!config.showReviewMedia) return "";

    const images = normalizeImages(review);

    if (review?.reviewVideoUrl) {
      return `
        <div class="prcc-media prcc-media--video" data-video-container="true">
          <video
            class="prcc-video"
            src="${escapeHtml(review.reviewVideoUrl)}"
            playsinline
            preload="metadata"
          ></video>
          <button
            type="button"
            class="prcc-media-toggle"
            data-video-trigger="true"
            aria-label="Play video"
          >
            <span class="prcc-play-badge">▶</span>
          </button>
        </div>
      `;
    }

    if (review?.reviewYoutubeUrl) {
      const thumbnail = getYoutubeThumbnail(review.reviewYoutubeUrl);
      const embedUrl = getYoutubeEmbedUrl(review.reviewYoutubeUrl, true);

      if (thumbnail && embedUrl) {
        return `
          <div
            class="prcc-media prcc-media--youtube"
            data-youtube-container="true"
            data-youtube-embed="${escapeHtml(embedUrl)}"
          >
            <img src="${escapeHtml(thumbnail)}" alt="Review video">
            <button
              type="button"
              class="prcc-media-toggle"
              data-youtube-trigger="true"
              aria-label="Play video"
            >
              <span class="prcc-play-badge">▶</span>
            </button>
          </div>
        `;
      }
    }

    if (images.length) {
      return `
        <div class="prcc-media prcc-media--image">
          <img src="${escapeHtml(images[0])}" alt="Review image">
        </div>
      `;
    }

    if (config.noImageFallback === "product_image" && config.currentProductImage) {
      return `
        <div class="prcc-media prcc-media--fallback">
          <img src="${escapeHtml(config.currentProductImage)}" alt="Product image">
        </div>
      `;
    }

    return "";
  }

  function getConfig(root) {
    return {
      endpoint: safeText(root.dataset.endpoint),
      shop: safeText(root.dataset.shop),
      showSampleReviews: parseBoolean(root.dataset.showSampleReviews),
      reviewsSelection: safeText(root.dataset.reviewsSelection || "all"),
      customProductIds: parseCsvIds(root.dataset.customProductIds),
      currentProductId: safeText(root.dataset.currentProductId),
      currentCollectionProductIds: parseCsvIds(
        root.dataset.currentCollectionProductIds
      ),
      currentProductImage: safeText(root.dataset.currentProductImage),
      starRating: safeText(root.dataset.starRating || "all"),
      showReviewMedia: parseBoolean(root.dataset.showReviewMedia),
      displayOrder: safeText(root.dataset.displayOrder || "media_first"),
      noImageFallback: safeText(
        root.dataset.noImageFallback || "review_text_only"
      ),
      maxReviewNumber: parseNumber(root.dataset.maxReviewNumber, 20),
      reviewLength: safeText(root.dataset.reviewLength || "medium"),
      textSize: safeText(root.dataset.textSize || "medium"),
      imageRatio: safeText(root.dataset.imageRatio || "ratio_1_1"),
      reviewsShownDesktop: Math.max(
        1,
        parseNumber(root.dataset.reviewsShownDesktop, 4)
      ),
      showReviewerName: parseBoolean(root.dataset.showReviewerName),
      showProductName: parseBoolean(root.dataset.showProductName),
      hideArrowsOnMobile: parseBoolean(root.dataset.hideArrowsOnMobile),
      arrowsPosition: safeText(root.dataset.arrowsPosition || "sides"),
      transitionSpeed: parseNumber(root.dataset.transitionSpeed, 5) * 1000,
      headerText: safeText(root.dataset.headerText || "Customers are saying"),
      averageRatingText: parseBoolean(root.dataset.averageRatingText),
      showVerifiedBadge: parseBoolean(root.dataset.showVerifiedBadge),
    };
  }

  function buildQueryUrl(config) {
    const params = new URLSearchParams();
    params.set("approvedOnly", "true");
    params.set("limit", String(Math.max(config.maxReviewNumber * 4, 80)));

    if (config.shop) {
      params.set("shop", config.shop);
    }

    if (config.reviewsSelection === "featured") {
      params.set("featuredOnly", "true");
    }

    if (config.reviewsSelection === "store_reviews") {
      params.set("reviewType", "store");
    }

    if (config.reviewsSelection === "product_reviews") {
      params.set("reviewType", "product");
    }

    if (config.reviewsSelection === "current_product" && config.currentProductId) {
      params.set("productId", config.currentProductId);
    }

    if (
      config.reviewsSelection === "current_collection" &&
      config.currentCollectionProductIds.length
    ) {
      params.set("productIds", config.currentCollectionProductIds.join(","));
      params.set("reviewType", "product");
    }

    if (
      config.reviewsSelection === "custom_products" &&
      config.customProductIds.length
    ) {
      params.set("productIds", config.customProductIds.join(","));
      params.set("reviewType", "product");
    }

    if (config.starRating === "5_only") {
      params.set("starRating", "5");
    } else if (config.starRating === "4_to_5") {
      params.set("minRating", "4");
    } else if (config.starRating === "3_to_5") {
      params.set("minRating", "3");
    }

    return `${config.endpoint}?${params.toString()}`;
  }

  async function fetchReviews(config) {
    if (!config.endpoint) return [];

    const response = await fetch(buildQueryUrl(config), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    let result = null;

    try {
      result = await response.json();
    } catch (_) {
      throw new Error("Invalid response while loading reviews");
    }

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Failed to fetch carousel reviews");
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  function applySelectionFilter(reviews, config) {
    const selection = safeText(config.reviewsSelection || "all");
    const currentProductId = normalizeId(config.currentProductId);
    const currentCollectionIds = new Set(
      config.currentCollectionProductIds.map(normalizeId).filter(Boolean)
    );
    const customProductIds = new Set(
      config.customProductIds.map(normalizeId).filter(Boolean)
    );

    return reviews.filter((review) => {
      const reviewType = normalizeReviewType(review?.reviewType);
      const productId = getReviewProductId(review);

      if (selection === "store_reviews") {
        return reviewType === "store";
      }

      if (selection === "product_reviews") {
        return reviewType === "product";
      }

      if (selection === "current_product") {
        return productId && currentProductId && productId === currentProductId;
      }

      if (selection === "current_collection") {
        return reviewType === "product" && productId && currentCollectionIds.has(productId);
      }

      if (selection === "featured") {
        return Boolean(review?.isPinned);
      }

      if (selection === "custom_products") {
        return reviewType === "product" && productId && customProductIds.has(productId);
      }

      return true;
    });
  }

  function applyRatingFilter(reviews, config) {
    return reviews.filter((review) => {
      const rating = Number(review?.rating) || 0;

      if (config.starRating === "5_only") return rating === 5;
      if (config.starRating === "4_to_5") return rating >= 4;
      if (config.starRating === "3_to_5") return rating >= 3;

      return true;
    });
  }

  function dedupeReviews(reviews) {
    const seen = new Set();

    return reviews.filter((review) => {
      const id =
        normalizeId(review?.id) ||
        [
          normalizeId(review?.shop),
          normalizeReviewType(review?.reviewType),
          normalizeId(review?.targetId),
          normalizeId(review?.productId),
          normalizeId(review?.customerEmail),
          safeText(review?.createdAt),
          safeText(review?.message),
        ].join("::");

      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function sortReviews(reviews, config) {
    const list = [...reviews];

    const dateValue = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    };

    if (config.displayOrder === "media_first") {
      list.sort((a, b) => {
        const aPinned = a.isPinned ? 1 : 0;
        const bPinned = b.isPinned ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;

        const aMedia = hasMedia(a) ? 1 : 0;
        const bMedia = hasMedia(b) ? 1 : 0;
        if (bMedia !== aMedia) return bMedia - aMedia;

        return dateValue(b.createdAt) - dateValue(a.createdAt);
      });
    } else {
      list.sort((a, b) => {
        const aPinned = a.isPinned ? 1 : 0;
        const bPinned = b.isPinned ? 1 : 0;
        if (bPinned !== aPinned) return bPinned - aPinned;

        return dateValue(b.createdAt) - dateValue(a.createdAt);
      });
    }

    return list;
  }

  function getVerifiedBadgeHtml() {
    return `
      <span
        class="prcc-verified"
        aria-label="Verified reviews"
        title="Verified reviews"
      >
        <span class="prcc-verified-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M12 2.75l2.26 2.06 3.05-.18 1.23 2.8 2.67 1.48-.62 2.99 1.39 2.72-2.19 2.13-.34 3.04-2.99.58L12 21.25l-2.46-1.88-2.99-.58-.34-3.04-2.19-2.13 1.39-2.72-.62-2.99 2.67-1.48 1.23-2.8 3.05.18L12 2.75zM10.7 15.8l6.02-6.01-1.41-1.42-4.61 4.61-1.99-1.99-1.42 1.42 3.41 3.39z"></path>
          </svg>
        </span>
      </span>
    `;
  }

  function renderHeader(config, reviews) {
    const count = reviews.length;
    const average =
      count > 0
        ? reviews.reduce(
            (sum, review) => sum + (Number(review.rating) || 0),
            0
          ) / count
        : 0;

    return `
      <div class="prcc-header-inner">
        <h3 class="prcc-title">${escapeHtml(config.headerText)}</h3>
        ${
          config.averageRatingText && count > 0
            ? `
              <div class="prcc-rating-line">
                <span class="prcc-stars">${formatStars(Math.round(average))}</span>
                <span class="prcc-average">${average.toFixed(2)}</span>
                <span class="prcc-count">(${count})</span>
                ${config.showVerifiedBadge ? getVerifiedBadgeHtml() : ""}
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function getCardText(review) {
    const message = safeText(review?.message).trim();
    const title = safeText(review?.title).trim();

    if (message) return message;
    if (title) return title;
    return "Customer shared a positive review.";
  }

  function renderCard(review, config) {
    const mediaHtml = getPrimaryMediaHtml(review, config);
    const reviewerName = safeText(review.customerName || "Anonymous");
    const productTitle = safeText(review.productTitle || "");
    const rating = Number(review.rating) || 0;
    const message = getCardText(review);

    return `
      <div class="swiper-slide">
        <article class="prcc-card ${review.isPinned ? "is-featured" : ""}">
          ${mediaHtml}
          <div class="prcc-card-body">
            <div class="prcc-message">${escapeHtml(message)}</div>
            <div class="prcc-card-footer">
              <div class="prcc-card-stars">${formatStars(rating)}</div>
              ${
                config.showReviewerName
                  ? `<div class="prcc-reviewer">${escapeHtml(reviewerName)}</div>`
                  : ""
              }
              ${
                config.showProductName && productTitle
                  ? `<div class="prcc-product">${escapeHtml(productTitle)}</div>`
                  : ""
              }
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function renderEmpty(root, config, message) {
    const headerEl = root.querySelector(".prcc-header");
    const wrapperEl = root.querySelector(".prcc-wrapper");
    const emptyEl = root.querySelector(".prcc-empty");

    if (headerEl) {
      headerEl.innerHTML = `
        <div class="prcc-header-inner">
          <h3 class="prcc-title">${escapeHtml(config.headerText)}</h3>
        </div>
      `;
    }

    if (wrapperEl) {
      wrapperEl.innerHTML = "";
    }

    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = message || "No reviews found for this selection.";
    }
  }

  function initSwiper(root, config, totalSlides) {
    if (!window.Swiper) return;

    if (root._prccSwiper) {
      root._prccSwiper.destroy(true, true);
      root._prccSwiper = null;
    }

    const desktopSlides = Math.max(1, config.reviewsShownDesktop);
    const tabletSlides =
      desktopSlides >= 4 ? 2.5 : Math.max(1.5, Math.min(3, desktopSlides));
    const mobileSlides = 1.15;

    root._prccSwiper = new window.Swiper(root.querySelector(".prcc-swiper"), {
      speed: config.transitionSpeed,
      slidesPerView: mobileSlides,
      spaceBetween: 16,
      watchOverflow: true,
      allowTouchMove: totalSlides > 1,
      navigation: {
        nextEl: root.querySelector(".prcc-next"),
        prevEl: root.querySelector(".prcc-prev"),
      },
      breakpoints: {
        768: {
          slidesPerView: tabletSlides,
          spaceBetween: 18,
        },
        990: {
          slidesPerView: desktopSlides,
          spaceBetween: 20,
        },
      },
    });
  }

  function resetVideoMedia(media) {
    if (!media) return;

    media.classList.remove("is-playing");

    const toggleBtn = media.querySelector(".prcc-media-toggle");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", "Play video");
    }

    const video = media.querySelector(".prcc-video");
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_) {}
    }
  }

  function resetYoutubeMedia(media) {
    if (!media) return;

    media.classList.remove("is-playing");

    const toggleBtn = media.querySelector(".prcc-media-toggle");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", "Play video");
    }

    const frame = media.querySelector(".prcc-youtube-frame");
    if (frame) frame.remove();
  }

  function pauseAllCarouselMedia(root, exceptMedia = null) {
    const videoMedias = Array.from(
      root.querySelectorAll("[data-video-container='true']")
    );
    videoMedias.forEach((media) => {
      if (media !== exceptMedia) {
        resetVideoMedia(media);
      }
    });

    const youtubeMedias = Array.from(
      root.querySelectorAll("[data-youtube-container='true']")
    );
    youtubeMedias.forEach((media) => {
      if (media !== exceptMedia) {
        resetYoutubeMedia(media);
      }
    });
  }

  async function toggleNativeVideo(media, root) {
    const video = media.querySelector(".prcc-video");
    const toggleBtn = media.querySelector(".prcc-media-toggle");
    if (!video) return;

    if (video.paused) {
      pauseAllCarouselMedia(root, media);

      try {
        video.muted = false;
        await video.play();
      } catch (_) {
        try {
          video.muted = true;
          await video.play();
        } catch (error) {
          console.error("Video play error:", error);
          return;
        }
      }

      media.classList.add("is-playing");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", "Pause video");
      }
    } else {
      video.pause();
      media.classList.remove("is-playing");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", "Play video");
      }
    }
  }

  function toggleYoutubeVideo(media, root) {
    const toggleBtn = media.querySelector(".prcc-media-toggle");
    const embedUrl = media.getAttribute("data-youtube-embed") || "";
    if (!embedUrl) return;

    const existingFrame = media.querySelector(".prcc-youtube-frame");

    if (existingFrame) {
      resetYoutubeMedia(media);
      return;
    }

    pauseAllCarouselMedia(root, media);

    const iframe = document.createElement("iframe");
    iframe.className = "prcc-youtube-frame";
    iframe.src = embedUrl;
    iframe.title = "Review video";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;

    media.appendChild(iframe);
    media.classList.add("is-playing");

    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", "Pause video");
    }
  }

  function bindMediaInteractions(root) {
    if (root.dataset.mediaBound === "true") return;
    root.dataset.mediaBound = "true";

    root.addEventListener("click", async (event) => {
      const videoTrigger = event.target.closest("[data-video-trigger='true']");
      if (videoTrigger && root.contains(videoTrigger)) {
        event.preventDefault();
        event.stopPropagation();

        const media = videoTrigger.closest("[data-video-container='true']");
        if (!media) return;

        await toggleNativeVideo(media, root);
        return;
      }

      const youtubeTrigger = event.target.closest("[data-youtube-trigger='true']");
      if (youtubeTrigger && root.contains(youtubeTrigger)) {
        event.preventDefault();
        event.stopPropagation();

        const media = youtubeTrigger.closest("[data-youtube-container='true']");
        if (!media) return;

        toggleYoutubeVideo(media, root);
      }
    });

    root.addEventListener(
      "ended",
      (event) => {
        const video = event.target;
        if (!video.classList.contains("prcc-video")) return;

        const media = video.closest("[data-video-container='true']");
        if (!media) return;

        media.classList.remove("is-playing");

        const toggleBtn = media.querySelector(".prcc-media-toggle");
        if (toggleBtn) {
          toggleBtn.setAttribute("aria-label", "Play video");
        }
      },
      true
    );
  }

  async function initCardsCarousel(root) {
    const config = getConfig(root);
    const headerEl = root.querySelector(".prcc-header");
    const wrapperEl = root.querySelector(".prcc-wrapper");
    const emptyEl = root.querySelector(".prcc-empty");

    try {
      await Promise.all([ensureSwiperStyle(), ensureSwiperScript()]);

      let reviews = [];

      if (config.showSampleReviews) {
        reviews = [...SAMPLE_REVIEWS];
      } else {
        reviews = await fetchReviews(config);
      }

      if (!reviews.length && config.showSampleReviews) {
        reviews = [...SAMPLE_REVIEWS];
      }

      reviews = dedupeReviews(reviews);
      reviews = applySelectionFilter(reviews, config);
      reviews = applyRatingFilter(reviews, config);
      reviews = sortReviews(reviews, config).slice(0, config.maxReviewNumber);

      if (!reviews.length) {
        renderEmpty(root, config, "No reviews found for this selection.");
        return;
      }

      if (headerEl) {
        headerEl.innerHTML = renderHeader(config, reviews);
      }

      if (wrapperEl) {
        wrapperEl.innerHTML = reviews
          .map((review) => renderCard(review, config))
          .join("");
      }

      if (emptyEl) {
        emptyEl.hidden = true;
      }

      initSwiper(root, config, reviews.length);
      bindMediaInteractions(root);
    } catch (error) {
      console.error("Cards carousel error:", error);
      renderEmpty(root, config, error.message || "Failed to load reviews.");
    }
  }

  function initAll(scope = document) {
    const roots = Array.from(scope.querySelectorAll(".prcc-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      if (root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initCardsCarousel(root);
    });
  }

  window.ReviewCardsCarouselApp = {
    initRoot(root) {
      if (!root || root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initCardsCarousel(root);
    },
    initAll(scope = document) {
      initAll(scope);
    },
  };
})(window, document);
