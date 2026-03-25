document.addEventListener("DOMContentLoaded", async () => {
  const roots = Array.from(document.querySelectorAll(".prcc-root"));
  if (!roots.length) return;

  await Promise.all([ensureSwiperStyle(), ensureSwiperScript()]);

  roots.forEach((root) => {
    if (root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";
    initCardsCarousel(root);
  });
});

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
  },
  {
    id: "sample-4",
    customerName: "Aline D.",
    productTitle: "Classic Cable Knit Sweater",
    rating: 5,
    message:
      "J'adore ce pull. Il est chaud, doux et très bien coupé. Il garde bien sa forme même après lavage.",
    reviewImages: [],
    reviewVideoUrl: null,
    reviewYoutubeUrl: null,
    createdAt: new Date().toISOString(),
    isPinned: false,
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
  },
];

function ensureSwiperStyle() {
  return new Promise((resolve) => {
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
}

function ensureSwiperScript() {
  return new Promise((resolve, reject) => {
    if (window.Swiper) {
      resolve();
      return;
    }

    const existing = document.getElementById("prcc-swiper-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Swiper"))
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
  if (Array.isArray(review?.reviewImages)) return review.reviewImages;
  if (Array.isArray(review?.images)) return review.images;
  return [];
}

function formatStars(rating) {
  const full = "★".repeat(
    Math.max(0, Math.min(5, Math.floor(Number(rating) || 0)))
  );
  const empty = "☆".repeat(5 - full.length);
  return `${full}${empty}`;
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
  return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&controls=0&modestbranding=1&disablekb=1${autoplay ? "&autoplay=1" : ""}`;
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
      <div
        class="prcc-media prcc-media--video"
        data-video-container="true"
      >
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
  };
}

function buildQueryUrl(config) {
  const params = new URLSearchParams();
  params.set("approvedOnly", "true");
  params.set("limit", String(config.maxReviewNumber));

  const selection = config.reviewsSelection;

  if (selection === "current_product" && config.currentProductId) {
    params.set("productId", config.currentProductId);
    if (config.shop) params.set("shop", config.shop);
  } else if (
    selection === "current_collection" &&
    config.currentCollectionProductIds.length
  ) {
    params.set("productIds", config.currentCollectionProductIds.join(","));
    if (config.shop) params.set("shop", config.shop);
  } else if (
    selection === "custom_products" &&
    config.customProductIds.length
  ) {
    params.set("productIds", config.customProductIds.join(","));
    if (config.shop) params.set("shop", config.shop);
  } else {
    if (config.shop) params.set("shop", config.shop);

    if (selection === "featured") {
      params.set("featuredOnly", "true");
    }
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

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to fetch carousel reviews");
  }

  return Array.isArray(result.data) ? result.data : [];
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
              <span class="prcc-count">( ${count} )</span>
              <span class="prcc-verified">Verified</span>
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
    } catch {
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
    let reviews = [];

    if (config.showSampleReviews) {
      reviews = [...SAMPLE_REVIEWS];
    } else {
      reviews = await fetchReviews(config);
    }

    if (!reviews.length && config.showSampleReviews) {
      reviews = [...SAMPLE_REVIEWS];
    }

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
