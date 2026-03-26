document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("product-reviews-root");
  if (!root) return;

  const reviewType = (root.dataset.reviewType || "product").trim().toLowerCase();
  const targetId = root.dataset.targetId || "";
  const targetHandle = root.dataset.targetHandle || "";
  const targetTitle = root.dataset.targetTitle || "";
  const productId = root.dataset.productId || "";
  const productTitle = root.dataset.productTitle || "";
  const shop = root.dataset.shop || "";
  const endpoint = root.dataset.endpoint || "";
  const cloudinaryCloudName = root.dataset.cloudinaryCloudName || "";
  const cloudinaryUploadPreset = root.dataset.cloudinaryUploadPreset || "";

  const summaryEl = root.querySelector(".pr-average");
  const listEl = root.querySelector(".pr-list");
  const form = root.querySelector("#product-review-form");
  const messageEl = root.querySelector("#product-review-message");
  const submitBtn = form?.querySelector('button[type="submit"]') || null;

  const ratingInput = root.querySelector("#pr-rating");
  const ratingLiveText = root.querySelector("#pr-rating-live-text");
  const starButtons = Array.from(root.querySelectorAll(".pr-star-btn"));

  const imageInput = root.querySelector("#pr-review-images");
  const imagePreview = root.querySelector("#pr-image-preview");
  const imagePreviewWrap = root.querySelector("#pr-image-preview-wrap");
  const uploadDropzone = root.querySelector("#pr-upload-dropzone");

  const youtubeInput = root.querySelector("#pr-youtube-url");
  const videoInput = root.querySelector("#pr-review-video");
  const videoDropzone = root.querySelector("#pr-video-dropzone");
  const videoPreview = root.querySelector("#pr-video-preview");
  const videoPreviewWrap = root.querySelector("#pr-video-preview-wrap");

  const filterChipsWrap = root.querySelector("#pr-filter-chips");
  const filterChips = Array.from(root.querySelectorAll(".pr-filter-chip"));

  const loadMoreBtn = root.querySelector("#pr-load-more-btn");
  const sortSegment = root.querySelector("#pr-sort-segment");
  const sortButtons = Array.from(root.querySelectorAll(".pr-sort-btn"));
  const searchInput = root.querySelector("#pr-search-input");
  const resultsMetaEl = root.querySelector("#pr-results-meta");

  const toggleFormBtn = root.querySelector("#pr-toggle-form-btn");
  const formContainer = root.querySelector("#pr-form-container");

  const titleInput = root.querySelector("#pr-title");
  const titleCount = root.querySelector("#pr-title-count");
  const messageInput = root.querySelector("#pr-message");
  const messageCount = root.querySelector("#pr-message-count");
  const toastEl = root.querySelector("#pr-toast");

  const lightbox = root.querySelector("#pr-lightbox");
  const lightboxImage = root.querySelector("#pr-lightbox-image");
  const lightboxClose = root.querySelector("#pr-lightbox-close");
  const lightboxPrev = root.querySelector("#pr-lightbox-prev");
  const lightboxNext = root.querySelector("#pr-lightbox-next");
  const lightboxCounter = root.querySelector("#pr-lightbox-counter");

  const MAX_REVIEW_IMAGES = 4;
  const MAX_VIDEO_SIZE_MB = 20;
  const DEFAULT_VISIBLE_COUNT = 4;
  const LOAD_MORE_STEP = 4;

  const RATING_LABELS = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  let allReviews = [];
  let currentFilter = "all";
  let currentSort = "newest";
  let currentSearch = "";
  let visibleCount = DEFAULT_VISIBLE_COUNT;
  let selectedImages = [];
  let selectedVideoFile = null;
  let activeRating = 0;

  let lightboxImages = [];
  let lightboxIndex = 0;

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

  function getInitial(name = "") {
    const cleanName = safeText(name).trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "A";
  }

  function renderStars(rating) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = "★".repeat(Math.floor(safeRating));
    const empty = "☆".repeat(5 - Math.floor(safeRating));
    return `${full}${empty}`;
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
    return `Reviewed on ${formatDate(dateValue)}`;
  }

  function isRecentReview(dateValue) {
    const date = parseDateValue(dateValue);
    if (!date) return false;

    const diffMs = new Date() - date;
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  function normalizeImages(review) {
    if (Array.isArray(review?.images)) return review.images;
    if (Array.isArray(review?.reviewImages)) return review.reviewImages;
    return [];
  }

  function normalizeYoutubeEmbedUrl(value) {
    if (!value) return null;

    const url = String(value).trim();

    try {
      const parsed = new URL(url);

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

        if (!videoId) return null;

        return `https://www.youtube.com/embed/${videoId}`;
      }

      return null;
    } catch {
      return null;
    }
  }

  function getRatingStats(reviews) {
    const stats = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach((review) => {
      const rating = Number(review?.rating) || 0;
      if (stats[rating] !== undefined) {
        stats[rating] += 1;
      }
    });

    return stats;
  }

  function getAverageLabel(avg) {
    if (avg >= 4.5) return "Excellent";
    if (avg >= 4) return "Very Good";
    if (avg >= 3) return "Good";
    if (avg >= 2) return "Fair";
    return "Poor";
  }

  function getInsightText(stats) {
    const sorted = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .filter(([, count]) => count > 0)
      .slice(0, 2)
      .map(([star]) => `${star}★`);

    if (sorted.length >= 2) {
      return `Most customers rated ${sorted[0]} and ${sorted[1]}.`;
    }

    if (sorted.length === 1) {
      return `Most customers rated ${sorted[0]}.`;
    }

    return "No rating insight available yet.";
  }

  function getRecommendationPercent(reviews) {
    if (!reviews.length) return 0;
    const recommendCount = reviews.filter((r) => Number(r.rating) >= 4).length;
    return Math.round((recommendCount / reviews.length) * 100);
  }

  function getStatChips(reviews) {
    if (!reviews.length) {
      return ["Good quality", "Worth buying", "Fast delivery"];
    }

    const highRated = reviews.filter((r) => Number(r.rating) >= 4).length;
    const mediumRated = reviews.filter((r) => Number(r.rating) === 3).length;

    if (highRated >= mediumRated) {
      return ["Good quality", "Value for money", "Fast delivery"];
    }

    return ["Looks good", "Nice packaging", "Worth trying"];
  }

  function extractProsTags(review) {
    const source = `${safeText(review?.title)} ${safeText(review?.message)}`.toLowerCase();
    const tags = [];

    const rules = [
      { keys: ["quality", "good quality", "premium"], tag: "Good quality" },
      { keys: ["finish", "nice finish", "smooth"], tag: "Nice finish" },
      { keys: ["worth", "value", "money"], tag: "Worth buying" },
      { keys: ["delivery", "fast", "quick"], tag: "Fast delivery" },
      { keys: ["packaging", "packed"], tag: "Nice packaging" },
      { keys: ["comfortable", "comfort"], tag: "Comfortable" },
      { keys: ["fit", "perfect fit"], tag: "Great fit" },
      { keys: ["recommended", "recommend"], tag: "Recommended" },
      { keys: ["service", "support", "store"], tag: "Great service" },
      { keys: ["collection", "range", "options"], tag: "Nice collection" },
    ];

    rules.forEach((rule) => {
      if (tags.length >= 3) return;
      if (rule.keys.some((key) => source.includes(key))) {
        tags.push(rule.tag);
      }
    });

    if (!tags.length) {
      const rating = Number(review?.rating) || 0;
      if (rating >= 4) tags.push("Good quality", "Worth buying");
      else if (rating === 3) tags.push("Worth trying");
      else tags.push("Needs improvement");
    }

    return tags.slice(0, 3);
  }

  function showToast(message, type = "success") {
    if (!toastEl) return;

    toastEl.hidden = false;
    toastEl.className = `pr-toast pr-toast--${type}`;
    toastEl.textContent = message;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.hidden = true;
      toastEl.textContent = "";
      toastEl.className = "pr-toast";
    }, 3000);
  }

  function getStorageTargetKey() {
    const fallbackTargetId = reviewType === "store" ? "store" : targetId || targetHandle || "unknown";
    return `${shop}_${reviewType}_${fallbackTargetId}`;
  }

  function getHelpfulStorageKey(reviewId) {
    return `pr_helpful_${getStorageTargetKey()}_${reviewId}`;
  }

  function hasMarkedHelpful(reviewId) {
    try {
      return localStorage.getItem(getHelpfulStorageKey(reviewId)) === "1";
    } catch {
      return false;
    }
  }

  function setMarkedHelpful(reviewId, value) {
    try {
      if (value) {
        localStorage.setItem(getHelpfulStorageKey(reviewId), "1");
      } else {
        localStorage.removeItem(getHelpfulStorageKey(reviewId));
      }
    } catch {
      // ignore localStorage failures
    }
  }

  function getErrorEl(fieldName) {
    return root.querySelector(`[data-error-for="${fieldName}"]`);
  }

  function setFieldError(fieldName, message, inputEl) {
    const errorEl = getErrorEl(fieldName);
    if (errorEl) errorEl.textContent = message || "";
    if (inputEl) inputEl.classList.add("pr-invalid");
  }

  function clearFieldError(fieldName, inputEl) {
    const errorEl = getErrorEl(fieldName);
    if (errorEl) errorEl.textContent = "";
    if (inputEl) inputEl.classList.remove("pr-invalid");
  }

  function renderSummary(averageRating, totalReviews, ratingStats, reviews) {
    const avg = Number(averageRating) || 0;
    const total = Number(totalReviews) || 0;
    const avgLabel = getAverageLabel(avg);
    const insightText = getInsightText(ratingStats);
    const recommendationPercent = getRecommendationPercent(reviews);
    const statChips = getStatChips(reviews);

    const highestCount = Math.max(...Object.values(ratingStats), 0);

    const progressRows = [5, 4, 3, 2, 1]
      .map((star) => {
        const count = ratingStats[star] || 0;
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const isTop = count > 0 && count === highestCount;

        return `
          <div class="pr-progress-row ${isTop ? "is-top" : ""}">
            <div class="pr-progress-label">${star}★</div>
            <div class="pr-progress-bar">
              <div class="pr-progress-fill" style="width:${percentage}%;"></div>
            </div>
            <div class="pr-progress-value">${count}</div>
            <div class="pr-progress-percent">${percentage}%</div>
          </div>
        `;
      })
      .join("");

    const chipsHtml = statChips
      .map((chip) => `<span class="pr-stat-chip">${escapeHtml(chip)}</span>`)
      .join("");

    const meterDegrees = Math.round((avg / 5) * 360);

    return `
      <div class="pr-summary-box">
        <div class="pr-summary-top">
          <div class="pr-summary-meter-wrap">
            <div class="pr-summary-meter" style="--progress:${meterDegrees}deg;">
              <div class="pr-summary-meter-inner">
                <div class="pr-summary-rating">${avg.toFixed(1)}</div>
                <div class="pr-summary-outof">out of 5</div>
              </div>
            </div>
          </div>

          <div class="pr-summary-stars">${renderStars(Math.round(avg))}</div>
          <div class="pr-summary-label">${avgLabel}</div>
          <div class="pr-summary-count">
            ${avgLabel} based on ${total} review${total !== 1 ? "s" : ""}
          </div>
          <div class="pr-summary-insight">${escapeHtml(insightText)}</div>

          <div class="pr-summary-cta-group">
            <button type="button" class="pr-summary-cta-btn" id="pr-summary-write-review-btn">
              Write review
            </button>
            <button type="button" class="pr-summary-filter-btn" id="pr-summary-filter-5-btn">
              View 5★ reviews
            </button>
          </div>
        </div>

        <div class="pr-progress-list">
          ${progressRows}
        </div>

        <div class="pr-recommend-box">
          <div class="pr-recommend-title">${recommendationPercent}% customers recommend this</div>
          <div class="pr-recommend-text">
            Customers mostly liked the quality, value, and overall experience.
          </div>
        </div>

        <div class="pr-chip-list">
          ${chipsHtml}
        </div>
      </div>
    `;
  }

  function renderEmptyState() {
    if (!listEl) return;

    let emptyTitle = "No reviews yet";
    let emptyText = "Be the first to share your experience.";
    let emptyButton = "Write the first review";

    if (reviewType === "collection") {
      emptyText = "Be the first to share your experience with this collection.";
    } else if (reviewType === "store") {
      emptyText = "Be the first to share your experience with this store.";
    } else {
      emptyText = "Be the first to share your experience with this product.";
    }

    listEl.innerHTML = `
      <div class="pr-empty">
        <div class="pr-empty-icon-wrap">
          <div class="pr-empty-icon">⭐</div>
          <div class="pr-empty-icon">💬</div>
        </div>
        <h4 class="pr-empty-title">${emptyTitle}</h4>
        <p>${emptyText}</p>
        <div class="pr-empty-action">
          <button type="button" class="pr-empty-btn" id="pr-empty-review-btn">${emptyButton}</button>
        </div>
      </div>
    `;

    const emptyBtn = root.querySelector("#pr-empty-review-btn");
    emptyBtn?.addEventListener("click", openFormAndScroll);
  }

  function renderLoadingState() {
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="pr-skeleton-summary">
          <div class="pr-skeleton-line lg"></div>
          <div class="pr-skeleton-line md"></div>
          <div class="pr-skeleton-line sm"></div>
          <div class="pr-skeleton-line"></div>
          <div class="pr-skeleton-line"></div>
          <div class="pr-skeleton-line"></div>
          <div class="pr-skeleton-line"></div>
        </div>
      `;
    }

    if (listEl) {
      listEl.innerHTML = `
        <div class="pr-skeleton-card"></div>
        <div class="pr-skeleton-card"></div>
        <div class="pr-skeleton-card"></div>
      `;
    }

    if (loadMoreBtn) loadMoreBtn.hidden = true;
    if (resultsMetaEl) resultsMetaEl.textContent = "";
  }

  function renderErrorState(message = "Failed to load reviews") {
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="pr-summary-box">
          <div class="pr-summary-top">
            <div class="pr-summary-meter-wrap">
              <div class="pr-summary-meter" style="--progress:0deg;">
                <div class="pr-summary-meter-inner">
                  <div class="pr-summary-rating">0.0</div>
                  <div class="pr-summary-outof">out of 5</div>
                </div>
              </div>
            </div>
            <div class="pr-summary-stars">☆☆☆☆☆</div>
            <div class="pr-summary-label">Unavailable</div>
            <div class="pr-summary-count">Reviews are temporarily unavailable</div>
          </div>
        </div>
      `;
    }

    if (listEl) {
      listEl.innerHTML = `
        <div class="pr-error-box">${escapeHtml(message)}</div>
      `;
    }

    if (loadMoreBtn) loadMoreBtn.hidden = true;
    if (resultsMetaEl) resultsMetaEl.textContent = "";
  }

  function getFilteredSortedReviews() {
    let reviews = [...allReviews];

    if (currentFilter === "pinned") {
      reviews = reviews.filter((review) => Boolean(review.isPinned));
    } else if (currentFilter !== "all") {
      reviews = reviews.filter(
        (review) => Number(review.rating) === Number(currentFilter)
      );
    }

    if (currentSearch.trim()) {
      const keyword = currentSearch.trim().toLowerCase();
      reviews = reviews.filter((review) => {
        const name = safeText(review.customerName).toLowerCase();
        const title = safeText(review.title).toLowerCase();
        const message = safeText(review.message).toLowerCase();
        return (
          name.includes(keyword) ||
          title.includes(keyword) ||
          message.includes(keyword)
        );
      });
    }

    const pinnedFirst = (a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      return bPinned - aPinned;
    };

    if (currentSort === "newest") {
      reviews.sort((a, b) => {
        const pinDiff = pinnedFirst(a, b);
        if (pinDiff !== 0) return pinDiff;

        const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
        const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
    } else if (currentSort === "oldest") {
      reviews.sort((a, b) => {
        const pinDiff = pinnedFirst(a, b);
        if (pinDiff !== 0) return pinDiff;

        const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
        const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
        return aTime - bTime;
      });
    } else if (currentSort === "highest") {
      reviews.sort((a, b) => {
        const pinDiff = pinnedFirst(a, b);
        if (pinDiff !== 0) return pinDiff;

        const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
        const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
    } else if (currentSort === "lowest") {
      reviews.sort((a, b) => {
        const pinDiff = pinnedFirst(a, b);
        if (pinDiff !== 0) return pinDiff;

        const ratingDiff = Number(a.rating || 0) - Number(b.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;

        const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
        const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
    }

    return reviews;
  }

  function getRatingClass(rating) {
    const r = Number(rating) || 0;
    return `pr-item--rating-${r}`;
  }

  function getReviewBadges(review, index) {
    const badges = [{ className: "pr-badge--verified", label: "Verified Purchase" }];

    if (Boolean(review.isPinned)) {
      badges.unshift({ className: "pr-badge--pinned", label: "Pinned Review" });
    }

    if (index === 0 && Number(review.rating) >= 4) {
      badges.push({ className: "pr-badge--top", label: "Top Review" });
    }

    if (Number(review.helpfulCount || 0) >= 5) {
      badges.push({ className: "pr-badge--top", label: "Most Helpful" });
    }

    if (isRecentReview(review.createdAt)) {
      badges.push({ className: "pr-badge--recent", label: "Recent Buyer" });
    }

    return badges.slice(0, 3);
  }

  function renderReviewCard(review, index) {
    const customerName = escapeHtml(review.customerName || "Anonymous");
    const title = escapeHtml(review.title || "");
    const message = escapeHtml(review.message || "");
    const rating = Number(review.rating) || 0;
    const createdAt = formatRelativeDate(review.createdAt);
    const avatarInitial = escapeHtml(getInitial(review.customerName || "A"));
    const ratingClass = getRatingClass(rating);

    const imageList = normalizeImages(review);
    const encodedImages = encodeURIComponent(JSON.stringify(imageList));

    const galleryHtml = imageList.length
      ? `
        <div class="pr-review-gallery">
          ${imageList
            .map(
              (img, imgIndex) => `
                <button
                  type="button"
                  class="pr-review-image"
                  data-lightbox-images="${encodedImages}"
                  data-lightbox-index="${imgIndex}"
                  aria-label="Open review image"
                >
                  <img src="${escapeHtml(img)}" alt="Review image">
                </button>
              `
            )
            .join("")}
        </div>
      `
      : "";

    const reviewVideoUrl = safeText(review.reviewVideoUrl);
    const reviewYoutubeUrl = safeText(review.reviewYoutubeUrl);

    const videoHtml = reviewVideoUrl
      ? `
        <div class="pr-review-video-wrap">
          <video class="pr-review-video" controls>
            <source src="${escapeHtml(reviewVideoUrl)}">
          </video>
        </div>
      `
      : reviewYoutubeUrl
      ? `
        <div class="pr-review-youtube-wrap">
          <iframe
            class="pr-review-youtube"
            src="${escapeHtml(reviewYoutubeUrl)}"
            title="Review video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
      `
      : "";

    const needsClamp = safeText(review.message).length > 180;
    const messageId = `pr-message-${index}-${safeText(review.id || "item")}`;
    const helpfulCount = Number(review.helpfulCount || 0);
    const reviewId = review.id || String(index);
    const isHelpfulMarked = review.id ? hasMarkedHelpful(review.id) : false;
    const prosTags = extractProsTags(review);
    const badges = getReviewBadges(review, index);

    const badgesHtml = badges
      .map(
        (badge) =>
          `<span class="pr-badge ${badge.className}">${escapeHtml(badge.label)}</span>`
      )
      .join("");

    const tagsHtml = prosTags.length
      ? `
        <div class="pr-tag-list">
          ${prosTags
            .map((tag) => `<span class="pr-tag">${escapeHtml(tag)}</span>`)
            .join("")}
        </div>
      `
      : "";

    return `
      <div class="pr-item ${ratingClass}">
        <div class="pr-item-top">
          <div class="pr-user-meta">
            <div class="pr-avatar">${avatarInitial}</div>

            <div class="pr-user-block">
              <div class="pr-user-line">
                <div class="pr-user-name">${customerName}</div>
                <div class="pr-badge-list">
                  ${badgesHtml}
                </div>
              </div>
            </div>
          </div>

          <div class="pr-item-side">
            <div class="pr-date-chip">${escapeHtml(createdAt)}</div>
            <div class="pr-item-stars">${renderStars(rating)}</div>
            <div class="pr-rating-text">
              ${RATING_LABELS[rating] || `${rating}/5`} • ${rating}/5 rating
            </div>
          </div>
        </div>

        ${title ? `<div class="pr-item-title">${title}</div>` : ""}

        ${tagsHtml}

        ${
          message
            ? `<div id="${messageId}" class="pr-item-message ${needsClamp ? "is-clamped" : ""}">${message}</div>`
            : ""
        }

        ${
          needsClamp
            ? `<button type="button" class="pr-read-more-btn" data-target="${messageId}" data-expanded="false">Read more</button>`
            : ""
        }

        ${galleryHtml}
        ${videoHtml}

        <div class="pr-review-actions">
          <button
            type="button"
            class="pr-helpful-btn ${isHelpfulMarked ? "is-active" : ""}"
            data-helpful="${escapeHtml(reviewId)}"
            data-count="${helpfulCount}"
            data-marked="${isHelpfulMarked ? "true" : "false"}"
          >
            ${isHelpfulMarked ? "✓ Marked helpful" : "👍 Helpful"}
          </button>

          <div class="pr-helpful-text" data-helpful-text="${escapeHtml(reviewId)}">
            ${helpfulCount} people found this helpful
          </div>
        </div>
      </div>
    `;
  }

  function updateResultsMeta(totalMatched, totalVisible) {
    if (!resultsMetaEl) return;

    if (!totalMatched) {
      resultsMetaEl.textContent = "No reviews found";
      return;
    }

    resultsMetaEl.textContent = `Showing ${totalVisible} of ${totalMatched} reviews`;
  }

  function updateLoadMoreButton(totalMatched, totalVisible) {
    if (!loadMoreBtn) return;

    const remaining = totalMatched - totalVisible;
    loadMoreBtn.hidden = remaining <= 0;

    if (!loadMoreBtn.hidden) {
      const nextCount = Math.min(LOAD_MORE_STEP, remaining);
      loadMoreBtn.textContent = `Load ${nextCount} more reviews`;
    }
  }

  function renderVisibleReviews() {
    if (!listEl) return;

    const filteredSorted = getFilteredSortedReviews();
    const totalVisible = Math.min(visibleCount, filteredSorted.length);
    const reviewsToRender = filteredSorted.slice(0, totalVisible);

    updateResultsMeta(filteredSorted.length, totalVisible);

    if (!allReviews.length) {
      renderEmptyState();
      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    if (!filteredSorted.length) {
      listEl.innerHTML = `
        <div class="pr-empty">
          <div class="pr-empty-icon-wrap">
            <div class="pr-empty-icon">🔍</div>
            <div class="pr-empty-icon">💬</div>
          </div>
          <h4 class="pr-empty-title">No matching reviews</h4>
          <p>Try changing the filter, search, or sort option to see more reviews.</p>
        </div>
      `;

      if (loadMoreBtn) loadMoreBtn.hidden = true;
      return;
    }

    listEl.innerHTML = reviewsToRender
      .map((review, index) => renderReviewCard(review, index))
      .join("");

    updateLoadMoreButton(filteredSorted.length, totalVisible);
    bindReviewInteractions();
  }

  function renderReviewsState() {
    const totalReviews = Number(allReviews.length) || 0;
    const averageRating =
      totalReviews > 0
        ? allReviews.reduce(
            (sum, review) => sum + (Number(review.rating) || 0),
            0
          ) / totalReviews
        : 0;

    const ratingStats = getRatingStats(allReviews);

    if (summaryEl) {
      summaryEl.innerHTML = renderSummary(
        averageRating,
        totalReviews,
        ratingStats,
        allReviews
      );
    }

    renderVisibleReviews();
    bindSummaryActions();
  }

  function bindSummaryActions() {
    const writeBtn = root.querySelector("#pr-summary-write-review-btn");
    const filter5Btn = root.querySelector("#pr-summary-filter-5-btn");

    writeBtn?.addEventListener("click", openFormAndScroll);

    filter5Btn?.addEventListener("click", () => {
      setActiveFilter("5");
      root
        .querySelector(".pr-list-column")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function bindReviewInteractions() {
    const readMoreButtons = Array.from(root.querySelectorAll(".pr-read-more-btn"));
    readMoreButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        if (!targetId) return;

        const target = root.querySelector(`#${CSS.escape(targetId)}`);
        if (!target) return;

        const expanded = btn.getAttribute("data-expanded") === "true";

        if (expanded) {
          target.classList.add("is-clamped");
          btn.textContent = "Read more";
          btn.setAttribute("data-expanded", "false");
        } else {
          target.classList.remove("is-clamped");
          btn.textContent = "Show less";
          btn.setAttribute("data-expanded", "true");
        }
      });
    });

    const helpfulButtons = Array.from(root.querySelectorAll(".pr-helpful-btn"));
    helpfulButtons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-helpful");
        if (!id) return;

        const textEl = root.querySelector(`[data-helpful-text="${CSS.escape(id)}"]`);
        const alreadyMarked = btn.getAttribute("data-marked") === "true";

        btn.disabled = true;

        try {
          const response = await fetch(endpoint, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              reviewId: id,
              increment: !alreadyMarked,
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            showToast(result.message || "Failed to update helpful count", "error");
            return;
          }

          const updatedReview = result.data || {};
          const nextCount = Number(updatedReview.helpfulCount || 0);
          const nextMarked = !alreadyMarked;

          btn.setAttribute("data-count", String(nextCount));
          btn.setAttribute("data-marked", nextMarked ? "true" : "false");
          btn.classList.toggle("is-active", nextMarked);
          btn.textContent = nextMarked ? "✓ Marked helpful" : "👍 Helpful";

          if (textEl) {
            textEl.textContent = `${nextCount} people found this helpful`;
          }

          setMarkedHelpful(id, nextMarked);

          const reviewIndex = allReviews.findIndex(
            (review) => String(review.id) === String(id)
          );
          if (reviewIndex !== -1) {
            allReviews[reviewIndex].helpfulCount = nextCount;
          }
        } catch {
          showToast("Failed to update helpful count", "error");
        } finally {
          btn.disabled = false;
        }
      });
    });

    const galleryButtons = Array.from(root.querySelectorAll(".pr-review-image"));
    galleryButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        try {
          const raw = btn.getAttribute("data-lightbox-images") || "";
          const images = JSON.parse(decodeURIComponent(raw));
          const index = Number(btn.getAttribute("data-lightbox-index") || 0);
          openLightbox(images, index);
        } catch (error) {
          console.error("Lightbox error:", error);
        }
      });
    });
  }

  function setActiveFilter(nextFilter) {
    currentFilter = nextFilter;
    visibleCount = DEFAULT_VISIBLE_COUNT;

    filterChips.forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.rating === nextFilter);
    });

    renderVisibleReviews();
  }

  function setActiveSort(nextSort) {
    currentSort = nextSort;
    visibleCount = DEFAULT_VISIBLE_COUNT;

    sortButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.sort === nextSort);
    });

    renderVisibleReviews();
  }

  function updateStarUI(value) {
    const numericValue = Number(value) || 0;
    activeRating = numericValue;

    if (ratingInput) {
      ratingInput.value = numericValue ? String(numericValue) : "";
    }

    if (ratingLiveText) {
      ratingLiveText.textContent = numericValue
        ? RATING_LABELS[numericValue]
        : "Select rating";
    }

    starButtons.forEach((btn) => {
      const starValue = Number(btn.dataset.value);
      btn.classList.toggle("is-selected", starValue <= numericValue);
    });

    clearFieldError("rating");
  }

  function bindStarSelector() {
    starButtons.forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        const hoverValue = Number(btn.dataset.value);
        starButtons.forEach((starBtn) => {
          starBtn.classList.toggle(
            "is-active",
            Number(starBtn.dataset.value) <= hoverValue
          );
        });
      });

      btn.addEventListener("mouseleave", () => {
        starButtons.forEach((starBtn) => {
          starBtn.classList.remove("is-active");
        });
      });

      btn.addEventListener("click", () => {
        const value = Number(btn.dataset.value);
        updateStarUI(value);
      });
    });

    const selector = root.querySelector(".pr-star-selector");
    selector?.addEventListener("mouseleave", () => {
      starButtons.forEach((starBtn) => {
        starBtn.classList.remove("is-active");
      });
    });
  }

  function updateFileInputFromSelectedImages() {
    if (!imageInput) return;

    const dt = new DataTransfer();
    selectedImages.forEach((file) => dt.items.add(file));
    imageInput.files = dt.files;
  }

  function renderImagePreview(files) {
    if (!imagePreview || !imagePreviewWrap) return;

    imagePreview.innerHTML = "";

    if (!files.length) {
      imagePreviewWrap.hidden = true;
      return;
    }

    imagePreviewWrap.hidden = false;

    files.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const item = document.createElement("div");
        item.className = "pr-image-preview-item";
        item.innerHTML = `
          <img src="${escapeHtml(e.target?.result || "")}" alt="Preview">
          <button
            type="button"
            class="pr-image-preview-remove"
            data-remove-index="${index}"
            aria-label="Remove image"
          >
            ×
          </button>
        `;

        imagePreview.appendChild(item);

        const removeBtn = item.querySelector(".pr-image-preview-remove");
        removeBtn?.addEventListener("click", () => {
          selectedImages.splice(index, 1);
          updateFileInputFromSelectedImages();
          renderImagePreview(selectedImages);
          clearFieldError("reviewImages", uploadDropzone);
          uploadDropzone?.classList.remove("pr-invalid");
        });
      };

      reader.readAsDataURL(file);
    });
  }

  function renderVideoPreview(file) {
    if (!videoPreview || !videoPreviewWrap) return;

    if (!file) {
      videoPreview.innerHTML = "";
      videoPreviewWrap.hidden = true;
      return;
    }

    videoPreviewWrap.hidden = false;
    const videoUrl = URL.createObjectURL(file);

    videoPreview.innerHTML = `
      <div class="pr-video-preview-item">
        <video src="${videoUrl}" controls></video>
      </div>
    `;
  }

  function getFileUniqueKey(file) {
    return [file.name, file.size, file.lastModified, file.type].join("__");
  }

  function handleSelectedFiles(fileList) {
    const incomingFiles = Array.from(fileList || []);
    if (!incomingFiles.length) return;

    const validFiles = incomingFiles.filter((file) =>
      ["image/jpeg", "image/jpg", "image/png"].includes(file.type)
    );

    if (!validFiles.length) {
      setFieldError(
        "reviewImages",
        "Only JPG and PNG images are allowed.",
        uploadDropzone
      );
      uploadDropzone?.classList.add("pr-invalid");
      showToast("Only JPG and PNG images are allowed.", "error");
      return;
    }

    const existingMap = new Map(
      selectedImages.map((file) => [getFileUniqueKey(file), file])
    );

    validFiles.forEach((file) => {
      const key = getFileUniqueKey(file);
      if (!existingMap.has(key)) {
        existingMap.set(key, file);
      }
    });

    const mergedFiles = Array.from(existingMap.values());

    if (mergedFiles.length > MAX_REVIEW_IMAGES) {
      selectedImages = mergedFiles.slice(0, MAX_REVIEW_IMAGES);
      showToast(`You can upload up to ${MAX_REVIEW_IMAGES} images only.`, "error");
    } else {
      selectedImages = mergedFiles;
    }

    updateFileInputFromSelectedImages();
    renderImagePreview(selectedImages);
    clearFieldError("reviewImages", uploadDropzone);
    uploadDropzone?.classList.remove("pr-invalid");

    if (imageInput) {
      imageInput.value = "";
    }
  }

  function handleSelectedVideo(file) {
    if (!file) return;

    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    const maxVideoSize = MAX_VIDEO_SIZE_MB * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setFieldError(
        "reviewVideo",
        "Only MP4, WEBM, and MOV videos are allowed.",
        videoDropzone
      );
      videoDropzone?.classList.add("pr-invalid");
      showToast("Only MP4, WEBM, and MOV videos are allowed.", "error");
      return;
    }

    if (file.size > maxVideoSize) {
      setFieldError(
        "reviewVideo",
        `Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`,
        videoDropzone
      );
      videoDropzone?.classList.add("pr-invalid");
      showToast(`Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`, "error");
      return;
    }

    selectedVideoFile = file;
    renderVideoPreview(file);
    clearFieldError("reviewVideo", videoDropzone);
    videoDropzone?.classList.remove("pr-invalid");
  }

  function bindImageUploader() {
    imageInput?.addEventListener("change", (e) => {
      handleSelectedFiles(e.target.files);
    });

    uploadDropzone?.addEventListener("click", () => {
      imageInput?.click();
    });

    uploadDropzone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        imageInput?.click();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadDropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      uploadDropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.classList.remove("is-dragover");
      });
    });

    uploadDropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadDropzone.classList.remove("is-dragover");

      const files = e.dataTransfer?.files;
      if (files?.length) {
        handleSelectedFiles(files);
      }
    });
  }

  function bindVideoUploader() {
    videoInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) handleSelectedVideo(file);
    });

    videoDropzone?.addEventListener("click", () => {
      videoInput?.click();
    });

    videoDropzone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        videoInput?.click();
      }
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      videoDropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        videoDropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "dragend"].forEach((eventName) => {
      videoDropzone?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        videoDropzone.classList.remove("is-dragover");
      });
    });

    videoDropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      videoDropzone.classList.remove("is-dragover");

      const file = e.dataTransfer?.files?.[0];
      if (file) {
        handleSelectedVideo(file);
      }
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadVideoToCloudinary(file) {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      throw new Error("Cloudinary is not configured.");
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("upload_preset", cloudinaryUploadPreset);
    uploadFormData.append(
      "folder",
      `shopify-review-videos/${shop}/${reviewType}/${targetId || targetHandle || "store"}`
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/upload`,
      {
        method: "POST",
        body: uploadFormData,
      }
    );

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || "Video upload failed");
    }

    return result.secure_url;
  }

  function validateForm(showErrors = true) {
    if (!form) return false;

    const formData = new FormData(form);

    const customerName = formData.get("customerName")?.toString().trim() || "";
    const customerEmail = formData.get("customerEmail")?.toString().trim() || "";
    const title = formData.get("title")?.toString().trim() || "";
    const message = formData.get("message")?.toString().trim() || "";
    const youtubeUrl = formData.get("reviewYoutubeUrl")?.toString().trim() || "";
    const rating = Number(ratingInput?.value || 0);

    const nameInput = root.querySelector("#pr-customer-name");
    const emailInput = root.querySelector("#pr-customer-email");

    let isValid = true;

    if (!customerName) {
      isValid = false;
      if (showErrors) {
        setFieldError("customerName", "Name is required.", nameInput);
      }
    } else {
      clearFieldError("customerName", nameInput);
    }

    if (customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        isValid = false;
        if (showErrors) {
          setFieldError("customerEmail", "Please enter a valid email.", emailInput);
        }
      } else {
        clearFieldError("customerEmail", emailInput);
      }
    } else {
      clearFieldError("customerEmail", emailInput);
    }

    if (!rating) {
      isValid = false;
      if (showErrors) setFieldError("rating", "Please select a rating.");
    } else {
      clearFieldError("rating");
    }

    if (title.length > 80) {
      isValid = false;
      if (showErrors) {
        setFieldError("title", "Title should be 80 characters or less.", titleInput);
      }
    } else {
      clearFieldError("title", titleInput);
    }

    if (!message) {
      isValid = false;
      if (showErrors) {
        setFieldError("message", "Message is required.", messageInput);
      }
    } else if (message.length < 20) {
      isValid = false;
      if (showErrors) {
        setFieldError(
          "message",
          "Please write at least 20 characters for a better review.",
          messageInput
        );
      }
    } else {
      clearFieldError("message", messageInput);
    }

    if (selectedImages.length > MAX_REVIEW_IMAGES) {
      isValid = false;
      if (showErrors) {
        setFieldError(
          "reviewImages",
          `You can upload up to ${MAX_REVIEW_IMAGES} images only.`,
          uploadDropzone
        );
      }
    } else {
      clearFieldError("reviewImages", uploadDropzone);
    }

    if (youtubeUrl) {
      const normalizedYoutube = normalizeYoutubeEmbedUrl(youtubeUrl);
      if (!normalizedYoutube) {
        isValid = false;
        if (showErrors) {
          setFieldError(
            "reviewYoutubeUrl",
            "Please enter a valid YouTube link.",
            youtubeInput
          );
        }
      } else {
        clearFieldError("reviewYoutubeUrl", youtubeInput);
      }
    } else {
      clearFieldError("reviewYoutubeUrl", youtubeInput);
    }

    if (reviewType === "product" && !targetId) {
      isValid = false;
      if (showErrors && messageEl) {
        messageEl.className = "pr-message-box pr-message-error";
        messageEl.textContent = "Product target is missing.";
      }
    }

    if (reviewType === "collection" && !targetId && !targetHandle) {
      isValid = false;
      if (showErrors && messageEl) {
        messageEl.className = "pr-message-box pr-message-error";
        messageEl.textContent = "Collection target is missing.";
      }
    }

    if (reviewType === "store" && !shop) {
      isValid = false;
      if (showErrors && messageEl) {
        messageEl.className = "pr-message-box pr-message-error";
        messageEl.textContent = "Store target is missing.";
      }
    }

    return isValid;
  }

  function bindRealtimeValidation() {
    const nameInput = root.querySelector("#pr-customer-name");
    const emailInput = root.querySelector("#pr-customer-email");

    nameInput?.addEventListener("input", () => {
      if (nameInput.value.trim()) {
        clearFieldError("customerName", nameInput);
      }
    });

    emailInput?.addEventListener("input", () => {
      const email = emailInput.value.trim();

      if (!email) {
        clearFieldError("customerEmail", emailInput);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        clearFieldError("customerEmail", emailInput);
      }
    });

    titleInput?.addEventListener("input", () => {
      const count = titleInput.value.length;
      if (titleCount) titleCount.textContent = `${count} / 80`;

      if (count <= 80) {
        clearFieldError("title", titleInput);
      }
    });

    messageInput?.addEventListener("input", () => {
      const count = messageInput.value.length;
      if (messageCount) messageCount.textContent = `${count} / 1000`;

      if (count >= 20) {
        clearFieldError("message", messageInput);
      }
    });

    youtubeInput?.addEventListener("input", () => {
      const value = youtubeInput.value.trim();

      if (!value) {
        clearFieldError("reviewYoutubeUrl", youtubeInput);
        return;
      }

      if (normalizeYoutubeEmbedUrl(value)) {
        clearFieldError("reviewYoutubeUrl", youtubeInput);
      }
    });
  }

  function openFormAndScroll() {
    if (!formContainer || !toggleFormBtn) return;

    formContainer.classList.remove("is-collapsed");
    formContainer.classList.add("is-open");

    toggleFormBtn.setAttribute("aria-expanded", "true");
    toggleFormBtn.textContent = "Hide form";

    root
      .querySelector(".pr-form-section-card")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function bindFormToggle() {
    toggleFormBtn?.addEventListener("click", () => {
      const isOpen = formContainer?.classList.contains("is-open");

      if (isOpen) {
        formContainer?.classList.remove("is-open");
        formContainer?.classList.add("is-collapsed");
        toggleFormBtn.setAttribute("aria-expanded", "false");
        toggleFormBtn.textContent = "Write a review";
      } else {
        formContainer?.classList.remove("is-collapsed");
        formContainer?.classList.add("is-open");
        toggleFormBtn.setAttribute("aria-expanded", "true");
        toggleFormBtn.textContent = "Hide form";
      }
    });
  }

  function openLightbox(images, index = 0) {
    if (
      !lightbox ||
      !lightboxImage ||
      !Array.isArray(images) ||
      !images.length
    ) {
      return;
    }

    lightboxImages = images;
    lightboxIndex = Math.max(0, Math.min(index, images.length - 1));
    updateLightbox();

    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
  }

  function updateLightbox() {
    if (!lightboxImage || !lightboxCounter || !lightboxImages.length) return;

    lightboxImage.src = lightboxImages[lightboxIndex];
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  }

  function showPrevLightbox() {
    if (!lightboxImages.length) return;
    lightboxIndex =
      (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
  }

  function showNextLightbox() {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    updateLightbox();
  }

  function bindLightbox() {
    lightboxClose?.addEventListener("click", closeLightbox);
    lightboxPrev?.addEventListener("click", showPrevLightbox);
    lightboxNext?.addEventListener("click", showNextLightbox);

    lightbox?.addEventListener("click", (e) => {
      const closeTrigger = e.target.closest("[data-close-lightbox='true']");
      if (closeTrigger) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (lightbox?.hidden) return;

      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showPrevLightbox();
      if (e.key === "ArrowRight") showNextLightbox();
    });
  }

  function buildReviewsUrl() {
    const params = new URLSearchParams();
    params.set("shop", shop);
    params.set("approvedOnly", "true");
    params.set("reviewType", reviewType);

    if (reviewType === "product") {
      params.set("targetId", targetId || productId);
    } else if (reviewType === "collection") {
      if (targetId) params.set("targetId", targetId);
      if (targetHandle) params.set("targetHandle", targetHandle);
    } else if (reviewType === "store") {
      // only shop and reviewType needed
    }

    return `${endpoint}?${params.toString()}`;
  }

  async function loadReviews() {
    renderLoadingState();

    try {
      const response = await fetch(buildReviewsUrl(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        renderErrorState(result.message || "Failed to load reviews");
        return;
      }

      allReviews = Array.isArray(result?.data) ? result.data : [];
      renderReviewsState();
    } catch {
      renderErrorState("Failed to load reviews");
    }
  }

  filterChipsWrap?.addEventListener("click", (e) => {
    const chip = e.target.closest(".pr-filter-chip");
    if (!chip) return;
    setActiveFilter(chip.dataset.rating || "all");
  });

  sortSegment?.addEventListener("click", (e) => {
    const btn = e.target.closest(".pr-sort-btn");
    if (!btn) return;
    setActiveSort(btn.dataset.sort || "newest");
  });

  searchInput?.addEventListener("input", (e) => {
    currentSearch = e.target.value || "";
    visibleCount = DEFAULT_VISIBLE_COUNT;
    renderVisibleReviews();
  });

  loadMoreBtn?.addEventListener("click", () => {
    visibleCount += LOAD_MORE_STEP;
    renderVisibleReviews();
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (messageEl) {
        messageEl.className = "pr-message-box";
        messageEl.textContent = "";
      }

      const isValid = validateForm(true);

      if (!isValid) {
        if (messageEl && !messageEl.textContent) {
          messageEl.className = "pr-message-box pr-message-error";
          messageEl.textContent = "Please fix the highlighted fields.";
        }
        showToast("Please fix the highlighted fields.", "error");
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Publishing...";
      }

      const formData = new FormData(form);

      let imageUrls = [];
      if (selectedImages.length) {
        imageUrls = await Promise.all(selectedImages.map(fileToDataUrl));
      }

      let uploadedVideoUrl = null;
      const youtubeUrl = formData.get("reviewYoutubeUrl")?.toString().trim() || "";

      if (selectedVideoFile) {
        try {
          uploadedVideoUrl = await uploadVideoToCloudinary(selectedVideoFile);
        } catch (error) {
          if (messageEl) {
            messageEl.className = "pr-message-box pr-message-error";
            messageEl.textContent = error.message || "Video upload failed.";
          }

          showToast(error.message || "Video upload failed.", "error");

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Publish Review";
          }
          return;
        }
      }

      const payload = {
        shop,
        reviewType,
        targetId: reviewType !== "store" ? (targetId || productId || "") : null,
        targetHandle: reviewType === "collection" ? targetHandle || null : null,
        targetTitle: targetTitle || productTitle || null,
        productId: reviewType === "product" ? (productId || targetId || "") : null,
        productTitle: reviewType === "product" ? (productTitle || targetTitle || null) : null,
        customerName: formData.get("customerName")?.toString().trim(),
        customerEmail: formData.get("customerEmail")?.toString().trim(),
        rating: Number(ratingInput?.value),
        title: formData.get("title")?.toString().trim(),
        message: formData.get("message")?.toString().trim(),
        reviewImages: imageUrls,
        reviewVideoUrl: uploadedVideoUrl,
        reviewYoutubeUrl: youtubeUrl,
      };

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          if (messageEl) {
            messageEl.className = "pr-message-box pr-message-error";
            messageEl.textContent = result.message || "Failed to submit review";
          }

          showToast(result.message || "Failed to submit review", "error");

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Publish Review";
          }
          return;
        }

        if (messageEl) {
          messageEl.className = "pr-message-box pr-message-success";
          messageEl.textContent =
            result.message || "Review submitted successfully.";
        }

        showToast("Thanks for sharing your feedback!", "success");

        form.reset();
        selectedImages = [];
        selectedVideoFile = null;

        updateFileInputFromSelectedImages();
        renderVideoPreview(null);

        if (imagePreview) imagePreview.innerHTML = "";
        if (imagePreviewWrap) imagePreviewWrap.hidden = true;

        if (videoInput) videoInput.value = "";
        if (youtubeInput) youtubeInput.value = "";

        updateStarUI(0);

        if (titleCount) titleCount.textContent = "0 / 80";
        if (messageCount) messageCount.textContent = "0 / 1000";

        clearFieldError("customerName", root.querySelector("#pr-customer-name"));
        clearFieldError("customerEmail", root.querySelector("#pr-customer-email"));
        clearFieldError("title", titleInput);
        clearFieldError("message", messageInput);
        clearFieldError("rating");
        clearFieldError("reviewImages", uploadDropzone);
        clearFieldError("reviewVideo", videoDropzone);
        clearFieldError("reviewYoutubeUrl", youtubeInput);

        uploadDropzone?.classList.remove("pr-invalid");
        videoDropzone?.classList.remove("pr-invalid");

        await loadReviews();
      } catch {
        if (messageEl) {
          messageEl.className = "pr-message-box pr-message-error";
          messageEl.textContent =
            "Something went wrong while submitting review.";
        }

        showToast("Something went wrong while submitting review.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Publish Review";
        }
      }
    });
  }

  bindStarSelector();
  bindImageUploader();
  bindVideoUploader();
  bindRealtimeValidation();
  bindFormToggle();
  bindLightbox();
  updateStarUI(0);

  if (titleCount) titleCount.textContent = "0 / 80";
  if (messageCount) messageCount.textContent = "0 / 1000";

  await loadReviews();
});
