(function () {
  const ROOT_SELECTOR = ".rg-root";
  const MOBILE_BREAKPOINT = 749;

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

  function parseBoolean(value) {
    return String(value) === "true";
  }

  function parseNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeReviewType(value) {
    const reviewType = safeText(value).trim().toLowerCase();

    if (["product", "collection", "store"].includes(reviewType)) {
      return reviewType;
    }

    return "product";
  }

  function parseDateValue(dateValue) {
    if (!dateValue) return null;

    const parsedValue =
      typeof dateValue === "string" && /^\d+$/.test(dateValue)
        ? Number(dateValue)
        : dateValue;

    const date = new Date(parsedValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(dateValue) {
    const date = parseDateValue(dateValue);
    if (!date) return "";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatCompactDate(dateValue) {
    const date = parseDateValue(dateValue);
    if (!date) return "";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatRelativeDate(dateValue) {
    const date = parseDateValue(dateValue);
    if (!date) return "";

    const now = new Date();
    const diffMs = now - date;
    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.floor(diffMs / dayMs);

    if (days <= 0) return "Today";
    if (days === 1) return "1 day ago";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? "s" : ""} ago`;
    return formatCompactDate(dateValue);
  }

  function renderStars(rating) {
    const safeRating = clamp(Number(rating) || 0, 0, 5);
    return "★".repeat(Math.floor(safeRating)) + "☆".repeat(5 - Math.floor(safeRating));
  }

  function getInitial(name) {
    const cleanName = safeText(name).trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "A";
  }

  function normalizeYoutubeEmbedUrl(value) {
    if (!value) return null;

    const raw = String(value).trim();

    try {
      if (raw.includes("/embed/")) {
        const parsedEmbed = new URL(raw);
        const parts = parsedEmbed.pathname.split("/embed/");
        const videoId = parts[1]?.split("/")[0] || "";
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      const parsed = new URL(raw);

      if (
        parsed.hostname.includes("youtube.com") ||
        parsed.hostname.includes("youtu.be")
      ) {
        let videoId = "";

        if (parsed.hostname.includes("youtu.be")) {
          videoId = parsed.pathname.replace("/", "").trim();
        } else if (parsed.pathname === "/watch") {
          videoId = parsed.searchParams.get("v") || "";
        } else if (parsed.pathname.startsWith("/shorts/")) {
          videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        } else if (parsed.pathname.startsWith("/embed/")) {
          videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }

        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  function getYoutubeVideoId(value) {
    const embedUrl = normalizeYoutubeEmbedUrl(value);
    if (!embedUrl) return "";

    try {
      const parsed = new URL(embedUrl);
      return parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
    } catch {
      return "";
    }
  }

  function getYoutubeThumbnailUrl(value) {
    const videoId = getYoutubeVideoId(value);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
  }

  function normalizeImages(review) {
    if (Array.isArray(review?.reviewImages)) return review.reviewImages;
    if (Array.isArray(review?.images)) return review.images;
    return [];
  }

  function getReviewMediaItems(review) {
    const items = [];
    const images = normalizeImages(review);

    images.forEach((img, index) => {
      items.push({
        type: "image",
        src: img,
        thumbSrc: img,
        mediaKey: `${review.id || "review"}_image_${index}`,
      });
    });

    const uploadedVideo = safeText(review.reviewVideoUrl).trim();
    if (uploadedVideo) {
      items.push({
        type: "video",
        src: uploadedVideo,
        thumbSrc: uploadedVideo,
        mediaKey: `${review.id || "review"}_video_0`,
      });
    }

    const youtubeEmbed = normalizeYoutubeEmbedUrl(review.reviewYoutubeUrl);
    if (youtubeEmbed) {
      items.push({
        type: "youtube",
        src: youtubeEmbed,
        thumbSrc: getYoutubeThumbnailUrl(youtubeEmbed),
        mediaKey: `${review.id || "review"}_youtube_0`,
      });
    }

    return items;
  }

  function normalizeProxyReview(review) {
    const reviewType = normalizeReviewType(review.reviewType || "product");
    const mediaItems = getReviewMediaItems(review);

    return {
      ...review,
      id: safeText(review.id),
      reviewType,
      customerName: review.customerName || "Anonymous",
      customerEmail: review.customerEmail || "",
      rating: clamp(Number(review.rating) || 0, 0, 5),
      title: review.title || "",
      message: review.message || "",
      reviewImages: normalizeImages(review),
      reviewVideoUrl: review.reviewVideoUrl || "",
      reviewYoutubeUrl: review.reviewYoutubeUrl || "",
      helpfulCount: Number(review.helpfulCount || 0),
      isPinned: Boolean(review.isPinned),
      createdAt: review.createdAt || "",
      updatedAt: review.updatedAt || "",
      targetTitle:
        review.targetTitle ||
        review.productTitle ||
        (reviewType === "store" ? review.shop : "") ||
        "",
      mediaItems,
      hasMedia: mediaItems.length > 0,
    };
  }

  function svgDataUri(label, bg1, bg2, textColor) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="${bg1}" />
            <stop offset="100%" stop-color="${bg2}" />
          </linearGradient>
        </defs>
        <rect width="900" height="900" fill="url(#g)" rx="36" ry="36"/>
        <circle cx="710" cy="170" r="120" fill="rgba(255,255,255,0.12)"/>
        <circle cx="185" cy="725" r="160" fill="rgba(255,255,255,0.10)"/>
        <rect x="90" y="110" width="720" height="680" rx="28" fill="rgba(255,255,255,0.14)"/>
        <text x="450" y="430" text-anchor="middle" fill="${textColor}" font-size="52" font-family="Arial, sans-serif" font-weight="700">${label}</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function getSampleReviews(contextTitle) {
    const title = safeText(contextTitle).trim() || "Our Store";

    return [
      {
        id: "sample_1",
        shop: "sample-store.myshopify.com",
        reviewType: "product",
        targetTitle: title,
        customerName: "Emily R.",
        customerEmail: "",
        rating: 5,
        title: "Absolutely beautiful in person",
        message:
          "The texture feels premium and the finish is even better in real life. Super happy with the quality and delivery.",
        reviewImages: [svgDataUri("Cream Knit", "#e7dcc9", "#bba98c", "#ffffff")],
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
        helpfulCount: 12,
        isPinned: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "sample_2",
        shop: "sample-store.myshopify.com",
        reviewType: "product",
        targetTitle: title,
        customerName: "Emily R.",
        customerEmail: "",
        rating: 5,
        title: "The perfect winter sweater",
        message:
          "This sweater exceeded all my expectations. It is thick enough to keep me warm but still breathable indoors. The fit is flattering, the material is soft but structured, and it still looks brand new after multiple wears.",
        reviewImages: [svgDataUri("Folded Knit", "#5d4b43", "#d0c4b5", "#ffffff")],
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
        helpfulCount: 18,
        isPinned: false,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "sample_3",
        shop: "sample-store.myshopify.com",
        reviewType: "product",
        targetTitle: title,
        customerName: "Emily R.",
        customerEmail: "",
        rating: 4,
        title: "Loved the packaging",
        message:
          "Very neat presentation and the product looked exactly as expected. Great first impression and lovely detailing throughout.",
        reviewImages: [svgDataUri("Box Unboxing", "#ceb996", "#9f8860", "#ffffff")],
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
        helpfulCount: 5,
        isPinned: false,
        createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "sample_4",
        shop: "sample-store.myshopify.com",
        reviewType: "product",
        targetTitle: title,
        customerName: "Emily R.",
        customerEmail: "",
        rating: 5,
        title: "Video review",
        message:
          "I added a quick clip to show the color and finish. The fabric movement looks amazing and the piece feels very comfortable.",
        reviewImages: [],
        reviewVideoUrl: "",
        reviewYoutubeUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
        helpfulCount: 7,
        isPinned: false,
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "sample_5",
        shop: "sample-store.myshopify.com",
        reviewType: "product",
        targetTitle: title,
        customerName: "Jacob F.",
        customerEmail: "",
        rating: 4,
        title: "Looks great styled",
        message:
          "The product photographs well, feels soft, and works with multiple outfits. Really happy with the final look.",
        reviewImages: [svgDataUri("Styled Look", "#8f98a5", "#d8dde3", "#ffffff")],
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
        helpfulCount: 9,
        isPinned: false,
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ].map(normalizeProxyReview);
  }

  function getWidgetMarkup(config) {
    return `
      <div class="rg-shell">
        <div class="rg-header">
          <h2 class="rg-title">${escapeHtml(config.headerText || "From our customers")}</h2>

          <div class="rg-average-row ${config.showAverageRatingText ? "" : "is-hidden"}" id="rg-average-row">
            <span class="rg-average-text" id="rg-average-text"></span>
          </div>
        </div>

        <div class="rg-grid-wrap">
          <div class="rg-grid" id="rg-grid"></div>
        </div>

        <div class="rg-footer">
          <button type="button" class="rg-show-more-btn" id="rg-show-more-btn" hidden>
            Show more
          </button>
        </div>
      </div>
    `;
  }

  function getPortalMarkup() {
    return `
      <div class="rg-detail-modal" id="rg-detail-modal" hidden>
        <div class="rg-detail-overlay" data-rg-close-detail="true"></div>

        <div class="rg-detail-dialog" role="dialog" aria-modal="true" aria-label="Review details">
          <button type="button" class="rg-detail-close" id="rg-detail-close" aria-label="Close">
            ×
          </button>

          <div class="rg-detail-shell">
            <div class="rg-detail-media-pane">
              <button type="button" class="rg-detail-nav rg-detail-prev" id="rg-detail-prev" aria-label="Previous media">
                ‹
              </button>

              <div class="rg-detail-stage" id="rg-detail-stage"></div>

              <button type="button" class="rg-detail-nav rg-detail-next" id="rg-detail-next" aria-label="Next media">
                ›
              </button>

              <div class="rg-detail-thumbs-wrap">
                <div class="rg-detail-thumbs" id="rg-detail-thumbs"></div>
              </div>
            </div>

            <div class="rg-detail-content-pane">
              <div class="rg-detail-content" id="rg-detail-content"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function copyPortalTheme(root, portalHost) {
    const computed = window.getComputedStyle(root);
    const vars = [
      "--rg-max-width",
      "--rg-columns-desktop",
      "--rg-columns-mobile",
      "--rg-card-radius",
      "--rg-card-gap",
      "--rg-header-color",
      "--rg-overlay-color",
      "--rg-overlay-opacity",
      "--rg-content-color",
      "--rg-star-reviewer-color",
      "--rg-shadow-color",
    ];

    vars.forEach((name) => {
      const value = computed.getPropertyValue(name);
      if (value) {
        portalHost.style.setProperty(name, value.trim());
      }
    });

    portalHost.style.color = computed.color || "#111111";
    portalHost.style.fontFamily = computed.fontFamily || "inherit";
  }

  function initAll(scope = document) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));
    roots.forEach(initRoot);
  }

  function initRoot(root) {
    if (!root) return;
    if (root.dataset.initialized === "true") return;

    root.dataset.initialized = "true";

    const config = {
      blockId: root.dataset.blockId || "",
      endpoint: root.dataset.endpoint || "/apps/reviews",
      shop: root.dataset.shop || "",

      mainScript: root.dataset.mainScript || "",
      showSampleReviews: parseBoolean(root.dataset.showSampleReviews),
      reviewSelection: root.dataset.reviewSelection || "all_reviews",
      showReviewsWithMediaOnly: parseBoolean(root.dataset.showReviewsWithMediaOnly),
      displayOrder: root.dataset.displayOrder || "media_first",

      customProductId: root.dataset.customProductId || "",
      customProductTitle: root.dataset.customProductTitle || "",
      customProductImage: root.dataset.customProductImage || "",

      currentProductId: root.dataset.currentProductId || "",
      currentProductTitle: root.dataset.currentProductTitle || "",
      currentProductImage: root.dataset.currentProductImage || "",

      currentCollectionId: root.dataset.currentCollectionId || "",
      currentCollectionHandle: root.dataset.currentCollectionHandle || "",
      currentCollectionTitle: root.dataset.currentCollectionTitle || "",
      currentCollectionImage: root.dataset.currentCollectionImage || "",
      currentCollectionProductIds: root.dataset.currentCollectionProductIds || "",

      contextTitle: root.dataset.contextTitle || "",
      contextImage: root.dataset.contextImage || "",
      contextLabel: root.dataset.contextLabel || "",

      columnsDesktop: parseNumber(root.dataset.columnsDesktop, 3),
      rowsDesktop: parseNumber(root.dataset.rowsDesktop, 3),
      columnsMobile: parseNumber(root.dataset.columnsMobile, 2),
      rowsMobile: parseNumber(root.dataset.rowsMobile, 6),

      showStars: parseBoolean(root.dataset.showStars),
      showReviewerName: parseBoolean(root.dataset.showReviewerName),
      showReviewTitle: parseBoolean(root.dataset.showReviewTitle),
      headerText: root.dataset.headerText || "From our customers",
      showAverageRatingText: parseBoolean(root.dataset.showAverageRatingText),
    };

    root.innerHTML = getWidgetMarkup(config);

    const oldPortalId = root.dataset.portalId;
    if (oldPortalId) {
      const oldPortal = document.getElementById(oldPortalId);
      if (oldPortal) oldPortal.remove();
    }

    const portalHost = document.createElement("div");
    const portalId = `rg-portal-${Math.random().toString(36).slice(2, 11)}`;
    portalHost.id = portalId;
    portalHost.className = "rg-portal-root";
    copyPortalTheme(root, portalHost);
    portalHost.innerHTML = getPortalMarkup();
    document.body.appendChild(portalHost);
    root.dataset.portalId = portalId;

    const gridEl = root.querySelector("#rg-grid");
    const showMoreBtn = root.querySelector("#rg-show-more-btn");
    const averageTextEl = root.querySelector("#rg-average-text");
    const averageRowEl = root.querySelector("#rg-average-row");

    const detailModal = portalHost.querySelector("#rg-detail-modal");
    const detailClose = portalHost.querySelector("#rg-detail-close");
    const detailPrev = portalHost.querySelector("#rg-detail-prev");
    const detailNext = portalHost.querySelector("#rg-detail-next");
    const detailStage = portalHost.querySelector("#rg-detail-stage");
    const detailThumbs = portalHost.querySelector("#rg-detail-thumbs");
    const detailContent = portalHost.querySelector("#rg-detail-content");

    let allReviews = [];
    let renderedReviews = [];
    let visibleCount = 0;
    let detailReview = null;
    let detailMediaList = [];
    let detailMediaIndex = 0;
    let resizeTimer = null;

    function setBodyLock(locked) {
      document.body.style.overflow = locked ? "hidden" : "";
    }

    function getPageSize() {
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const columns = isMobile ? config.columnsMobile : config.columnsDesktop;
      const rows = isMobile ? config.rowsMobile : config.rowsDesktop;
      return Math.max(1, columns * rows);
    }

    function getShortExcerpt(message, maxLength = 120) {
      const clean = safeText(message).trim();
      if (!clean) return "";
      if (clean.length <= maxLength) return clean;
      return `${clean.slice(0, maxLength).trim()}…`;
    }

    function buildRequests() {
      const requests = [];
      const endpoint = config.endpoint;
      const shop = config.shop;

      function pushRequest(paramsObj) {
        const params = new URLSearchParams();
        Object.keys(paramsObj).forEach((key) => {
          const value = paramsObj[key];
          if (value !== null && value !== undefined && value !== "") {
            params.set(key, String(value));
          }
        });

        requests.push(`${endpoint}?${params.toString()}`);
      }

      const common = {
        shop,
        approvedOnly: "true",
      };

      if (config.reviewSelection === "store_reviews") {
        pushRequest({
          ...common,
          reviewType: "store",
        });
      } else if (config.reviewSelection === "current_product" && config.currentProductId) {
        pushRequest({
          ...common,
          reviewType: "product",
          targetId: config.currentProductId,
        });
      } else if (config.reviewSelection === "custom_product" && config.customProductId) {
        pushRequest({
          ...common,
          reviewType: "product",
          targetId: config.customProductId,
        });
      } else if (config.reviewSelection === "current_collection") {
        pushRequest({
          ...common,
          reviewType: "collection",
          targetId: config.currentCollectionId || "",
          targetHandle: config.currentCollectionHandle || "",
        });
      } else {
        pushRequest({
          ...common,
          reviewType: "store",
        });

        pushRequest({
          ...common,
          reviewType: "product",
        });

        if (config.currentCollectionId || config.currentCollectionHandle) {
          pushRequest({
            ...common,
            reviewType: "collection",
            targetId: config.currentCollectionId || "",
            targetHandle: config.currentCollectionHandle || "",
          });
        }
      }

      return requests;
    }

    function dedupeReviews(reviews) {
      const map = new Map();

      reviews.forEach((review, index) => {
        const id = safeText(review.id) || `review_${index}`;
        if (!map.has(id)) {
          map.set(id, review);
        }
      });

      return Array.from(map.values());
    }

    function sortReviews(reviews) {
      const sorted = [...reviews];

      if (config.displayOrder === "oldest") {
        sorted.sort((a, b) => {
          const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
          const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          return aTime - bTime;
        });
        return sorted;
      }

      if (config.displayOrder === "highest_rating") {
        sorted.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          if (b.rating !== a.rating) return b.rating - a.rating;
          const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
          const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        return sorted;
      }

      if (config.displayOrder === "lowest_rating") {
        sorted.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          if (a.rating !== b.rating) return a.rating - b.rating;
          const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
          const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        return sorted;
      }

      if (config.displayOrder === "media_first") {
        sorted.sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          if (a.hasMedia !== b.hasMedia) return a.hasMedia ? -1 : 1;
          if (b.rating !== a.rating) return b.rating - a.rating;
          const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
          const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        return sorted;
      }

      sorted.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
        const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });

      return sorted;
    }

    function filterReviews(reviews) {
      let next = [...reviews];

      if (config.showReviewsWithMediaOnly) {
        next = next.filter((review) => review.hasMedia);
      }

      return next;
    }

    function updateAverageText() {
      if (!averageTextEl || !averageRowEl) return;

      if (!config.showAverageRatingText) {
        averageRowEl.classList.add("is-hidden");
        return;
      }

      if (!allReviews.length) {
        averageTextEl.textContent = "";
        averageRowEl.classList.add("is-hidden");
        return;
      }

      averageRowEl.classList.remove("is-hidden");

      const total = allReviews.length;
      const average =
        total > 0
          ? allReviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / total
          : 0;

      averageTextEl.textContent = `${average.toFixed(1)} ★ (${total})`;
    }

    function renderGridCardMedia(review) {
      const mediaItems = review.mediaItems || [];
      const first = mediaItems[0];

      if (!first) {
        return `
          <div class="rg-card-media rg-card-media--placeholder">
            <div class="rg-card-placeholder-initial">${escapeHtml(getInitial(review.customerName))}</div>
          </div>
        `;
      }

      if (first.type === "image") {
        return `
          <div class="rg-card-media">
            <img src="${escapeHtml(first.src)}" alt="${escapeHtml(review.title || review.customerName || "Review media")}" loading="lazy">
          </div>
        `;
      }

      if (first.type === "youtube") {
        return `
          <div class="rg-card-media rg-card-media--video">
            <img src="${escapeHtml(first.thumbSrc)}" alt="${escapeHtml(review.title || "Review video")}" loading="lazy">
            <span class="rg-play-badge" aria-hidden="true">▶</span>
          </div>
        `;
      }

      return `
        <div class="rg-card-media rg-card-media--video">
          <video src="${escapeHtml(first.src)}" muted playsinline preload="metadata"></video>
          <span class="rg-play-badge" aria-hidden="true">▶</span>
        </div>
      `;
    }

    function renderGridCard(review, index) {
      const reviewId = safeText(review.id || index);
      const hasTitle = config.showReviewTitle && safeText(review.title).trim();
      const hasName = config.showReviewerName && safeText(review.customerName).trim();
      const hasStars = config.showStars;

      return `
        <button
          type="button"
          class="rg-card ${review.isPinned ? "is-pinned" : ""}"
          data-rg-open-detail="${escapeHtml(reviewId)}"
          aria-label="Open review details"
        >
          ${renderGridCardMedia(review)}

          <div class="rg-card-overlay"></div>

          <div class="rg-card-hover-copy">
            ${
              hasTitle
                ? `<div class="rg-card-title">${escapeHtml(review.title)}</div>`
                : ""
            }
            <div class="rg-card-excerpt">${escapeHtml(getShortExcerpt(review.message, 130))}</div>
          </div>

          <div class="rg-card-meta">
            ${
              hasStars
                ? `<div class="rg-card-stars">${escapeHtml(renderStars(review.rating))}</div>`
                : ""
            }

            ${
              hasName
                ? `<div class="rg-card-name">${escapeHtml(review.customerName)}</div>`
                : ""
            }
          </div>
        </button>
      `;
    }

    function renderEmptyState() {
      if (!gridEl) return;

      gridEl.innerHTML = `
        <div class="rg-empty">
          <div class="rg-empty-icon">★</div>
          <h3 class="rg-empty-title">No reviews found</h3>
          <p class="rg-empty-text">There are no reviews available for this selection yet.</p>
        </div>
      `;

      if (showMoreBtn) {
        showMoreBtn.hidden = true;
      }
    }

    function bindGridInteractions() {
      Array.from(root.querySelectorAll("[data-rg-open-detail]")).forEach((card) => {
        card.addEventListener("click", () => {
          const reviewId = card.getAttribute("data-rg-open-detail");
          openDetailModal(reviewId);
        });
      });
    }

    function updateShowMoreButton() {
      if (!showMoreBtn) return;

      if (visibleCount >= renderedReviews.length) {
        showMoreBtn.hidden = true;
        return;
      }

      showMoreBtn.hidden = false;
      showMoreBtn.textContent = "Show more";
    }

    function renderGrid() {
      if (!gridEl) return;

      if (!renderedReviews.length) {
        renderEmptyState();
        return;
      }

      const slice = renderedReviews.slice(0, visibleCount);
      gridEl.innerHTML = slice.map(renderGridCard).join("");
      bindGridInteractions();
      updateShowMoreButton();
    }

    function renderDetailStage() {
      if (!detailStage || !detailMediaList.length) return;

      const item = detailMediaList[detailMediaIndex];
      if (!item) return;

      if (item.type === "image") {
        detailStage.innerHTML = `
          <img src="${escapeHtml(item.src)}" alt="Review media">
        `;
        return;
      }

      if (item.type === "video") {
        detailStage.innerHTML = `
          <video src="${escapeHtml(item.src)}" controls playsinline autoplay></video>
        `;
        return;
      }

      const autoplaySrc = item.src.includes("?")
        ? `${item.src}&autoplay=1`
        : `${item.src}?autoplay=1`;

      detailStage.innerHTML = `
        <iframe
          src="${escapeHtml(autoplaySrc)}"
          title="Review video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      `;
    }

    function renderDetailThumbs() {
      if (!detailThumbs) return;

      if (!detailMediaList.length) {
        detailThumbs.innerHTML = "";
        return;
      }

      detailThumbs.innerHTML = detailMediaList
        .map((item, index) => {
          const activeClass = index === detailMediaIndex ? "is-active" : "";

          if (item.type === "image") {
            return `
              <button
                type="button"
                class="rg-detail-thumb ${activeClass}"
                data-rg-thumb-index="${index}"
                aria-label="Open media ${index + 1}"
              >
                <img src="${escapeHtml(item.src)}" alt="Review media thumbnail">
              </button>
            `;
          }

          if (item.type === "youtube") {
            return `
              <button
                type="button"
                class="rg-detail-thumb ${activeClass}"
                data-rg-thumb-index="${index}"
                aria-label="Open media ${index + 1}"
              >
                <img src="${escapeHtml(item.thumbSrc)}" alt="Review video thumbnail">
              </button>
            `;
          }

          return `
            <button
              type="button"
              class="rg-detail-thumb ${activeClass}"
              data-rg-thumb-index="${index}"
              aria-label="Open media ${index + 1}"
            >
              <video src="${escapeHtml(item.src)}" muted playsinline preload="metadata"></video>
            </button>
          `;
        })
        .join("");

      Array.from(detailThumbs.querySelectorAll("[data-rg-thumb-index]")).forEach((thumb) => {
        thumb.addEventListener("click", () => {
          detailMediaIndex = Number(thumb.getAttribute("data-rg-thumb-index")) || 0;
          renderDetailStage();
          renderDetailThumbs();
        });
      });
    }

    function renderDetailContent() {
      if (!detailContent || !detailReview) return;

      const review = detailReview;
      const avatar = getInitial(review.customerName);

      detailContent.innerHTML = `
        <div class="rg-detail-rating">${escapeHtml(renderStars(review.rating))}</div>

        <div class="rg-detail-author-row">
          <div class="rg-detail-avatar">${escapeHtml(avatar)}</div>

          <div class="rg-detail-author-meta">
            <div class="rg-detail-author-name-wrap">
              <div class="rg-detail-author-name">${escapeHtml(review.customerName)}</div>
              <span class="rg-detail-verified">Verified</span>
            </div>
            <div class="rg-detail-date">${escapeHtml(formatDate(review.createdAt))}</div>
          </div>
        </div>

        ${
          review.title
            ? `<h3 class="rg-detail-title">${escapeHtml(review.title)}</h3>`
            : ""
        }

        <div class="rg-detail-message">${escapeHtml(review.message).replace(/\n/g, "<br>")}</div>

        <div class="rg-detail-footer-meta">
          <span>${escapeHtml(formatRelativeDate(review.createdAt))}</span>
          <span>•</span>
          <span>${Number(review.helpfulCount || 0)} found this helpful</span>
        </div>
      `;
    }

    function renderDetailModal() {
      renderDetailStage();
      renderDetailThumbs();
      renderDetailContent();

      if (detailPrev) {
        detailPrev.hidden = detailMediaList.length <= 1;
      }

      if (detailNext) {
        detailNext.hidden = detailMediaList.length <= 1;
      }
    }

    function openDetailModal(reviewId) {
      const review = allReviews.find((item) => String(item.id) === String(reviewId));
      if (!review || !detailModal) return;

      detailReview = review;
      detailMediaList = review.mediaItems || [];
      detailMediaIndex = 0;

      if (!detailMediaList.length) {
        detailMediaList = [
          {
            type: "image",
            src:
              config.contextImage ||
              svgDataUri("Review", "#d1d5db", "#9ca3af", "#ffffff"),
            thumbSrc:
              config.contextImage ||
              svgDataUri("Review", "#d1d5db", "#9ca3af", "#ffffff"),
            mediaKey: "fallback",
          },
        ];
      }

      renderDetailModal();
      detailModal.hidden = false;
      setBodyLock(true);
    }

    function closeDetailModal() {
      if (!detailModal) return;
      detailModal.hidden = true;
      detailStage.innerHTML = "";
      setBodyLock(false);
    }

    function showPrevMedia() {
      if (!detailMediaList.length) return;
      detailMediaIndex = (detailMediaIndex - 1 + detailMediaList.length) % detailMediaList.length;
      renderDetailModal();
    }

    function showNextMedia() {
      if (!detailMediaList.length) return;
      detailMediaIndex = (detailMediaIndex + 1) % detailMediaList.length;
      renderDetailModal();
    }

    function bindDetailModal() {
      detailClose?.addEventListener("click", closeDetailModal);
      detailPrev?.addEventListener("click", showPrevMedia);
      detailNext?.addEventListener("click", showNextMedia);

      detailModal?.addEventListener("click", (event) => {
        if (event.target.closest("[data-rg-close-detail='true']")) {
          closeDetailModal();
        }
      });
    }

    function renderLoadingState() {
      if (!gridEl) return;

      const pageSize = getPageSize();
      const skeletonCount = Math.max(4, Math.min(pageSize, 12));

      gridEl.innerHTML = Array.from({ length: skeletonCount })
        .map(
          () => `
            <div class="rg-skeleton-card rg-skeleton-card--grid"></div>
          `
        )
        .join("");

      if (showMoreBtn) {
        showMoreBtn.hidden = true;
      }

      if (averageTextEl) {
        averageTextEl.textContent = "";
      }
    }

    function renderErrorState(message) {
      if (!gridEl) return;

      gridEl.innerHTML = `
        <div class="rg-error-box">
          ${escapeHtml(message || "Failed to load reviews grid.")}
        </div>
      `;

      if (showMoreBtn) {
        showMoreBtn.hidden = true;
      }

      if (averageTextEl) {
        averageTextEl.textContent = "";
      }
    }

    async function fetchJson(url) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to fetch reviews");
      }

      return result;
    }

    async function loadReviews() {
      renderLoadingState();

      try {
        if (config.showSampleReviews) {
          allReviews = getSampleReviews(config.contextTitle);
        } else {
          const requests = buildRequests();
          const responses = await Promise.all(
            requests.map((url) =>
              fetchJson(url).catch(() => ({
                success: false,
                data: [],
              }))
            )
          );

          const merged = responses.flatMap((response) =>
            Array.isArray(response.data) ? response.data : []
          );

          allReviews = dedupeReviews(merged.map(normalizeProxyReview));
        }

        allReviews = filterReviews(sortReviews(allReviews));
        renderedReviews = [...allReviews];
        visibleCount = Math.max(getPageSize(), visibleCount || 0);
        updateAverageText();
        renderGrid();
      } catch (error) {
        renderErrorState(error.message || "Failed to load reviews");
      }
    }

    function handleShowMore() {
      const pageSize = getPageSize();
      visibleCount += pageSize;
      renderGrid();
    }

    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const minVisible = getPageSize();
        if (visibleCount < minVisible) {
          visibleCount = minVisible;
        }
        renderGrid();
      }, 120);
    }

    showMoreBtn?.addEventListener("click", handleShowMore);

    document.addEventListener("keydown", (event) => {
      if (detailModal && !detailModal.hidden) {
        if (event.key === "Escape") {
          closeDetailModal();
        } else if (event.key === "ArrowLeft") {
          showPrevMedia();
        } else if (event.key === "ArrowRight") {
          showNextMedia();
        }
      }
    });

    bindDetailModal();
    window.addEventListener("resize", handleResize);
    loadReviews();
  }

  window.ReviewsGridMain = {
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
