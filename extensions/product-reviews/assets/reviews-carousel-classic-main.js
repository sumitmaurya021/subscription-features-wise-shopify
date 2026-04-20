(function () {
  const ROOT_SELECTOR = ".rcc-root";
  const GLOBAL_KEY = "ReviewsCarouselClassicMain";
  const MOBILE_BREAKPOINT = 768;
  const TABLET_BREAKPOINT = 1024;

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toBoolean(value, fallback) {
    if (value === true || value === false) return value;

    const normalized = safeText(value).trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;

    return fallback;
  }

  function normalizeReviewType(value) {
    const normalized = safeText(value).trim().toLowerCase();

    if (["product", "collection", "store"].includes(normalized)) {
      return normalized;
    }

    return "product";
  }

  function formatDate(value) {
    if (!value) return "";

    const raw = /^\d+$/.test(safeText(value)) ? Number(value) : value;
    const date = new Date(raw);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function renderStars(rating) {
    const safeRating = Math.max(
      0,
      Math.min(5, Math.round(Number(rating) || 0))
    );

    return "★".repeat(safeRating) + "☆".repeat(5 - safeRating);
  }

  function getYoutubeEmbedUrl(value) {
    if (!value) return "";

    try {
      const raw = safeText(value).trim();
      if (!raw) return "";

      if (raw.includes("/embed/")) {
        const embedParsed = new URL(raw);
        const embedId =
          embedParsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        return embedId ? `https://www.youtube.com/embed/${embedId}` : "";
      }

      const parsed = new URL(raw);

      if (
        !parsed.hostname.includes("youtube.com") &&
        !parsed.hostname.includes("youtu.be")
      ) {
        return "";
      }

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

      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    } catch {
      return "";
    }
  }

  function getYoutubeThumb(value) {
    const embed = getYoutubeEmbedUrl(value);
    if (!embed) return "";

    try {
      const parsed = new URL(embed);
      const videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
      return videoId
        ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        : "";
    } catch {
      return "";
    }
  }

  function getInitials(name) {
    const clean = safeText(name).trim();
    if (!clean) return "A";

    const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
    const text = parts
      .map((item) => item.charAt(0).toUpperCase())
      .join("");

    return text || "A";
  }

  function normalizeImages(review) {
    if (Array.isArray(review?.reviewImages)) {
      return review.reviewImages.filter(Boolean);
    }

    if (Array.isArray(review?.images)) {
      return review.images.filter(Boolean);
    }

    return [];
  }

  function getPrimaryMedia(review, settings) {
    const images = normalizeImages(review);

    if (images.length) {
      return { type: "image", src: images[0] };
    }

    if (review?.reviewYoutubeUrl) {
      const thumb = getYoutubeThumb(review.reviewYoutubeUrl);
      if (thumb) return { type: "youtube", src: thumb };
    }

    if (review?.reviewVideoUrl) {
      return { type: "video", src: review.reviewVideoUrl };
    }

    if (settings.contextImage) {
      return { type: "context", src: settings.contextImage };
    }

    return null;
  }

  function getTargetName(review, settings) {
    return (
      review?.targetTitle ||
      review?.productTitle ||
      settings.targetTitle ||
      settings.productTitle ||
      settings.contextLabel ||
      ""
    );
  }

  function buildHeaderText(template, count) {
    const text = safeText(template) || "from [n] reviews";

    return text
      .replace(/{{\s*n\s*}}/gi, String(count))
      .replace(/{{\s*count\s*}}/gi, String(count))
      .replace(/\[\s*n\s*\]/gi, String(count))
      .replace(/\[\s*count\s*\]/gi, String(count));
  }

  function getSlidesPerView(settings) {
    const width =
      window.innerWidth || document.documentElement.clientWidth || 1440;

    if (settings.widgetTheme === "focused_view") {
      return 1;
    }

    if (settings.widgetTheme === "vertical_sliding") {
      if (width < MOBILE_BREAKPOINT) return 1;
      if (width < TABLET_BREAKPOINT) {
        return Math.max(1, Math.min(2, settings.tabletReviews));
      }
      return Math.max(1, Math.min(2, settings.desktopReviews));
    }

    if (width < MOBILE_BREAKPOINT) {
      return Math.max(1, settings.mobileReviews);
    }

    if (width < TABLET_BREAKPOINT) {
      return Math.max(1, settings.tabletReviews);
    }

    return Math.max(1, settings.desktopReviews);
  }

  function buildSettings(root) {
    return {
      rootId: root.id || `rcc-${Math.random().toString(36).slice(2, 9)}`,
      blockId: safeText(root.dataset.blockId).trim(),
      sectionId: safeText(root.dataset.sectionId).trim(),

      endpoint: safeText(root.dataset.endpoint).trim() || "/apps/reviews",
      shop: safeText(root.dataset.shop).trim(),
      reviewType: normalizeReviewType(root.dataset.reviewType),
      targetId: safeText(root.dataset.targetId).trim(),
      targetHandle: safeText(root.dataset.targetHandle).trim(),
      targetTitle: safeText(root.dataset.targetTitle).trim(),
      contextLabel: safeText(root.dataset.contextLabel).trim(),
      contextSubheading: safeText(root.dataset.contextSubheading).trim(),
      contextImage: safeText(root.dataset.contextImage).trim(),
      productId: safeText(root.dataset.productId).trim(),
      productTitle: safeText(root.dataset.productTitle).trim(),

      reviewCuration: safeText(root.dataset.reviewCuration).trim(),
      onlyMedia: toBoolean(root.dataset.onlyMedia, false),
      featuredOnly: toBoolean(root.dataset.featuredOnly, false),
      starRating: safeText(root.dataset.starRating).trim(),
      minRating: safeText(root.dataset.minRating).trim(),

      widgetTheme: safeText(root.dataset.widgetTheme).trim() || "compact",
      arrowPosition: safeText(root.dataset.arrowPosition).trim() || "below",

      showHeader: toBoolean(root.dataset.showHeader, true),
      headerTitle:
        safeText(root.dataset.headerTitle).trim() ||
        "Let customers speak for us",
      headerText:
        safeText(root.dataset.headerText).trim() || "from [n] reviews",
      emptyText: safeText(root.dataset.emptyText).trim() || "No reviews yet",
      loadingText:
        safeText(root.dataset.loadingText).trim() || "Loading reviews...",

      showAiSummary: toBoolean(root.dataset.showAiSummary, false),
      aiSummaryHeading:
        safeText(root.dataset.aiSummaryHeading).trim() || "AI review summary",

      showReviewRating: toBoolean(root.dataset.showReviewRating, true),
      showReviewTitle: toBoolean(root.dataset.showReviewTitle, true),
      showReviewBody: toBoolean(root.dataset.showReviewBody, true),
      showReviewDate: toBoolean(root.dataset.showReviewDate, true),
      showReviewerName: toBoolean(root.dataset.showReviewerName, true),
      showProductName: toBoolean(root.dataset.showProductName, false),
      showVerifiedBadge: toBoolean(root.dataset.showVerifiedBadge, true),
      showAverageRating: toBoolean(root.dataset.showAverageRating, true),

      enableAutoplay: toBoolean(root.dataset.enableAutoplay, true),
      pauseOnHover: toBoolean(root.dataset.pauseOnHover, true),
      enableSwipe: toBoolean(root.dataset.enableSwipe, true),
      loop: toBoolean(root.dataset.loop, true),

      desktopReviews: Math.max(1, toNumber(root.dataset.desktopReviews, 3)),
      tabletReviews: Math.max(1, toNumber(root.dataset.tabletReviews, 2)),
      mobileReviews: Math.max(1, toNumber(root.dataset.mobileReviews, 1)),
      autoslideInterval:
        Math.max(0, toNumber(root.dataset.autoslideInterval, 5)) * 1000,

      blockHeight: Math.max(180, toNumber(root.dataset.blockHeight, 250)),
      pageWidth: Math.max(
        50,
        Math.min(100, toNumber(root.dataset.pageWidth, 80))
      ),
      cardGap: Math.max(0, toNumber(root.dataset.cardGap, 20)),
      borderRadius: Math.max(0, toNumber(root.dataset.borderRadius, 14)),

      imageRatio: safeText(root.dataset.imageRatio).trim() || "square",
      textAlign: safeText(root.dataset.textAlign).trim() || "left",

      accentColor: safeText(root.dataset.accentColor).trim() || "#149c9c",
      starColor: safeText(root.dataset.starColor).trim() || "#149c9c",
      textColor: safeText(root.dataset.textColor).trim() || "#111827",
      mutedTextColor:
        safeText(root.dataset.mutedTextColor).trim() || "#6b7280",
      cardBackground:
        safeText(root.dataset.cardBackground).trim() || "#ffffff",
      sectionBackground:
        safeText(root.dataset.sectionBackground).trim() || "#ffffff",
      borderColor: safeText(root.dataset.borderColor).trim() || "#e5e7eb",
      arrowColor: safeText(root.dataset.arrowColor).trim() || "#c7c9d1",
      shadowColor:
        safeText(root.dataset.shadowColor).trim() ||
        "rgba(15, 23, 42, 0.08)",

      sectionPaddingTop: Math.max(
        0,
        toNumber(root.dataset.sectionPaddingTop, 10)
      ),
      sectionPaddingBottom: Math.max(
        0,
        toNumber(root.dataset.sectionPaddingBottom, 10)
      ),

      customCss: safeText(root.dataset.customCss),
    };
  }

  function applyThemeVars(root, settings) {
    root.style.setProperty("--rcc-accent", settings.accentColor);
    root.style.setProperty("--rcc-star", settings.starColor);
    root.style.setProperty("--rcc-text", settings.textColor);
    root.style.setProperty("--rcc-muted", settings.mutedTextColor);
    root.style.setProperty("--rcc-card-bg", settings.cardBackground);
    root.style.setProperty("--rcc-section-bg", settings.sectionBackground);
    root.style.setProperty("--rcc-border", settings.borderColor);
    root.style.setProperty("--rcc-arrow", settings.arrowColor);
    root.style.setProperty("--rcc-shadow", settings.shadowColor);
    root.style.setProperty("--rcc-gap", `${settings.cardGap}px`);
    root.style.setProperty("--rcc-radius", `${settings.borderRadius}px`);
    root.style.setProperty("--rcc-block-height", `${settings.blockHeight}px`);
    root.style.setProperty("--rcc-page-width", `${settings.pageWidth}%`);
    root.style.setProperty(
      "--rcc-section-padding-top",
      `${settings.sectionPaddingTop}px`
    );
    root.style.setProperty(
      "--rcc-section-padding-bottom",
      `${settings.sectionPaddingBottom}px`
    );
  }

  function injectCustomCss(root, settings) {
    const styleId = `${settings.rootId}-custom-style`;
    const existing = document.getElementById(styleId);

    if (existing) existing.remove();

    const css = safeText(settings.customCss).trim();
    if (!css) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getAiSummary(reviews, settings) {
    if (!reviews.length) return "";

    const avg =
      reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) /
      reviews.length;

    const words = new Map();

    const stopWords = new Set([
      "this",
      "that",
      "with",
      "from",
      "have",
      "very",
      "good",
      "great",
      "nice",
      "really",
      "after",
      "about",
      "they",
      "them",
      "your",
      "ours",
      "were",
      "been",
      "into",
      "than",
      "just",
      "more",
      "best",
      "love",
      "liked",
      "will",
      "would",
      "when",
      "what",
      "product",
      "store",
      "collection",
      "review",
      "reviews",
      "sample",
      "quality",
      "looks",
      "look",
      "feel",
      "feels",
    ]);

    reviews.forEach((review) => {
      const text = `${safeText(review.title)} ${safeText(
        review.message
      )}`.toLowerCase();

      text
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4 && !stopWords.has(word))
        .forEach((word) => {
          words.set(word, (words.get(word) || 0) + 1);
        });
    });

    const topWords = Array.from(words.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((item) => item[0]);

    const tone =
      avg >= 4.5
        ? "Customers are highly satisfied"
        : avg >= 4
        ? "Customers are mostly positive"
        : avg >= 3
        ? "Customers have mixed feedback"
        : "Customers mention several issues";

    const targetName =
      settings.targetTitle || settings.contextLabel || "this item";
    const keywordText = topWords.length
      ? ` Common mentions include ${topWords.join(", ")}.`
      : "";

    return `${tone} about ${targetName}. Average rating is ${avg.toFixed(
      1
    )}/5 across ${reviews.length} review${
      reviews.length !== 1 ? "s" : ""
    }.${keywordText}`;
  }

  function buildRequestUrl(settings) {
    const params = new URLSearchParams();

    params.set("shop", settings.shop);
    params.set("approvedOnly", "true");
    params.set("reviewType", settings.reviewType);
    params.set("limit", "15");
    params.set("page", "1");

    if (settings.reviewType === "product") {
      const resolvedTargetId = settings.targetId || settings.productId;
      if (resolvedTargetId) params.set("targetId", resolvedTargetId);
    } else if (settings.reviewType === "collection") {
      if (settings.targetId) params.set("targetId", settings.targetId);
      if (settings.targetHandle) {
        params.set("targetHandle", settings.targetHandle);
      }
    }

    if (settings.onlyMedia) params.set("onlyMedia", "true");
    if (settings.featuredOnly) params.set("featuredOnly", "true");
    if (settings.starRating) params.set("starRating", settings.starRating);
    if (settings.minRating) params.set("minRating", settings.minRating);

    return `${settings.endpoint}?${params.toString()}`;
  }

  function renderLoading(root, settings) {
    root.setAttribute("aria-busy", "true");
    applyThemeVars(root, settings);

    root.innerHTML = `
      <div class="rcc-widget rcc-theme--${escapeHtml(settings.widgetTheme)}">
        <div class="rcc-shell" style="width:${settings.pageWidth}%;">
          <div
            class="rcc-loading-state"
            style="min-height:${settings.blockHeight}px;"
            role="status"
            aria-live="polite"
            aria-label="${escapeHtml(settings.loadingText)}"
          >
            <div class="rcc-spinner-loader" aria-hidden="true">
              <span class="rcc-spinner-loader__track"></span>
              <span class="rcc-spinner-loader__segment"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderError(root, settings, message) {
    root.setAttribute("aria-busy", "false");
    applyThemeVars(root, settings);

    root.innerHTML = `
      <div class="rcc-widget rcc-widget--error rcc-theme--${escapeHtml(
        settings.widgetTheme
      )}">
        <div class="rcc-shell" style="width:${settings.pageWidth}%;">
          <div class="rcc-error-box" role="alert">
            ${escapeHtml(message || "Failed to load reviews")}
          </div>
        </div>
      </div>
    `;
  }

  function renderMedia(media, review, settings) {
    if (!media) {
      return `
        <div class="rcc-card-media rcc-card-media--placeholder">
          <span>${escapeHtml(
            getInitials(review.customerName || settings.targetTitle || "A")
          )}</span>
        </div>
      `;
    }

    const ratioClass = `rcc-media-ratio--${escapeHtml(settings.imageRatio)}`;

    if (media.type === "youtube") {
      return `
        <div class="rcc-card-media ${ratioClass}">
          <img src="${escapeHtml(media.src)}" alt="Review media" loading="lazy">
          <span class="rcc-media-play">▶</span>
        </div>
      `;
    }

    if (media.type === "video") {
      return `
        <div class="rcc-card-media ${ratioClass}">
          <video src="${escapeHtml(
            media.src
          )}" muted playsinline preload="metadata"></video>
          <span class="rcc-media-play">▶</span>
        </div>
      `;
    }

    return `
      <div class="rcc-card-media ${ratioClass}">
        <img src="${escapeHtml(media.src)}" alt="Review media" loading="lazy">
      </div>
    `;
  }

  function getCardClasses(settings) {
    const classes = ["rcc-card", `rcc-card--${settings.widgetTheme}`];

    if (settings.textAlign === "center") classes.push("rcc-card--center");
    if (settings.widgetTheme === "focused_view") classes.push("rcc-card--focused");
    if (settings.widgetTheme === "vertical_sliding") {
      classes.push("rcc-card--vertical");
    }

    return classes.join(" ");
  }

  function renderCompactReviewCard(review, settings) {
    const ratingHtml = settings.showReviewRating
      ? `<div class="rcc-card-stars" aria-label="${escapeHtml(
          String(review.rating || 0)
        )} out of 5 stars">${escapeHtml(renderStars(review.rating))}</div>`
      : "";

    const titleHtml =
      settings.showReviewTitle && review.title
        ? `<h3 class="rcc-card-title">${escapeHtml(review.title)}</h3>`
        : "";

    const bodyHtml = settings.showReviewBody
      ? `<div class="rcc-card-body">${escapeHtml(review.message || "")}</div>`
      : "";

    const reviewerHtml = settings.showReviewerName
      ? `<div class="rcc-card-name">${escapeHtml(
          review.customerName || "Anonymous"
        )}</div>`
      : "";

    const dateHtml =
      settings.showReviewDate && review.createdAt
        ? `<div class="rcc-card-date">${escapeHtml(
            formatDate(review.createdAt)
          )}</div>`
        : "";

    return `
      <article class="${getCardClasses(settings)}">
        <div class="rcc-card-content">
          <div class="rcc-card-top">
            ${ratingHtml}
          </div>
          ${titleHtml}
          ${bodyHtml}
          ${reviewerHtml}
          ${dateHtml}
        </div>
      </article>
    `;
  }

  function renderCenteredReviewCard(review, settings) {
    const media = getPrimaryMedia(review, settings);
    const targetName = getTargetName(review, settings);

    const ratingHtml = settings.showReviewRating
      ? `<div class="rcc-card-stars" aria-label="${escapeHtml(
          String(review.rating || 0)
        )} out of 5 stars">${escapeHtml(renderStars(review.rating))}</div>`
      : "";

    const titleHtml =
      settings.showReviewTitle && review.title
        ? `<h3 class="rcc-card-title">${escapeHtml(review.title)}</h3>`
        : "";

    const bodyHtml = settings.showReviewBody
      ? `<div class="rcc-card-body">${escapeHtml(review.message || "")}</div>`
      : "";

    const reviewerHtml = settings.showReviewerName
      ? `<div class="rcc-card-name">${escapeHtml(
          review.customerName || "Anonymous"
        )}</div>`
      : "";

    const dateHtml =
      settings.showReviewDate && review.createdAt
        ? `<div class="rcc-card-date">${escapeHtml(
            formatDate(review.createdAt)
          )}</div>`
        : "";

    const productHtml =
      settings.showProductName && targetName
        ? `<div class="rcc-card-target">${escapeHtml(targetName)}</div>`
        : "";

    const mediaHtml = media ? renderMedia(media, review, settings) : "";

    return `
      <article class="${getCardClasses(settings)}">
        <div class="rcc-card-content">
          <div class="rcc-card-top">
            ${ratingHtml}
          </div>
          ${titleHtml}
          ${bodyHtml}
          ${reviewerHtml}
          ${dateHtml}
          ${productHtml}
          ${mediaHtml}
        </div>
      </article>
    `;
  }

  function renderVerticalSlidingReviewCard(review, settings) {
    const media = getPrimaryMedia(review, settings);
    const targetName = getTargetName(review, settings);

    const ratingColumn = settings.showReviewRating
      ? `
        <div class="rcc-card-top">
          <div class="rcc-card-stars" aria-label="${escapeHtml(
            String(review.rating || 0)
          )} out of 5 stars">${escapeHtml(renderStars(review.rating))}</div>
        </div>
      `
      : `<div class="rcc-card-top"></div>`;

    const reviewerHtml = settings.showReviewerName
      ? `<div class="rcc-card-name">${escapeHtml(
          review.customerName || "Anonymous"
        )}</div>`
      : "";

    const titleHtml =
      settings.showReviewTitle && review.title
        ? `<h3 class="rcc-card-title">${escapeHtml(review.title)}</h3>`
        : "";

    const bodyHtml = settings.showReviewBody
      ? `<div class="rcc-card-body">${escapeHtml(review.message || "")}</div>`
      : "";

    const dateHtml =
      settings.showReviewDate && review.createdAt
        ? `<div class="rcc-card-date">${escapeHtml(
            formatDate(review.createdAt)
          )}</div>`
        : "";

    const productHtml =
      settings.showProductName && targetName
        ? `<div class="rcc-card-target">${escapeHtml(targetName)}</div>`
        : "";

    return `
      <article class="${getCardClasses(settings)}">
        ${renderMedia(media, review, settings)}
        <div class="rcc-card-content">
          ${reviewerHtml}
          ${titleHtml}
          ${bodyHtml}
          ${dateHtml}
          ${productHtml}
        </div>
        ${ratingColumn}
      </article>
    `;
  }

  function renderReviewCard(review, settings) {
    if (settings.widgetTheme === "compact") {
      return renderCompactReviewCard(review, settings);
    }

    if (settings.widgetTheme === "centered") {
      return renderCenteredReviewCard(review, settings);
    }

    if (settings.widgetTheme === "vertical_sliding") {
      return renderVerticalSlidingReviewCard(review, settings);
    }

    const media = getPrimaryMedia(review, settings);
    const targetName = getTargetName(review, settings);

    const showImage = [
      "gallery",
      "compact_with_pictures",
      "focused_view",
      "vertical_sliding",
    ].includes(settings.widgetTheme);

    const showCompactImage = settings.widgetTheme === "centered" && !!media;
    const showAnyMedia = showImage || showCompactImage;

    const ratingHtml = settings.showReviewRating
      ? `<div class="rcc-card-stars" aria-label="${escapeHtml(
          String(review.rating || 0)
        )} out of 5 stars">${escapeHtml(renderStars(review.rating))}</div>`
      : "";

    const verifiedHtml = settings.showVerifiedBadge
      ? `<span class="rcc-verified-badge">Verified</span>`
      : "";

    const titleHtml =
      settings.showReviewTitle && review.title
        ? `<h3 class="rcc-card-title">${escapeHtml(review.title)}</h3>`
        : "";

    const bodyHtml = settings.showReviewBody
      ? `<div class="rcc-card-body">${escapeHtml(review.message || "")}</div>`
      : "";

    const dateHtml =
      settings.showReviewDate && review.createdAt
        ? `<div class="rcc-card-date">${escapeHtml(
            formatDate(review.createdAt)
          )}</div>`
        : "";

    const reviewerHtml = settings.showReviewerName
      ? `<div class="rcc-card-name">${escapeHtml(
          review.customerName || "Anonymous"
        )}</div>`
      : "";

    const productHtml =
      settings.showProductName && targetName
        ? `<div class="rcc-card-target">${escapeHtml(targetName)}</div>`
        : "";

    const headerHtml = `
      <div class="rcc-card-top">
        ${ratingHtml}
        ${
          verifiedHtml
            ? `<div class="rcc-card-badges">${verifiedHtml}</div>`
            : ""
        }
      </div>
    `;

    const mediaHtml = showAnyMedia ? renderMedia(media, review, settings) : "";

    if (settings.widgetTheme === "focused_view") {
      return `
        <article class="${getCardClasses(settings)}">
          <div class="rcc-card-focused-layout">
            <div class="rcc-card-focused-copy">
              ${headerHtml}
              ${titleHtml}
              ${bodyHtml}
              ${reviewerHtml}
              ${dateHtml}
              ${productHtml}
            </div>

            <div class="rcc-card-focused-media">
              ${renderMedia(media, review, settings)}
            </div>
          </div>
        </article>
      `;
    }

    if (settings.widgetTheme === "compact_with_pictures") {
      return `
        <article class="${getCardClasses(settings)}">
          <div class="rcc-card-inline-layout">
            <div class="rcc-card-inline-media">
              ${renderMedia(media, review, settings)}
            </div>

            <div class="rcc-card-inline-copy">
              ${headerHtml}
              ${titleHtml}
              ${bodyHtml}
              ${reviewerHtml}
              ${dateHtml}
              ${productHtml}
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article class="${getCardClasses(settings)}">
        ${mediaHtml}
        <div class="rcc-card-content">
          ${headerHtml}
          ${titleHtml}
          ${bodyHtml}
          ${reviewerHtml}
          ${dateHtml}
          ${productHtml}
        </div>
      </article>
    `;
  }

  function renderWidgetMarkup(settings, state) {
    const totalReviews = Number(state.totalReviews || state.reviews.length || 0);
    const averageRating = Number(state.averageRating || 0);
    const headerText = buildHeaderText(settings.headerText, totalReviews);
    const summaryText = settings.showAiSummary
      ? getAiSummary(state.reviews, settings)
      : "";

    const slidesMarkup = state.reviews
      .map((review) => {
        return `<div class="rcc-slide">${renderReviewCard(review, settings)}</div>`;
      })
      .join("");

    const showNav = state.reviews.length > state.slidesPerView;
    const navBelowClass =
      settings.arrowPosition === "below" ? "rcc-nav--below" : "rcc-nav--sides";

    return `
      <div class="rcc-widget rcc-theme--${escapeHtml(
        settings.widgetTheme
      )} rcc-arrow--${escapeHtml(settings.arrowPosition)}">
        <div class="rcc-shell" style="width:${settings.pageWidth}%;">
          <div class="rcc-stage">
            ${
              settings.showHeader
                ? `
              <div class="rcc-header ${
                settings.textAlign === "center" ? "rcc-header--center" : ""
              }">
                <div class="rcc-header-main">
                  <h2 class="rcc-header-title">${escapeHtml(
                    settings.headerTitle
                  )}</h2>

                  ${
                    settings.showAverageRating
                      ? `
                    <div class="rcc-header-summary">
                      <div class="rcc-header-stars">${escapeHtml(
                        renderStars(averageRating)
                      )}</div>
                      <div class="rcc-header-meta">${escapeHtml(headerText)}</div>
                      ${
                        settings.showVerifiedBadge
                          ? `<span class="rcc-header-check">✓</span>`
                          : ""
                      }
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>
            `
                : ""
            }

            ${
              settings.showAiSummary && summaryText
                ? `
              <div class="rcc-ai-summary">
                <div class="rcc-ai-summary-title">${escapeHtml(
                  settings.aiSummaryHeading
                )}</div>
                <div class="rcc-ai-summary-text">${escapeHtml(summaryText)}</div>
              </div>
            `
                : ""
            }

            ${
              !state.reviews.length
                ? `
              <div class="rcc-empty-state">${escapeHtml(settings.emptyText)}</div>
            `
                : `
              <div class="rcc-carousel ${
                navBelowClass
              } ${settings.widgetTheme === "vertical_sliding" ? "is-vertical" : "is-horizontal"}">
                ${
                  showNav && settings.arrowPosition === "sides"
                    ? `
                  <button type="button" class="rcc-nav-btn rcc-nav-btn--prev" aria-label="Previous reviews">‹</button>
                `
                    : ""
                }

                <div class="rcc-viewport">
                  <div class="rcc-track">${slidesMarkup}</div>
                </div>

                ${
                  showNav && settings.arrowPosition === "sides"
                    ? `
                  <button type="button" class="rcc-nav-btn rcc-nav-btn--next" aria-label="Next reviews">›</button>
                `
                    : ""
                }
              </div>
            `
            }

            ${
              showNav && settings.arrowPosition === "below"
                ? `
              <div class="rcc-nav-below-wrap">
                <button type="button" class="rcc-nav-btn rcc-nav-btn--prev" aria-label="Previous reviews">‹</button>
                <button type="button" class="rcc-nav-btn rcc-nav-btn--next" aria-label="Next reviews">›</button>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;
  }

  function shouldUseLoop(settings, state) {
    return Boolean(settings.loop && state.reviews.length > state.slidesPerView);
  }

  function getNonLoopMaxIndex(state) {
    return Math.max(0, state.reviews.length - state.slidesPerView);
  }

  function setTrackTransition(track, enabled) {
    if (!track) return;

    if (!enabled) {
      track.style.transition = "none";
      return;
    }

    track.style.transition = "";
  }

  function getTrackSlides(root) {
    const track = root.querySelector(".rcc-track");
    if (!track) return [];
    return Array.from(track.children).filter((child) =>
      child.classList.contains("rcc-slide")
    );
  }

  function setupLoopClones(root, settings, state) {
    const track = root.querySelector(".rcc-track");
    if (!track) return;

    const slides = getTrackSlides(root);

    state.loopEnabled = shouldUseLoop(settings, state);
    state.cloneCount = 0;

    if (!state.loopEnabled || !slides.length) {
      state.currentIndex = 0;
      return;
    }

    const cloneCount = Math.min(state.slidesPerView, slides.length);

    const prependClones = slides.slice(-cloneCount).map((slide) => {
      const clone = slide.cloneNode(true);
      clone.classList.add("rcc-slide--clone");
      clone.setAttribute("aria-hidden", "true");
      return clone;
    });

    const appendClones = slides.slice(0, cloneCount).map((slide) => {
      const clone = slide.cloneNode(true);
      clone.classList.add("rcc-slide--clone");
      clone.setAttribute("aria-hidden", "true");
      return clone;
    });

    prependClones.reverse().forEach((clone) => {
      track.insertBefore(clone, track.firstChild);
    });

    appendClones.forEach((clone) => {
      track.appendChild(clone);
    });

    state.cloneCount = cloneCount;
    state.currentIndex = cloneCount;
  }

  function applySlideSizing(root, settings, state) {
    const track = root.querySelector(".rcc-track");
    const slides = getTrackSlides(root);

    if (!track || !slides.length) return;

    const gap = settings.cardGap;

    if (settings.widgetTheme === "vertical_sliding") {
      const slideHeight = settings.blockHeight;

      slides.forEach((slide) => {
        slide.style.height = `${slideHeight}px`;
        slide.style.minHeight = `${slideHeight}px`;
        slide.style.maxHeight = `${slideHeight}px`;
      });

      const viewport = root.querySelector(".rcc-viewport");
      const visibleHeight =
        slideHeight * state.slidesPerView +
        gap * Math.max(0, state.slidesPerView - 1);

      if (viewport) {
        viewport.style.height = `${visibleHeight}px`;
      }

      return;
    }

    const widthPercent = 100 / state.slidesPerView;
    const gapShare =
      (gap * Math.max(0, state.slidesPerView - 1)) / state.slidesPerView;

    slides.forEach((slide) => {
      slide.style.minWidth = `calc(${widthPercent}% - ${gapShare}px)`;
      slide.style.maxWidth = `calc(${widthPercent}% - ${gapShare}px)`;
      slide.style.height = "";
      slide.style.minHeight = "";
      slide.style.maxHeight = "";
    });

    const viewport = root.querySelector(".rcc-viewport");
    if (viewport) {
      viewport.style.height = "";
    }
  }

  function getSlideDistance(root, settings, state) {
    const slides = getTrackSlides(root);
    if (!slides.length) return 0;

    if (settings.widgetTheme === "vertical_sliding") {
      return settings.blockHeight + settings.cardGap;
    }

    const firstSlideWidth = slides[0].getBoundingClientRect().width;

    if (firstSlideWidth > 0) {
      return firstSlideWidth + settings.cardGap;
    }

    const viewport = root.querySelector(".rcc-viewport");
    const viewportWidth = viewport ? viewport.getBoundingClientRect().width : 0;

    if (!viewportWidth) return 0;

    const totalGap = settings.cardGap * Math.max(0, state.slidesPerView - 1);
    return (viewportWidth - totalGap) / state.slidesPerView + settings.cardGap;
  }

  function normalizeLoopIndex(root, settings, state) {
    if (!state.loopEnabled) return;

    const lowerBound = state.cloneCount;
    const upperBound = state.cloneCount + state.reviews.length;
    let nextIndex = state.currentIndex;

    if (state.currentIndex < lowerBound) {
      nextIndex = state.currentIndex + state.reviews.length;
    } else if (state.currentIndex >= upperBound) {
      nextIndex = state.currentIndex - state.reviews.length;
    }

    if (nextIndex !== state.currentIndex) {
      state.currentIndex = nextIndex;
      updateSlider(root, settings, state, { skipAnimation: true });
    }
  }

  function updateSlider(root, settings, state, options) {
    const track = root.querySelector(".rcc-track");
    const prevButtons = Array.from(root.querySelectorAll(".rcc-nav-btn--prev"));
    const nextButtons = Array.from(root.querySelectorAll(".rcc-nav-btn--next"));
    const skipAnimation = Boolean(options && options.skipAnimation);

    if (!track) return;

    applySlideSizing(root, settings, state);

    const distance = getSlideDistance(root, settings, state);

    if (skipAnimation) {
      setTrackTransition(track, false);
    } else {
      setTrackTransition(track, true);
    }

    if (settings.widgetTheme === "vertical_sliding") {
      const offset = state.currentIndex * distance;
      track.style.transform = `translate3d(0, -${offset}px, 0)`;
    } else {
      const offset = state.currentIndex * distance;
      track.style.transform = `translate3d(-${offset}px, 0, 0)`;
    }

    if (skipAnimation) {
      track.getBoundingClientRect();
      setTrackTransition(track, true);
    }

    const disablePrev =
      !state.canSlide || (!state.loopEnabled && state.currentIndex <= 0);
    const disableNext =
      !state.canSlide ||
      (!state.loopEnabled && state.currentIndex >= getNonLoopMaxIndex(state));

    prevButtons.forEach((btn) => {
      btn.disabled = disablePrev;
    });

    nextButtons.forEach((btn) => {
      btn.disabled = disableNext;
    });
  }

  function goToIndex(root, settings, state, nextIndex) {
    if (!state.canSlide) {
      state.currentIndex = state.loopEnabled ? state.cloneCount : 0;
      updateSlider(root, settings, state, { skipAnimation: true });
      return;
    }

    if (state.loopEnabled) {
      if (state.isAnimating) return;

      state.currentIndex = nextIndex;
      state.isAnimating = true;
      updateSlider(root, settings, state);
      return;
    }

    const maxIndex = getNonLoopMaxIndex(state);

    if (nextIndex < 0) {
      state.currentIndex = settings.loop ? maxIndex : 0;
    } else if (nextIndex > maxIndex) {
      state.currentIndex = settings.loop ? 0 : maxIndex;
    } else {
      state.currentIndex = nextIndex;
    }

    updateSlider(root, settings, state);
  }

  function startAutoplay(root, settings, state) {
    stopAutoplay(state);

    if (!settings.enableAutoplay || settings.autoslideInterval <= 0) return;
    if (!state.canSlide) return;

    state.autoplayTimer = window.setInterval(() => {
      if (settings.pauseOnHover && state.isHovered) return;
      if (state.isDragging || state.isAnimating) return;

      goToIndex(root, settings, state, state.currentIndex + 1);
    }, settings.autoslideInterval);
  }

  function stopAutoplay(state) {
    if (state.autoplayTimer) {
      window.clearInterval(state.autoplayTimer);
      state.autoplayTimer = null;
    }
  }

  function bindNav(root, settings, state, cleanup) {
    Array.from(root.querySelectorAll(".rcc-nav-btn--prev")).forEach((btn) => {
      const handler = () => {
        goToIndex(root, settings, state, state.currentIndex - 1);
      };

      btn.addEventListener("click", handler);
      cleanup.push(() => btn.removeEventListener("click", handler));
    });

    Array.from(root.querySelectorAll(".rcc-nav-btn--next")).forEach((btn) => {
      const handler = () => {
        goToIndex(root, settings, state, state.currentIndex + 1);
      };

      btn.addEventListener("click", handler);
      cleanup.push(() => btn.removeEventListener("click", handler));
    });
  }

  function bindHover(root, settings, state, cleanup) {
    const carousel = root.querySelector(".rcc-carousel");
    if (!carousel) return;

    const onEnter = () => {
      if (settings.pauseOnHover) state.isHovered = true;
    };

    const onLeave = () => {
      state.isHovered = false;
    };

    carousel.addEventListener("mouseenter", onEnter);
    carousel.addEventListener("mouseleave", onLeave);

    cleanup.push(() => carousel.removeEventListener("mouseenter", onEnter));
    cleanup.push(() => carousel.removeEventListener("mouseleave", onLeave));
  }

  function bindSwipe(root, settings, state, cleanup) {
    if (!settings.enableSwipe) return;

    const viewport = root.querySelector(".rcc-viewport");
    if (!viewport) return;

    let startPos = 0;
    let currentPos = 0;
    let hasMoved = false;

    const isVertical = settings.widgetTheme === "vertical_sliding";
    const threshold = 40;

    function getPoint(event) {
      if (event.touches && event.touches[0]) {
        return isVertical
          ? event.touches[0].clientY
          : event.touches[0].clientX;
      }

      return isVertical ? event.clientY : event.clientX;
    }

    function onStart(event) {
      if (!state.canSlide || state.isAnimating) return;

      state.isDragging = true;
      hasMoved = false;
      startPos = getPoint(event);
      currentPos = startPos;
    }

    function onMove(event) {
      if (!state.isDragging) return;

      currentPos = getPoint(event);

      if (Math.abs(currentPos - startPos) > 8) {
        hasMoved = true;
      }
    }

    function onEnd() {
      if (!state.isDragging) return;

      const diff = currentPos - startPos;
      state.isDragging = false;

      if (!hasMoved || Math.abs(diff) < threshold) return;

      if (diff > 0) {
        goToIndex(root, settings, state, state.currentIndex - 1);
      } else {
        goToIndex(root, settings, state, state.currentIndex + 1);
      }
    }

    viewport.addEventListener("touchstart", onStart, { passive: true });
    viewport.addEventListener("touchmove", onMove, { passive: true });
    viewport.addEventListener("touchend", onEnd);
    viewport.addEventListener("touchcancel", onEnd);

    viewport.addEventListener("mousedown", onStart);
    viewport.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);

    cleanup.push(() => viewport.removeEventListener("touchstart", onStart));
    cleanup.push(() => viewport.removeEventListener("touchmove", onMove));
    cleanup.push(() => viewport.removeEventListener("touchend", onEnd));
    cleanup.push(() => viewport.removeEventListener("touchcancel", onEnd));
    cleanup.push(() => viewport.removeEventListener("mousedown", onStart));
    cleanup.push(() => viewport.removeEventListener("mousemove", onMove));
    cleanup.push(() => window.removeEventListener("mouseup", onEnd));
  }

  function bindTrackLoop(root, settings, state, cleanup) {
    const track = root.querySelector(".rcc-track");
    if (!track) return;

    const onTransitionEnd = (event) => {
      if (event.target !== track || event.propertyName !== "transform") return;

      if (state.loopEnabled) {
        normalizeLoopIndex(root, settings, state);
      }

      state.isAnimating = false;
    };

    track.addEventListener("transitionend", onTransitionEnd);
    cleanup.push(() => track.removeEventListener("transitionend", onTransitionEnd));
  }

  function debounce(fn, wait) {
    let timer = null;

    return function () {
      const args = arguments;
      const context = this;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(context, args), wait);
    };
  }

  function mount(root, settings, reviewsPayload) {
    if (
      root.__rccController &&
      typeof root.__rccController.destroy === "function"
    ) {
      root.__rccController.destroy();
      root.__rccController = null;
    }

    const state = {
      reviews: Array.isArray(reviewsPayload.data) ? reviewsPayload.data : [],
      totalReviews: Number(reviewsPayload.totalReviews || 0),
      averageRating: Number(reviewsPayload.averageRating || 0),
      currentIndex: 0,
      slidesPerView: getSlidesPerView(settings),
      autoplayTimer: null,
      isHovered: false,
      isDragging: false,
      isAnimating: false,
      loopEnabled: false,
      cloneCount: 0,
      canSlide: false,
    };

    state.canSlide = state.reviews.length > state.slidesPerView;

    root.setAttribute("aria-busy", "false");
    applyThemeVars(root, settings);
    injectCustomCss(root, settings);
    root.innerHTML = renderWidgetMarkup(settings, state);

    const track = root.querySelector(".rcc-track");
    if (track) {
      track.style.gap = `${settings.cardGap}px`;
      track.style.flexDirection =
        settings.widgetTheme === "vertical_sliding" ? "column" : "row";
    }

    setupLoopClones(root, settings, state);
    updateSlider(root, settings, state, { skipAnimation: true });

    const cleanup = [];

    bindNav(root, settings, state, cleanup);
    bindHover(root, settings, state, cleanup);
    bindSwipe(root, settings, state, cleanup);
    bindTrackLoop(root, settings, state, cleanup);
    startAutoplay(root, settings, state);

    const controller = {
      root,
      settings,
      state,
      cleanup,
      onResize: null,
      destroy() {
        stopAutoplay(state);

        cleanup.forEach((fn) => {
          try {
            fn();
          } catch {}
        });

        cleanup.length = 0;

        if (this.onResize) {
          window.removeEventListener("resize", this.onResize);
        }
      },
    };

    controller.onResize = debounce(() => {
      const nextSlidesPerView = getSlidesPerView(settings);

      if (nextSlidesPerView !== state.slidesPerView) {
        mount(root, settings, {
          data: state.reviews,
          totalReviews: state.totalReviews,
          averageRating: state.averageRating,
        });
        return;
      }

      state.canSlide = state.reviews.length > state.slidesPerView;
      updateSlider(root, settings, state);
      startAutoplay(root, settings, state);
    }, 120);

    window.addEventListener("resize", controller.onResize);
    root.__rccController = controller;
  }

  async function fetchReviews(settings) {
    const response = await fetch(buildRequestUrl(settings), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load reviews");
    }

    return result;
  }

  async function initRoot(root) {
    if (!root) return;

    if (
      root.__rccController &&
      typeof root.__rccController.destroy === "function"
    ) {
      root.__rccController.destroy();
      root.__rccController = null;
    }

    const settings = buildSettings(root);
    renderLoading(root, settings);

    try {
      const result = await fetchReviews(settings);
      mount(root, settings, result);
    } catch (error) {
      renderError(root, settings, error.message || "Failed to load reviews");
    }
  }

  function initAll(scope) {
    const searchRoot = scope && scope.querySelectorAll ? scope : document;
    const roots = Array.from(searchRoot.querySelectorAll(ROOT_SELECTOR));

    roots.forEach((root) => {
      initRoot(root);
    });
  }

  window[GLOBAL_KEY] = {
    initAll,
  };
})();