(function () {
  const FETCH_LIMIT = 50;
  const MAX_FETCH_PAGES = 40;

  const reviewFlowScriptPromises = new Map();
  const reviewFlowInstances = new WeakMap();

  function loadReviewFlowScript(src) {
    if (!src) {
      return Promise.reject(new Error("Review flow script URL is missing."));
    }

    if (window.HappyCustomersReviewFlow) {
      return Promise.resolve(window.HappyCustomersReviewFlow);
    }

    if (reviewFlowScriptPromises.has(src)) {
      return reviewFlowScriptPromises.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        `script[data-hcr-review-flow-script="${src}"]`
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          if (window.HappyCustomersReviewFlow) {
            resolve(window.HappyCustomersReviewFlow);
          } else {
            reject(new Error("Review flow script loaded but module not found."));
          }
        });

        existingScript.addEventListener("error", () => {
          reject(new Error("Failed to load review flow script."));
        });

        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.hcrReviewFlowScript = src;

      script.onload = () => {
        if (window.HappyCustomersReviewFlow) {
          resolve(window.HappyCustomersReviewFlow);
        } else {
          reject(new Error("Review flow script loaded but module not found."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load review flow script."));
      };

      document.head.appendChild(script);
    });

    reviewFlowScriptPromises.set(src, promise);
    return promise;
  }

  function initAllHappyCustomersReviews(scope = document) {
    const roots = Array.from(scope.querySelectorAll(".hcr-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      if (root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initHappyCustomersReviews(root);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAllHappyCustomersReviews(document);
  });

  document.addEventListener("shopify:section:load", (event) => {
    initAllHappyCustomersReviews(event.target || document);
  });

  function initHappyCustomersReviews(root) {
    const endpoint = root.dataset.endpoint || "";
    const shop = root.dataset.shop || "";
    const shopName = root.dataset.shopName || "";
    const defaultTab = safeLower(root.dataset.defaultTab || "product");
    const reviewsPerPage = Math.max(1, Number(root.dataset.reviewsPerPage || 5));
    const defaultSort = safeLower(root.dataset.defaultSort || "most_recent");
    const showBarChart = toBoolean(root.dataset.showBarChart, true);
    const showMediaGallery = toBoolean(root.dataset.showMediaGallery, true);
    const showFilters = toBoolean(root.dataset.showFilters, true);
    const showSort = toBoolean(root.dataset.showSort, true);
    const imageStyle = safeLower(root.dataset.imageStyle || "thumbnails");
    const verifiedBadgeStyle = safeLower(
      root.dataset.verifiedBadgeStyle || "standard_text"
    );
    const reviewerNameFormat = safeLower(
      root.dataset.reviewerNameFormat || "full_name"
    );

    const reviewFlowScript = root.dataset.reviewFlowScript || "";
    const reviewFlowHost =
      root.querySelector("[data-hcr-review-flow-host]") || root;
    const openReviewFlowBtn = root.querySelector("[data-hcr-open-review-flow]");
    const fallbackWriteReviewUrl = root.dataset.fallbackWriteReviewUrl || "";
    const cloudinaryCloudName = root.dataset.cloudinaryCloudName || "";
    const cloudinaryUploadPreset = root.dataset.cloudinaryUploadPreset || "";
    const productsJsonUrl = root.dataset.productsJsonUrl || "";
    const predictiveSearchUrl = root.dataset.predictiveSearchUrl || "";
    const searchUrl = root.dataset.searchUrl || "";
    const rootUrl = root.dataset.rootUrl || "/";

    const summaryAverageEl = root.querySelector(".hcr-summary-average");
    const summaryCountEl = root.querySelector(".hcr-summary-count");
    const summaryVerifiedEl = root.querySelector(".hcr-summary-verified");

    const barChartEl = root.querySelector(".hcr-bar-chart");
    const mediaGalleryEl = root.querySelector(".hcr-media-gallery");
    const mediaGridEl = root.querySelector(".hcr-media-grid");

    const tabButtons = Array.from(root.querySelectorAll(".hcr-tab"));
    const filterToggleBtn = root.querySelector(".hcr-filter-toggle");
    const filtersPanel = root.querySelector(".hcr-filters-panel");
    const ratingChipButtons = Array.from(
      root.querySelectorAll(".hcr-rating-chips .hcr-chip")
    );
    const keywordChipsEl = root.querySelector(".hcr-keyword-chips");
    const searchInput = root.querySelector(".hcr-search-input");
    const clearFiltersBtn = root.querySelector(".hcr-clear-filters");
    const sortSelect = root.querySelector(".hcr-sort-select");

    const loadingStateEl = root.querySelector(".hcr-reviews-state--loading");
    const emptyStateEl = root.querySelector(".hcr-reviews-state--empty");
    const reviewsListEl = root.querySelector(".hcr-reviews-list");

    const paginationEl = root.querySelector(".hcr-pagination");
    const prevPageBtn = root.querySelector(".hcr-page-btn--prev");
    const nextPageBtn = root.querySelector(".hcr-page-btn--next");
    const pageNumbersEl = root.querySelector(".hcr-page-numbers");

    const reviewTemplate = root.querySelector('[id^="hcr-review-card-template-"]');

    const state = {
      allReviews: [],
      productReviews: [],
      storeReviews: [],
      activeTab: defaultTab === "store" ? "store" : "product",
      ratingFilter: "all",
      selectedKeyword: "",
      searchTerm: "",
      sortBy: normalizeSort(defaultSort),
      currentPage: 1,
      filteredReviews: [],
      modal: {
        isOpen: false,
        entries: [],
        activeIndex: 0,
      },
    };

    const modalRefs = createMediaModal();

    function toBoolean(value, fallback) {
      if (value === undefined || value === null || value === "") return fallback;
      return String(value).toLowerCase() === "true";
    }

    function safeText(value) {
      return value === null || value === undefined ? "" : String(value);
    }

    function safeLower(value) {
      return safeText(value).trim().toLowerCase();
    }

    function normalizeSort(value) {
      const normalized = safeLower(value);
      if (
        normalized === "highest_rating" ||
        normalized === "lowest_rating" ||
        normalized === "oldest"
      ) {
        return normalized;
      }
      return "most_recent";
    }

    function escapeHtml(value) {
      return safeText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    async function ensureReviewFlowInstance() {
      if (reviewFlowInstances.has(root)) {
        return reviewFlowInstances.get(root);
      }

      const ReviewFlowModule = await loadReviewFlowScript(reviewFlowScript);

      if (!ReviewFlowModule || typeof ReviewFlowModule.create !== "function") {
        throw new Error("Review flow module is invalid.");
      }

      const instance = await ReviewFlowModule.create({
        root,
        host: reviewFlowHost,
        config: {
          endpoint,
          shop,
          shopName,
          cloudinaryCloudName,
          cloudinaryUploadPreset,
          productsJsonUrl,
          predictiveSearchUrl,
          searchUrl,
          rootUrl,
          fallbackWriteReviewUrl,
        },
        onSubmitted: async (payload = {}) => {
          await loadReviews();

          if (payload.reviewType === "store") {
            setActiveTab("store");
          } else if (payload.reviewType === "product") {
            setActiveTab("product");
          }
        },
      });

      reviewFlowInstances.set(root, instance);
      return instance;
    }

    async function handleOpenReviewFlow() {
      if (!openReviewFlowBtn) return;

      const originalLabel = openReviewFlowBtn.textContent;
      openReviewFlowBtn.disabled = true;
      openReviewFlowBtn.classList.add("is-loading");
      openReviewFlowBtn.textContent = "Loading...";

      try {
        const instance = await ensureReviewFlowInstance();

        if (!instance || typeof instance.open !== "function") {
          throw new Error("Review flow instance is missing open().");
        }

        instance.open();
      } catch (error) {
        console.error("Happy Customers Review Flow Error:", error);

        if (fallbackWriteReviewUrl) {
          window.location.href = fallbackWriteReviewUrl;
          return;
        }

        window.alert("Review form load nahi ho paya. Please try again.");
      } finally {
        openReviewFlowBtn.disabled = false;
        openReviewFlowBtn.classList.remove("is-loading");
        openReviewFlowBtn.textContent = originalLabel;
      }
    }

    function getReviewId(review, index) {
      const primary =
        safeText(review.id || review._id || review.reviewId || review.review_id).trim();
      if (primary) return primary;

      return [
        safeText(review.customerName || review.customer_name || review.name),
        safeText(
          review.productId ||
            review.product_id ||
            review.targetId ||
            review.target_id ||
            review.product?.id
        ),
        safeText(review.createdAt || review.updatedAt),
        safeText(review.title || review.reviewTitle),
        index,
      ].join("|");
    }

    function getReviewType(review) {
      const type = safeLower(
        review.reviewType || review.review_type || review.type || ""
      );

      if (
        type === "store" ||
        type === "store_review" ||
        type === "store reviews"
      ) {
        return "store";
      }

      return "product";
    }

    function isApproved(review) {
      const rawStatus = safeLower(review.status || "");
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

    function getRatingValue(review) {
      const rating = Number(review.rating) || 0;
      return Math.max(0, Math.min(5, rating));
    }

    function renderStarsText(rating) {
      const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
      const rounded = Math.round(safeRating);
      return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
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

    function formatDate(dateValue) {
      const time = parseDateValue(dateValue);
      if (!time) return "";

      return new Date(time).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    function getCustomerName(review) {
      const name = safeText(
        review.customerName || review.customer_name || review.name || ""
      ).trim();

      return name || "Anonymous";
    }

    function formatReviewerName(name) {
      const clean = safeText(name).trim();
      if (!clean) return "Anonymous";

      const parts = clean.split(/\s+/).filter(Boolean);
      if (!parts.length) return "Anonymous";

      if (reviewerNameFormat === "first_name_last_initial") {
        if (parts.length === 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1]
          .charAt(0)
          .toUpperCase()}.`;
      }

      if (reviewerNameFormat === "first_initial_last_name") {
        if (parts.length === 1) return parts[0];
        return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`;
      }

      return clean;
    }

    function getAvatarLetter(name) {
      const clean = safeText(name).trim();
      return clean ? clean.charAt(0).toUpperCase() : "A";
    }

    function getReviewTitle(review) {
      return safeText(review.title || review.reviewTitle || "").trim();
    }

    function getReviewMessage(review) {
      return safeText(review.message || review.review || review.content || "").trim();
    }

    function getProductTitle(review) {
      return safeText(
        review.productTitle ||
          review.product_title ||
          review.targetTitle ||
          review.target_title ||
          review.product?.title ||
          ""
      ).trim();
    }

    function getSourceLabel(review) {
      const productTitle = getProductTitle(review);
      if (getReviewType(review) === "store") return "Store review";
      return productTitle || "Product review";
    }

    function getImageUrls(review) {
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

      const results = [...directCandidates];

      const arraysToCheck = [
        review.reviewImages,
        review.review_images,
        review.images,
        review.media,
      ];

      arraysToCheck.forEach((group) => {
        if (!Array.isArray(group)) return;

        group.forEach((item) => {
          if (typeof item === "string" && item.trim()) {
            results.push(item.trim());
            return;
          }

          if (item && typeof item === "object") {
            const url = safeText(
              item.url || item.src || item.secure_url || item.image
            ).trim();

            if (url) results.push(url);
          }
        });
      });

      return Array.from(new Set(results));
    }

    function isVideoUrl(url) {
      const clean = safeLower(url);
      return (
        clean.includes(".mp4") ||
        clean.includes(".webm") ||
        clean.includes(".mov") ||
        clean.includes(".m4v")
      );
    }

    function getYouTubeId(value) {
      const raw = safeText(value).trim();
      if (!raw) return "";

      try {
        const parsed = new URL(raw);

        if (parsed.hostname.includes("youtu.be")) {
          return parsed.pathname.replace("/", "").trim();
        }

        if (parsed.pathname === "/watch") {
          return parsed.searchParams.get("v") || "";
        }

        if (parsed.pathname.startsWith("/shorts/")) {
          return parsed.pathname.split("/shorts/")[1]?.split("/")[0] || "";
        }

        if (parsed.pathname.startsWith("/embed/")) {
          return parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }

        return "";
      } catch (error) {
        const embedMatch = raw.match(/youtube\.com\/embed\/([^?&/]+)/i);
        if (embedMatch?.[1]) return embedMatch[1];

        const watchMatch = raw.match(/[?&]v=([^?&/]+)/i);
        if (watchMatch?.[1]) return watchMatch[1];

        return "";
      }
    }

    function getYouTubeEmbedUrl(value) {
      const id = getYouTubeId(value);
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    function getYouTubeThumbUrl(value) {
      const id = getYouTubeId(value);
      return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
    }

    function getReviewMediaItems(review) {
      const items = [];
      const seen = new Set();

      function pushMedia(type, src, thumb) {
        const cleanSrc = safeText(src).trim();
        if (!cleanSrc) return;

        const key = `${type}|${cleanSrc}`;
        if (seen.has(key)) return;
        seen.add(key);

        items.push({
          type,
          src: cleanSrc,
          thumb: safeText(thumb || cleanSrc).trim(),
        });
      }

      getImageUrls(review).forEach((url) => {
        if (getYouTubeId(url)) {
          const embed = getYouTubeEmbedUrl(url);
          const thumb = getYouTubeThumbUrl(url);
          if (embed) pushMedia("youtube", embed, thumb);
          return;
        }

        if (isVideoUrl(url)) {
          pushMedia("video", url, url);
          return;
        }

        pushMedia("image", url, url);
      });

      const reviewVideoUrl = safeText(review.reviewVideoUrl).trim();
      if (reviewVideoUrl) {
        pushMedia("video", reviewVideoUrl, reviewVideoUrl);
      }

      const reviewYoutubeUrl = safeText(review.reviewYoutubeUrl).trim();
      if (reviewYoutubeUrl) {
        const embed = getYouTubeEmbedUrl(reviewYoutubeUrl);
        const thumb = getYouTubeThumbUrl(reviewYoutubeUrl);
        if (embed) pushMedia("youtube", embed, thumb);
      }

      return items;
    }

    function buildMediaReviewEntries(items) {
      return items
        .map((review, index) => {
          const mediaItems = getReviewMediaItems(review);
          return {
            id: getReviewId(review, index),
            review,
            mediaItems,
            previewMedia: mediaItems[0] || null,
          };
        })
        .filter((entry) => entry.previewMedia);
    }

    function getAverageRating(items) {
      if (!items.length) return 0;
      const total = items.reduce((sum, item) => sum + getRatingValue(item), 0);
      return total / items.length;
    }

    function getActiveBaseReviews() {
      return state.activeTab === "store" ? state.storeReviews : state.productReviews;
    }

    function getReviewSearchBlob(review) {
      return [
        getCustomerName(review),
        getReviewTitle(review),
        getReviewMessage(review),
        getProductTitle(review),
        getSourceLabel(review),
      ]
        .join(" ")
        .toLowerCase();
    }

    function extractKeywords(items) {
      const stopWords = new Set([
        "this",
        "that",
        "with",
        "from",
        "your",
        "have",
        "been",
        "they",
        "them",
        "very",
        "really",
        "would",
        "could",
        "there",
        "their",
        "what",
        "when",
        "where",
        "which",
        "about",
        "after",
        "before",
        "again",
        "into",
        "over",
        "under",
        "just",
        "than",
        "then",
        "more",
        "most",
        "good",
        "great",
        "nice",
        "best",
        "love",
        "like",
        "amazing",
        "product",
        "store",
        "review",
        "reviews",
        "customer",
        "customers",
        "quality",
      ]);

      const counts = new Map();

      items.forEach((review) => {
        const text = [getReviewTitle(review), getReviewMessage(review), getProductTitle(review)]
          .join(" ")
          .toLowerCase();

        const words = text.match(/[a-z][a-z0-9-]{2,}/g) || [];

        words.forEach((word) => {
          if (stopWords.has(word)) return;
          counts.set(word, (counts.get(word) || 0) + 1);
        });
      });

      const keywords = Array.from(counts.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .slice(0, 8)
        .map((entry) => entry[0]);

      if (state.selectedKeyword && !keywords.includes(state.selectedKeyword)) {
        keywords.unshift(state.selectedKeyword);
      }

      return keywords.slice(0, 8);
    }

    function filterReviews(items) {
      return items.filter((review) => {
        const rating = getRatingValue(review);

        if (state.ratingFilter !== "all" && rating !== Number(state.ratingFilter)) {
          return false;
        }

        if (state.selectedKeyword) {
          const blob = getReviewSearchBlob(review);
          if (!blob.includes(state.selectedKeyword.toLowerCase())) {
            return false;
          }
        }

        if (state.searchTerm) {
          const blob = getReviewSearchBlob(review);
          if (!blob.includes(state.searchTerm.toLowerCase())) {
            return false;
          }
        }

        return true;
      });
    }

    function sortReviews(items) {
      const sorted = items.slice();

      sorted.sort((a, b) => {
        const ratingDiff = getRatingValue(b) - getRatingValue(a);
        const dateA = parseDateValue(a.updatedAt || a.createdAt);
        const dateB = parseDateValue(b.updatedAt || b.createdAt);

        if (state.sortBy === "highest_rating") {
          if (ratingDiff !== 0) return ratingDiff;
          return dateB - dateA;
        }

        if (state.sortBy === "lowest_rating") {
          const ascRatingDiff = getRatingValue(a) - getRatingValue(b);
          if (ascRatingDiff !== 0) return ascRatingDiff;
          return dateB - dateA;
        }

        if (state.sortBy === "oldest") {
          return dateA - dateB;
        }

        return dateB - dateA;
      });

      return sorted;
    }

    function updateTabCounts() {
      tabButtons.forEach((button) => {
        const tab = button.dataset.tab === "store" ? "store" : "product";
        const count = tab === "store" ? state.storeReviews.length : state.productReviews.length;
        const countEl = button.querySelector(".hcr-tab-count");
        if (countEl) {
          countEl.textContent = `(${count})`;
        }

        const isActive = state.activeTab === tab;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    function updateSummary(items) {
      const average = getAverageRating(items);
      const total = items.length;
      const verifiedCount = items.filter(isVerified).length;

      if (summaryAverageEl) {
        summaryAverageEl.textContent = average.toFixed(1);
      }

      if (summaryCountEl) {
        summaryCountEl.textContent = `${total} review${total !== 1 ? "s" : ""}`;
      }

      if (summaryVerifiedEl) {
        summaryVerifiedEl.hidden = verifiedCount === 0;
      }
    }

    function updateBarChart(items) {
      if (!showBarChart || !barChartEl) return;

      const total = items.length || 1;
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      items.forEach((review) => {
        const rating = Math.round(getRatingValue(review));
        if (counts[rating] !== undefined) {
          counts[rating] += 1;
        }
      });

      const rows = Array.from(barChartEl.querySelectorAll(".hcr-bar-row"));
      rows.forEach((row) => {
        const star = Number(row.getAttribute("data-star-row"));
        const count = counts[star] || 0;
        const percent = total ? (count / total) * 100 : 0;
        const fillEl = row.querySelector(".hcr-bar-fill");
        const valueEl = row.querySelector(".hcr-bar-value");

        if (fillEl) {
          fillEl.style.width = `${percent}%`;
        }

        if (valueEl) {
          valueEl.textContent = String(count);
        }
      });
    }

    function createThumbMediaNode(media, altText) {
      if (!media) return document.createTextNode("");

      if (media.type === "video") {
        const video = document.createElement("video");
        video.src = media.src;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", safeText(altText || "Review media"));
        return video;
      }

      const img = document.createElement("img");
      img.src = media.thumb || media.src;
      img.alt = safeText(altText || "Review media");
      img.loading = "lazy";
      return img;
    }

    function createStageMediaNode(media, altText) {
      if (!media) return document.createTextNode("");

      if (media.type === "video") {
        const video = document.createElement("video");
        video.src = media.src;
        video.controls = true;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("aria-label", safeText(altText || "Review media"));
        return video;
      }

      if (media.type === "youtube") {
        const iframe = document.createElement("iframe");
        const joiner = media.src.includes("?") ? "&" : "?";
        iframe.src = `${media.src}${joiner}autoplay=1&rel=0&modestbranding=1`;
        iframe.title = safeText(altText || "Review media");
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        );
        iframe.setAttribute("allowfullscreen", "true");
        iframe.setAttribute("frameborder", "0");
        return iframe;
      }

      const img = document.createElement("img");
      img.src = media.src;
      img.alt = safeText(altText || "Review media");
      img.loading = "lazy";
      return img;
    }

    function syncModalEntries(items) {
      state.modal.entries = buildMediaReviewEntries(items);

      if (!state.modal.entries.length) {
        if (state.modal.isOpen) {
          closeMediaModal();
        }
        return;
      }

      if (state.modal.activeIndex > state.modal.entries.length - 1) {
        state.modal.activeIndex = 0;
      }

      if (state.modal.isOpen) {
        renderMediaModal();
      }
    }

    function updateMediaGallery(items) {
      if (!mediaGalleryEl || !mediaGridEl) return;

      syncModalEntries(items);

      if (!showMediaGallery) {
        mediaGalleryEl.hidden = true;
        return;
      }

      const mediaEntries = state.modal.entries;
      mediaGridEl.innerHTML = "";

      if (!mediaEntries.length) {
        mediaGalleryEl.hidden = true;
        return;
      }

      mediaGalleryEl.hidden = false;

      mediaEntries.slice(0, 4).forEach((entry, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hcr-media-thumb";
        button.setAttribute("data-review-index", String(index));
        button.setAttribute(
          "aria-label",
          `Open review from ${formatReviewerName(getCustomerName(entry.review))}`
        );

        button.appendChild(
          createThumbMediaNode(
            entry.previewMedia,
            getReviewTitle(entry.review) || getSourceLabel(entry.review)
          )
        );

        mediaGridEl.appendChild(button);
      });
    }

    function hideLoading() {
      if (loadingStateEl) loadingStateEl.hidden = true;
    }

    function showLoading() {
      if (loadingStateEl) loadingStateEl.hidden = false;
      if (emptyStateEl) emptyStateEl.hidden = true;
      if (reviewsListEl) reviewsListEl.hidden = true;
      if (paginationEl) paginationEl.hidden = true;
    }

    function showEmpty() {
      hideLoading();
      if (emptyStateEl) emptyStateEl.hidden = false;
      if (reviewsListEl) reviewsListEl.hidden = true;
      if (paginationEl) paginationEl.hidden = true;
      if (mediaGalleryEl && showMediaGallery) mediaGalleryEl.hidden = true;
      updateSummary([]);
      updateBarChart([]);
      closeMediaModal();
    }

    function renderKeywordChips(items) {
      if (!keywordChipsEl) return;

      const keywords = extractKeywords(items);
      keywordChipsEl.innerHTML = "";

      keywords.forEach((keyword) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hcr-chip";
        button.setAttribute("data-keyword", keyword);
        button.textContent = capitalizeWord(keyword);

        if (state.selectedKeyword === keyword) {
          button.classList.add("is-active");
          button.setAttribute("aria-pressed", "true");
        }

        keywordChipsEl.appendChild(button);
      });
    }

    function capitalizeWord(word) {
      const clean = safeText(word).trim();
      if (!clean) return "";
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    function updateRatingChipState() {
      ratingChipButtons.forEach((button) => {
        const value = button.getAttribute("data-rating") || "all";
        const active = value === String(state.ratingFilter);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function renderReviewCards(items) {
      if (!reviewsListEl) return;

      reviewsListEl.innerHTML = "";

      items.forEach((review) => {
        let fragment = null;

        if (reviewTemplate && reviewTemplate.content) {
          fragment = reviewTemplate.content.cloneNode(true);
        } else {
          fragment = document.createDocumentFragment();
          const article = document.createElement("article");
          article.className = "hcr-review-card";
          article.innerHTML = `
            <div class="hcr-review-stars"></div>
            <div class="hcr-review-meta">
              <div class="hcr-reviewer-avatar"></div>
              <div class="hcr-reviewer-info">
                <div class="hcr-reviewer-topline">
                  <div class="hcr-reviewer-name"></div>
                  <div class="hcr-review-verified"></div>
                </div>
              </div>
            </div>
            <h4 class="hcr-review-title"></h4>
            <div class="hcr-review-text"></div>
            <div class="hcr-review-media-row"></div>
            <div class="hcr-review-footer">
              <div class="hcr-review-source-badge"></div>
              <div class="hcr-review-date"></div>
            </div>
          `;
          fragment.appendChild(article);
        }

        const starsEl = fragment.querySelector(".hcr-review-stars");
        const avatarEl = fragment.querySelector(".hcr-reviewer-avatar");
        const nameEl = fragment.querySelector(".hcr-reviewer-name");
        const verifiedEl = fragment.querySelector(".hcr-review-verified");
        const titleEl = fragment.querySelector(".hcr-review-title");
        const textEl = fragment.querySelector(".hcr-review-text");
        const mediaRowEl = fragment.querySelector(".hcr-review-media-row");
        const sourceBadgeEl = fragment.querySelector(".hcr-review-source-badge");
        const dateEl = fragment.querySelector(".hcr-review-date");

        const rawName = getCustomerName(review);
        const displayName = formatReviewerName(rawName);
        const title = getReviewTitle(review);
        const message = getReviewMessage(review);
        const media = getReviewMediaItems(review).slice(0, 4);

        if (starsEl) {
          starsEl.textContent = renderStarsText(getRatingValue(review));
        }

        if (avatarEl) {
          avatarEl.textContent = getAvatarLetter(rawName);
        }

        if (nameEl) {
          nameEl.textContent = displayName;
        }

        if (verifiedEl) {
          if (verifiedBadgeStyle === "hidden" || !isVerified(review)) {
            verifiedEl.classList.add("is-hidden");
            verifiedEl.textContent = "";
          } else {
            verifiedEl.classList.remove("is-hidden");
            verifiedEl.textContent = "Verified";
          }
        }

        if (titleEl) {
          if (title) {
            titleEl.hidden = false;
            titleEl.textContent = title;
          } else {
            titleEl.hidden = true;
            titleEl.textContent = "";
          }
        }

        if (textEl) {
          textEl.textContent = message;
        }

        if (mediaRowEl) {
          mediaRowEl.innerHTML = "";

          if (imageStyle === "hidden" || !media.length) {
            mediaRowEl.hidden = true;
          } else {
            mediaRowEl.hidden = false;

            media.forEach((mediaItem) => {
              const item = document.createElement("div");
              item.className = "hcr-review-media-item";
              item.appendChild(
                createThumbMediaNode(
                  mediaItem,
                  title || getSourceLabel(review) || "Review media"
                )
              );
              mediaRowEl.appendChild(item);
            });
          }
        }

        if (sourceBadgeEl) {
          sourceBadgeEl.textContent = getSourceLabel(review);
        }

        if (dateEl) {
          dateEl.textContent = formatDate(review.updatedAt || review.createdAt);
        }

        reviewsListEl.appendChild(fragment);
      });

      reviewsListEl.hidden = false;
    }

    function renderPagination(totalItems) {
      if (!paginationEl || !pageNumbersEl || !prevPageBtn || !nextPageBtn) return;

      const totalPages = Math.max(1, Math.ceil(totalItems / reviewsPerPage));
      state.currentPage = Math.min(state.currentPage, totalPages);

      if (totalItems <= reviewsPerPage) {
        paginationEl.hidden = true;
        pageNumbersEl.innerHTML = "";
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
      }

      paginationEl.hidden = false;
      pageNumbersEl.innerHTML = "";

      for (let page = 1; page <= totalPages; page += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hcr-page-number";
        button.textContent = String(page);
        button.setAttribute("data-page", String(page));

        if (page === state.currentPage) {
          button.classList.add("is-active");
        }

        pageNumbersEl.appendChild(button);
      }

      prevPageBtn.disabled = state.currentPage <= 1;
      nextPageBtn.disabled = state.currentPage >= totalPages;
    }

    function applyAll() {
      const activeBaseReviews = getActiveBaseReviews();

      updateTabCounts();
      renderKeywordChips(activeBaseReviews);
      updateRatingChipState();

      const filtered = filterReviews(activeBaseReviews);
      const sorted = sortReviews(filtered);

      state.filteredReviews = sorted;

      updateSummary(sorted);
      updateBarChart(sorted);
      updateMediaGallery(sorted);

      hideLoading();

      if (!sorted.length) {
        showEmpty();
        return;
      }

      if (emptyStateEl) emptyStateEl.hidden = true;

      const totalPages = Math.max(1, Math.ceil(sorted.length / reviewsPerPage));
      state.currentPage = Math.min(state.currentPage, totalPages);

      const start = (state.currentPage - 1) * reviewsPerPage;
      const pagedItems = sorted.slice(start, start + reviewsPerPage);

      renderReviewCards(pagedItems);
      renderPagination(sorted.length);
    }

    function setActiveTab(tab) {
      const normalizedTab = tab === "store" ? "store" : "product";
      if (state.activeTab === normalizedTab) return;

      state.activeTab = normalizedTab;
      state.currentPage = 1;
      state.ratingFilter = "all";
      state.selectedKeyword = "";
      state.searchTerm = "";
      if (searchInput) searchInput.value = "";
      applyAll();
    }

    async function fetchReviewPage(reviewType, page) {
      const params = new URLSearchParams();
      params.set("shop", shop);
      params.set("approvedOnly", "true");
      params.set("reviewType", reviewType);
      params.set("limit", String(FETCH_LIMIT));
      params.set("page", String(page));

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

    async function fetchAllReviewsByType(reviewType) {
      const allItems = [];
      const seenIds = new Set();

      for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
        const items = await fetchReviewPage(reviewType, page);

        if (!items.length) break;

        let newItemsCount = 0;

        items.forEach((item, index) => {
          const uniqueId = getReviewId(item, `${page}-${index}`);
          if (seenIds.has(uniqueId)) return;

          seenIds.add(uniqueId);
          allItems.push(item);
          newItemsCount += 1;
        });

        if (newItemsCount === 0) break;
        if (items.length < FETCH_LIMIT) break;
      }

      return allItems;
    }

    async function loadReviews() {
      showLoading();

      if (!endpoint || !shop) {
        showEmpty();
        return;
      }

      try {
        const settled = await Promise.allSettled([
          fetchAllReviewsByType("product"),
          fetchAllReviewsByType("store"),
        ]);

        const productItems =
          settled[0].status === "fulfilled" ? settled[0].value : [];
        const storeItems =
          settled[1].status === "fulfilled" ? settled[1].value : [];

        state.productReviews = productItems.filter((item) => {
          return isApproved(item) && getReviewType(item) === "product";
        });

        state.storeReviews = storeItems.filter((item) => {
          return isApproved(item) && getReviewType(item) === "store";
        });

        state.allReviews = [...state.productReviews, ...state.storeReviews];

        if (!state.productReviews.length && !state.storeReviews.length) {
          showEmpty();
          return;
        }

        if (showFilters && filtersPanel && filterToggleBtn) {
          filterToggleBtn.hidden = false;
        }

        if (showSort && sortSelect) {
          sortSelect.hidden = false;
        }

        applyAll();
      } catch (error) {
        console.error("Happy Customers Reviews load error:", error);
        showEmpty();
      }
    }

    function createMediaModal() {
      const modalEl = document.createElement("div");
      modalEl.className = "hcr-media-modal";
      modalEl.hidden = true;

      modalEl.innerHTML = `
        <div class="hcr-media-modal__backdrop"></div>
        <div class="hcr-media-modal__dialog" role="dialog" aria-modal="true" aria-label="Review media viewer">
          <button type="button" class="hcr-media-modal__close" aria-label="Close media viewer">×</button>

          <div class="hcr-media-modal__layout">
            <div class="hcr-media-modal__viewer">
              <div class="hcr-media-modal__stage-wrap">
                <button type="button" class="hcr-media-modal__nav hcr-media-modal__nav--prev" aria-label="Previous review">‹</button>
                <div class="hcr-media-modal__stage"></div>
                <button type="button" class="hcr-media-modal__nav hcr-media-modal__nav--next" aria-label="Next review">›</button>
              </div>

              <div class="hcr-media-modal__strip"></div>
            </div>

            <aside class="hcr-media-modal__sidebar">
              <div class="hcr-media-modal__stars"></div>

              <div class="hcr-media-modal__reviewer">
                <div class="hcr-media-modal__avatar">A</div>
                <div class="hcr-media-modal__reviewer-meta">
                  <div class="hcr-media-modal__name"></div>
                  <div class="hcr-media-modal__verified"></div>
                </div>
              </div>

              <h3 class="hcr-media-modal__title"></h3>
              <div class="hcr-media-modal__text"></div>

              <div class="hcr-media-modal__meta">
                <div class="hcr-media-modal__source"></div>
                <div class="hcr-media-modal__date"></div>
              </div>
            </aside>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      const refs = {
        modalEl,
        backdropEl: modalEl.querySelector(".hcr-media-modal__backdrop"),
        dialogEl: modalEl.querySelector(".hcr-media-modal__dialog"),
        closeBtn: modalEl.querySelector(".hcr-media-modal__close"),
        prevBtn: modalEl.querySelector(".hcr-media-modal__nav--prev"),
        nextBtn: modalEl.querySelector(".hcr-media-modal__nav--next"),
        stageEl: modalEl.querySelector(".hcr-media-modal__stage"),
        stripEl: modalEl.querySelector(".hcr-media-modal__strip"),
        starsEl: modalEl.querySelector(".hcr-media-modal__stars"),
        avatarEl: modalEl.querySelector(".hcr-media-modal__avatar"),
        nameEl: modalEl.querySelector(".hcr-media-modal__name"),
        verifiedEl: modalEl.querySelector(".hcr-media-modal__verified"),
        titleEl: modalEl.querySelector(".hcr-media-modal__title"),
        textEl: modalEl.querySelector(".hcr-media-modal__text"),
        sourceEl: modalEl.querySelector(".hcr-media-modal__source"),
        dateEl: modalEl.querySelector(".hcr-media-modal__date"),
      };

      refs.closeBtn.addEventListener("click", closeMediaModal);
      refs.backdropEl.addEventListener("click", closeMediaModal);

      refs.prevBtn.addEventListener("click", () => {
        if (state.modal.activeIndex <= 0) return;
        state.modal.activeIndex -= 1;
        renderMediaModal();
      });

      refs.nextBtn.addEventListener("click", () => {
        if (state.modal.activeIndex >= state.modal.entries.length - 1) return;
        state.modal.activeIndex += 1;
        renderMediaModal();
      });

      refs.stripEl.addEventListener("click", (event) => {
        const target = event.target.closest(".hcr-media-modal__strip-item");
        if (!target) return;

        const nextIndex = Number(target.getAttribute("data-review-index"));
        if (Number.isNaN(nextIndex)) return;

        state.modal.activeIndex = nextIndex;
        renderMediaModal();
      });

      document.addEventListener("keydown", (event) => {
        if (!state.modal.isOpen) return;

        if (event.key === "Escape") {
          closeMediaModal();
          return;
        }

        if (event.key === "ArrowLeft" && state.modal.activeIndex > 0) {
          state.modal.activeIndex -= 1;
          renderMediaModal();
          return;
        }

        if (
          event.key === "ArrowRight" &&
          state.modal.activeIndex < state.modal.entries.length - 1
        ) {
          state.modal.activeIndex += 1;
          renderMediaModal();
        }
      });

      return refs;
    }

    function openMediaModal(index) {
      if (!state.modal.entries.length || !modalRefs) return;

      state.modal.activeIndex = Math.max(
        0,
        Math.min(index, state.modal.entries.length - 1)
      );

      state.modal.isOpen = true;
      modalRefs.modalEl.hidden = false;

      document.documentElement.classList.add("hcr-media-modal-open");
      document.body.classList.add("hcr-media-modal-open");

      window.requestAnimationFrame(() => {
        modalRefs.modalEl.classList.add("is-open");
      });

      renderMediaModal();
    }

    function closeMediaModal() {
      if (!modalRefs || !state.modal.isOpen) return;

      state.modal.isOpen = false;
      modalRefs.modalEl.classList.remove("is-open");

      document.documentElement.classList.remove("hcr-media-modal-open");
      document.body.classList.remove("hcr-media-modal-open");

      window.setTimeout(() => {
        if (state.modal.isOpen) return;
        modalRefs.modalEl.hidden = true;
        modalRefs.stageEl.innerHTML = "";
      }, 180);
    }

    function renderMediaModal() {
      if (!modalRefs || !state.modal.isOpen || !state.modal.entries.length) return;

      const activeIndex = Math.max(
        0,
        Math.min(state.modal.activeIndex, state.modal.entries.length - 1)
      );

      state.modal.activeIndex = activeIndex;

      const activeEntry = state.modal.entries[activeIndex];
      const review = activeEntry.review;
      const previewMedia = activeEntry.previewMedia;

      const rawName = getCustomerName(review);
      const displayName = formatReviewerName(rawName);
      const title = getReviewTitle(review);
      const message = getReviewMessage(review);
      const sourceLabel = getSourceLabel(review);
      const dateLabel = formatDate(review.updatedAt || review.createdAt);

      modalRefs.stageEl.innerHTML = "";
      modalRefs.stageEl.appendChild(
        createStageMediaNode(
          previewMedia,
          title || sourceLabel || "Review media"
        )
      );

      modalRefs.starsEl.textContent = renderStarsText(getRatingValue(review));
      modalRefs.avatarEl.textContent = getAvatarLetter(rawName);
      modalRefs.nameEl.textContent = displayName;

      if (verifiedBadgeStyle === "hidden" || !isVerified(review)) {
        modalRefs.verifiedEl.hidden = true;
        modalRefs.verifiedEl.textContent = "";
      } else {
        modalRefs.verifiedEl.hidden = false;
        modalRefs.verifiedEl.textContent = "Verified";
      }

      if (title) {
        modalRefs.titleEl.hidden = false;
        modalRefs.titleEl.textContent = title;
      } else {
        modalRefs.titleEl.hidden = true;
        modalRefs.titleEl.textContent = "";
      }

      if (message) {
        modalRefs.textEl.hidden = false;
        modalRefs.textEl.textContent = message;
      } else {
        modalRefs.textEl.hidden = true;
        modalRefs.textEl.textContent = "";
      }

      modalRefs.sourceEl.textContent = sourceLabel;
      modalRefs.dateEl.textContent = dateLabel;

      modalRefs.prevBtn.disabled = activeIndex <= 0;
      modalRefs.nextBtn.disabled = activeIndex >= state.modal.entries.length - 1;

      modalRefs.stripEl.innerHTML = "";

      state.modal.entries.forEach((entry, index) => {
        const stripBtn = document.createElement("button");
        stripBtn.type = "button";
        stripBtn.className = "hcr-media-modal__strip-item";
        stripBtn.setAttribute("data-review-index", String(index));
        stripBtn.setAttribute(
          "aria-label",
          `Show review from ${formatReviewerName(getCustomerName(entry.review))}`
        );

        if (index === activeIndex) {
          stripBtn.classList.add("is-active");
        }

        stripBtn.appendChild(
          createThumbMediaNode(
            entry.previewMedia,
            getReviewTitle(entry.review) || getSourceLabel(entry.review)
          )
        );

        modalRefs.stripEl.appendChild(stripBtn);
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.tab || "product");
      });
    });

    ratingChipButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-rating") || "all";
        state.ratingFilter = value;
        state.currentPage = 1;
        applyAll();
      });
    });

    if (keywordChipsEl) {
      keywordChipsEl.addEventListener("click", (event) => {
        const target = event.target.closest(".hcr-chip[data-keyword]");
        if (!target) return;

        const keyword = target.getAttribute("data-keyword") || "";
        state.selectedKeyword = state.selectedKeyword === keyword ? "" : keyword;
        state.currentPage = 1;
        applyAll();
      });
    }

    if (searchInput) {
      let searchDebounce = null;

      searchInput.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          state.searchTerm = safeText(searchInput.value).trim();
          state.currentPage = 1;
          applyAll();
        }, 180);
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        state.ratingFilter = "all";
        state.selectedKeyword = "";
        state.searchTerm = "";
        state.currentPage = 1;
        if (searchInput) searchInput.value = "";
        applyAll();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sortBy = normalizeSort(sortSelect.value);
        state.currentPage = 1;
        applyAll();
      });
    }

    if (filterToggleBtn && filtersPanel) {
      filterToggleBtn.addEventListener("click", () => {
        const expanded =
          filterToggleBtn.getAttribute("aria-expanded") === "true";
        filterToggleBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
        filtersPanel.hidden = expanded;
      });
    }

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (state.currentPage <= 1) return;
        state.currentPage -= 1;
        applyAll();
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        const totalPages = Math.max(
          1,
          Math.ceil(state.filteredReviews.length / reviewsPerPage)
        );
        if (state.currentPage >= totalPages) return;
        state.currentPage += 1;
        applyAll();
      });
    }

    if (pageNumbersEl) {
      pageNumbersEl.addEventListener("click", (event) => {
        const target = event.target.closest(".hcr-page-number[data-page]");
        if (!target) return;

        const page = Number(target.getAttribute("data-page"));
        if (!page || page === state.currentPage) return;

        state.currentPage = page;
        applyAll();
      });
    }

    if (mediaGridEl) {
      mediaGridEl.addEventListener("click", (event) => {
        const target = event.target.closest(".hcr-media-thumb[data-review-index]");
        if (!target) return;

        const reviewIndex = Number(target.getAttribute("data-review-index"));
        if (Number.isNaN(reviewIndex)) return;

        openMediaModal(reviewIndex);
      });
    }

    if (openReviewFlowBtn) {
      openReviewFlowBtn.addEventListener("click", handleOpenReviewFlow);

      const preloadFlow = () => {
        if (!reviewFlowScript || reviewFlowInstances.has(root)) return;
        loadReviewFlowScript(reviewFlowScript).catch(() => {});
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(preloadFlow, { timeout: 1500 });
      } else {
        window.setTimeout(preloadFlow, 1200);
      }
    }

    loadReviews();
  }
})();
