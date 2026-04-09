(function (window, document) {
  if (window.HappyCustomersReviewsApp) return;

  const FETCH_LIMIT = 250;
  const MAX_FETCH_PAGES = 120;
  const SEARCH_DEBOUNCE = 180;
  const REVIEW_CACHE_TTL = 2 * 60 * 1000;
  const GALLERY_GAP = 8;

  const reviewFlowScriptPromises = new Map();
  const reviewFlowInstances = new WeakMap();
  const reviewsMemoryCache = new Map();

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
    const cacheKey = `hcr_reviews_cache__${shop}__${endpoint}`;

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
      searchDebounce: null,
      loadingController: null,
      lastLoadedAt: 0,
      initialCacheApplied: false,
      modal: {
        isOpen: false,
        entries: [],
        activeIndex: 0,
        activeMediaIndex: 0,
      },
      gallery: {
        currentIndex: 0,
        itemsPerView: getGalleryItemsPerView(),
        lastEntrySignature: "",
        touchStartX: 0,
        touchCurrentX: 0,
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

    function getNow() {
      return Date.now();
    }

    function getGalleryItemsPerView() {
      const viewportWidth =
        window.innerWidth || document.documentElement.clientWidth || 1200;

      if (viewportWidth <= 479) return 3;
      if (viewportWidth <= 767) return 4;
      return 5;
    }

    function getGalleryMaxStartIndex() {
      return Math.max(0, state.modal.entries.length - state.gallery.itemsPerView);
    }

    function clampGalleryIndex(index) {
      return Math.max(0, Math.min(Number(index) || 0, getGalleryMaxStartIndex()));
    }

    function getGallerySlideBasis() {
      return `calc((100% - ${GALLERY_GAP * (state.gallery.itemsPerView - 1)}px) / ${state.gallery.itemsPerView})`;
    }

    function getGalleryTranslateValue(index) {
      return `calc(-${index} * ((100% - ${GALLERY_GAP * (state.gallery.itemsPerView - 1)}px) / ${state.gallery.itemsPerView} + ${GALLERY_GAP}px))`;
    }

    function syncGallerySliderUI() {
      if (!mediaGridEl) return;

      const track = mediaGridEl.querySelector(".hcr-media-track");
      if (!track) return;

      state.gallery.currentIndex = clampGalleryIndex(state.gallery.currentIndex);
      track.style.transform = `translate3d(${getGalleryTranslateValue(
        state.gallery.currentIndex
      )}, 0, 0)`;

      const prevBtn = mediaGridEl.querySelector(".hcr-media-nav--prev");
      const nextBtn = mediaGridEl.querySelector(".hcr-media-nav--next");
      const maxStartIndex = getGalleryMaxStartIndex();

      if (prevBtn) {
        prevBtn.disabled = state.gallery.currentIndex <= 0;
        prevBtn.hidden = maxStartIndex <= 0;
      }

      if (nextBtn) {
        nextBtn.disabled = state.gallery.currentIndex >= maxStartIndex;
        nextBtn.hidden = maxStartIndex <= 0;
      }

      const dots = Array.from(
        mediaGridEl.querySelectorAll(".hcr-media-slider-dot[data-gallery-page]")
      );
      dots.forEach((dot) => {
        const dotIndex = Number(dot.getAttribute("data-gallery-page") || 0);
        const active = dotIndex === state.gallery.currentIndex;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-pressed", active ? "true" : "false");
      });

      const counterEl = mediaGridEl.querySelector(".hcr-media-slider-counter");
      if (counterEl) {
        counterEl.hidden = state.modal.entries.length <= 0;
        counterEl.textContent = `${state.modal.entries.length}/${state.modal.entries.length}`;
      }
    }

    function goToGalleryIndex(index) {
      state.gallery.currentIndex = clampGalleryIndex(index);
      syncGallerySliderUI();
    }

    function getReviewCachePayload() {
      const memoryPayload = reviewsMemoryCache.get(cacheKey);
      if (
        memoryPayload &&
        memoryPayload.timestamp &&
        getNow() - memoryPayload.timestamp < REVIEW_CACHE_TTL
      ) {
        return memoryPayload;
      }

      try {
        const raw = window.sessionStorage.getItem(cacheKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (
          !parsed ||
          !parsed.timestamp ||
          getNow() - parsed.timestamp >= REVIEW_CACHE_TTL
        ) {
          return null;
        }

        return parsed;
      } catch {
        return null;
      }
    }

    function saveReviewCachePayload(payload) {
      if (!payload) return;

      reviewsMemoryCache.set(cacheKey, payload);

      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch {}
    }

    function clearReviewCache() {
      reviewsMemoryCache.delete(cacheKey);
      try {
        window.sessionStorage.removeItem(cacheKey);
      } catch {}
    }

    function buildCachePayload() {
      return {
        timestamp: getNow(),
        productReviews: state.productReviews,
        storeReviews: state.storeReviews,
      };
    }

    function applyCachedReviews(payload) {
      if (!payload) return false;

      const productItems = Array.isArray(payload.productReviews)
        ? payload.productReviews
        : [];
      const storeItems = Array.isArray(payload.storeReviews)
        ? payload.storeReviews
        : [];

      state.productReviews = productItems.filter((item) => {
        return isApproved(item) && getReviewType(item) === "product";
      });

      state.storeReviews = storeItems.filter((item) => {
        return isApproved(item) && getReviewType(item) === "store";
      });

      state.allReviews = [...state.productReviews, ...state.storeReviews];
      state.lastLoadedAt = Number(payload.timestamp || getNow());

      if (!state.productReviews.length && !state.storeReviews.length) {
        return false;
      }

      state.initialCacheApplied = true;

      if (showFilters && filtersPanel && filterToggleBtn) {
        filterToggleBtn.hidden = false;
      }

      if (showSort && sortSelect) {
        sortSelect.hidden = false;
      }

      applyAll();
      return true;
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
          clearReviewCache();
          await loadReviews({ force: true });

          if (payload.reviewType === "store") {
            setActiveTab("store");
          } else if (payload.reviewType === "product") {
            setActiveTab("product");
          }

          if (openReviewFlowBtn) {
            openReviewFlowBtn.setAttribute("aria-expanded", "false");
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

        openReviewFlowBtn.setAttribute("aria-expanded", "true");
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
      const explicitType = safeLower(
        review.reviewType || review.review_type || review.type || ""
      );

      if (
        explicitType === "store" ||
        explicitType === "store_review" ||
        explicitType === "store reviews"
      ) {
        return "store";
      }

      if (
        explicitType === "product" ||
        explicitType === "product_review" ||
        explicitType === "product reviews"
      ) {
        return "product";
      }

      const hasProductIdentity = Boolean(
        safeText(
          review.productId ||
            review.product_id ||
            review.targetId ||
            review.target_id ||
            review.product?.id ||
            review.productTitle ||
            review.product_title ||
            review.product?.title
        ).trim()
      );

      return hasProductIdentity ? "product" : "store";
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
      } catch {
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
        video.preload = "metadata";
        video.playsInline = true;
        video.muted = true;
        video.setAttribute("aria-label", safeText(altText || "Review media"));
        return video;
      }

      if (media.type === "youtube") {
        const iframe = document.createElement("iframe");
        const joiner = media.src.includes("?") ? "&" : "?";
        iframe.src = `${media.src}${joiner}rel=0&modestbranding=1`;
        iframe.title = safeText(altText || "Review media");
        iframe.setAttribute(
          "allow",
          "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
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

      const activeEntry = state.modal.entries[state.modal.activeIndex];
      const maxMediaIndex = Math.max(0, (activeEntry?.mediaItems?.length || 1) - 1);
      state.modal.activeMediaIndex = Math.min(state.modal.activeMediaIndex, maxMediaIndex);

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
        state.gallery.currentIndex = 0;
        state.gallery.lastEntrySignature = "";
        return;
      }

      const entrySignature = mediaEntries.map((entry) => entry.id).join("||");
      state.gallery.itemsPerView = getGalleryItemsPerView();

      if (entrySignature !== state.gallery.lastEntrySignature) {
        state.gallery.currentIndex = 0;
        state.gallery.lastEntrySignature = entrySignature;
      } else {
        state.gallery.currentIndex = clampGalleryIndex(state.gallery.currentIndex);
      }

      mediaGalleryEl.hidden = false;

      const sliderEl = document.createElement("div");
      sliderEl.className = "hcr-media-slider";

      const viewportEl = document.createElement("div");
      viewportEl.className = "hcr-media-viewport";

      const trackEl = document.createElement("div");
      trackEl.className = "hcr-media-track";
      trackEl.style.gap = `${GALLERY_GAP}px`;

      mediaEntries.forEach((entry, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "hcr-media-thumb";
        button.setAttribute("data-review-entry-index", String(index));
        button.setAttribute("data-review-media-index", "0");
        button.setAttribute(
          "aria-label",
          `Open review from ${formatReviewerName(getCustomerName(entry.review))}`
        );
        button.style.flex = `0 0 ${getGallerySlideBasis()}`;

        button.appendChild(
          createThumbMediaNode(
            entry.previewMedia,
            getReviewTitle(entry.review) || getSourceLabel(entry.review)
          )
        );

        trackEl.appendChild(button);
      });

      viewportEl.appendChild(trackEl);

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "hcr-media-nav hcr-media-nav--prev";
      prevBtn.setAttribute("aria-label", "Previous media set");
      prevBtn.innerHTML = "&#8249;";

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "hcr-media-nav hcr-media-nav--next";
      nextBtn.setAttribute("aria-label", "Next media set");
      nextBtn.innerHTML = "&#8250;";

      sliderEl.appendChild(prevBtn);
      sliderEl.appendChild(viewportEl);
      sliderEl.appendChild(nextBtn);

      const footerEl = document.createElement("div");
      footerEl.className = "hcr-media-slider-footer";

      const dotsEl = document.createElement("div");
      dotsEl.className = "hcr-media-slider-dots";

      const totalPositions = getGalleryMaxStartIndex() + 1;
      for (let index = 0; index < totalPositions; index += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "hcr-media-slider-dot";
        dot.setAttribute("data-gallery-page", String(index));
        dot.setAttribute("aria-label", `Go to media set ${index + 1}`);
        dotsEl.appendChild(dot);
      }

      const counterEl = document.createElement("div");
      counterEl.className = "hcr-media-slider-counter";

      footerEl.appendChild(dotsEl);
      footerEl.appendChild(counterEl);

      mediaGridEl.appendChild(sliderEl);
      mediaGridEl.appendChild(footerEl);

      syncGallerySliderUI();
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

    function findModalEntryIndexByReviewId(reviewId) {
      return state.modal.entries.findIndex((entry) => entry.id === reviewId);
    }

    function openModalForReviewMedia(reviewId, mediaIndex = 0) {
      const entryIndex = findModalEntryIndexByReviewId(reviewId);
      if (entryIndex === -1) return;
      openMediaModal(entryIndex, mediaIndex);
    }

    function renderReviewCards(items) {
      if (!reviewsListEl) return;

      reviewsListEl.innerHTML = "";

      items.forEach((review, index) => {
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
        const media = getReviewMediaItems(review).slice(0, 8);
        const reviewId = getReviewId(review, `render-${index}`);

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

            media.forEach((mediaItem, mediaIndex) => {
              const button = document.createElement("button");
              button.type = "button";
              button.className = "hcr-review-media-item hcr-review-media-button";
              button.setAttribute("data-review-id", reviewId);
              button.setAttribute("data-review-media-index", String(mediaIndex));
              button.setAttribute(
                "aria-label",
                `Open media ${mediaIndex + 1} from review by ${displayName}`
              );
              button.appendChild(
                createThumbMediaNode(
                  mediaItem,
                  title || getSourceLabel(review) || "Review media"
                )
              );
              mediaRowEl.appendChild(button);
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
      state.gallery.currentIndex = 0;
      if (searchInput) searchInput.value = "";
      applyAll();
    }

    async function fetchReviewPage(reviewType, page, signal) {
      const params = new URLSearchParams();
      params.set("shop", shop);
      params.set("approvedOnly", "true");
      if (reviewType) params.set("reviewType", reviewType);
      params.set("limit", String(FETCH_LIMIT));
      params.set("page", String(page));

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      });

      let result = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Failed to load ${reviewType || "reviews"}.`);
      }

      return Array.isArray(result.data) ? result.data : [];
    }

    async function fetchAllReviewsByType(reviewType, signal) {
      const allItems = [];
      const seenIds = new Set();
      let emptyPages = 0;

      for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const items = await fetchReviewPage(reviewType, page, signal);

        if (!items.length) {
          emptyPages += 1;
          if (emptyPages >= 1) break;
          continue;
        }

        emptyPages = 0;
        let newItemsCount = 0;

        items.forEach((item, index) => {
          const uniqueId = getReviewId(item, `${page}-${index}`);
          if (seenIds.has(uniqueId)) return;

          seenIds.add(uniqueId);
          allItems.push(item);
          newItemsCount += 1;
        });

        if (newItemsCount === 0) {
          break;
        }
      }

      return allItems;
    }

    async function fetchFallbackAllApproved(signal) {
      const allItems = [];
      const seenIds = new Set();
      let emptyPages = 0;

      for (let page = 1; page <= MAX_FETCH_PAGES; page += 1) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const items = await fetchReviewPage("", page, signal);

        if (!items.length) {
          emptyPages += 1;
          if (emptyPages >= 1) break;
          continue;
        }

        emptyPages = 0;
        let newItemsCount = 0;

        items.forEach((item, index) => {
          const uniqueId = getReviewId(item, `fallback-${page}-${index}`);
          if (seenIds.has(uniqueId)) return;

          seenIds.add(uniqueId);
          allItems.push(item);
          newItemsCount += 1;
        });

        if (newItemsCount === 0) {
          break;
        }
      }

      return allItems;
    }

    function mergeMissingTypedReviews(typedItems, fallbackItems, expectedType) {
      const merged = [];
      const seenIds = new Set();

      typedItems.forEach((item, index) => {
        const id = getReviewId(item, `typed-${expectedType}-${index}`);
        if (seenIds.has(id)) return;
        seenIds.add(id);
        merged.push(item);
      });

      fallbackItems.forEach((item, index) => {
        if (getReviewType(item) !== expectedType) return;
        const id = getReviewId(item, `fallback-${expectedType}-${index}`);
        if (seenIds.has(id)) return;
        seenIds.add(id);
        merged.push(item);
      });

      return merged;
    }

    function normalizeLoadedReviews(productItems, storeItems) {
      state.productReviews = productItems.filter((item) => {
        return isApproved(item) && getReviewType(item) === "product";
      });

      state.storeReviews = storeItems.filter((item) => {
        return isApproved(item) && getReviewType(item) === "store";
      });

      state.allReviews = [...state.productReviews, ...state.storeReviews];
      state.lastLoadedAt = getNow();
    }

    async function loadReviews(options = {}) {
      const { force = false } = options;

      if (!endpoint || !shop) {
        showEmpty();
        return;
      }

      const cachedPayload = !force ? getReviewCachePayload() : null;
      const didApplyCache = cachedPayload ? applyCachedReviews(cachedPayload) : false;

      if (!didApplyCache) {
        showLoading();
      }

      if (state.loadingController) {
        try {
          state.loadingController.abort();
        } catch {}
      }

      const controller = new AbortController();
      state.loadingController = controller;

      try {
        const settled = await Promise.allSettled([
          fetchAllReviewsByType("product", controller.signal),
          fetchAllReviewsByType("store", controller.signal),
          fetchFallbackAllApproved(controller.signal),
        ]);

        if (controller.signal.aborted) return;

        const typedProductItems =
          settled[0].status === "fulfilled" ? settled[0].value : [];
        const typedStoreItems =
          settled[1].status === "fulfilled" ? settled[1].value : [];
        const fallbackItems =
          settled[2].status === "fulfilled" ? settled[2].value : [];

        const mergedProductItems = mergeMissingTypedReviews(
          typedProductItems,
          fallbackItems,
          "product"
        );

        const mergedStoreItems = mergeMissingTypedReviews(
          typedStoreItems,
          fallbackItems,
          "store"
        );

        normalizeLoadedReviews(mergedProductItems, mergedStoreItems);

        const cachePayload = buildCachePayload();
        saveReviewCachePayload(cachePayload);

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
        if (error?.name === "AbortError") return;

        console.error("Happy Customers Reviews load error:", error);

        if (!didApplyCache) {
          showEmpty();
        }
      } finally {
        if (state.loadingController === controller) {
          state.loadingController = null;
        }
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
        state.modal.activeMediaIndex = 0;
        renderMediaModal();
      });

      refs.nextBtn.addEventListener("click", () => {
        if (state.modal.activeIndex >= state.modal.entries.length - 1) return;
        state.modal.activeIndex += 1;
        state.modal.activeMediaIndex = 0;
        renderMediaModal();
      });

      refs.stripEl.addEventListener("click", (event) => {
        const target = event.target.closest(".hcr-media-modal__strip-item");
        if (!target) return;

        const nextMediaIndex = Number(target.getAttribute("data-media-index"));
        if (Number.isNaN(nextMediaIndex)) return;

        state.modal.activeMediaIndex = nextMediaIndex;
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
          state.modal.activeMediaIndex = 0;
          renderMediaModal();
          return;
        }

        if (
          event.key === "ArrowRight" &&
          state.modal.activeIndex < state.modal.entries.length - 1
        ) {
          state.modal.activeIndex += 1;
          state.modal.activeMediaIndex = 0;
          renderMediaModal();
        }
      });

      return refs;
    }

    function openMediaModal(entryIndex, mediaIndex = 0) {
      if (!state.modal.entries.length || !modalRefs) return;

      state.modal.activeIndex = Math.max(
        0,
        Math.min(entryIndex, state.modal.entries.length - 1)
      );

      const entry = state.modal.entries[state.modal.activeIndex];
      state.modal.activeMediaIndex = Math.max(
        0,
        Math.min(mediaIndex, Math.max(0, (entry?.mediaItems?.length || 1) - 1))
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
        modalRefs.stageEl.innerHTML = "";
      }, 180);

      window.setTimeout(() => {
        if (state.modal.isOpen) return;
        modalRefs.modalEl.hidden = true;
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
      const mediaItems = Array.isArray(activeEntry.mediaItems) ? activeEntry.mediaItems : [];
      const activeMediaIndex = Math.max(
        0,
        Math.min(state.modal.activeMediaIndex, Math.max(0, mediaItems.length - 1))
      );

      state.modal.activeMediaIndex = activeMediaIndex;

      const activeMedia = mediaItems[activeMediaIndex] || activeEntry.previewMedia;

      const rawName = getCustomerName(review);
      const displayName = formatReviewerName(rawName);
      const title = getReviewTitle(review);
      const message = getReviewMessage(review);
      const sourceLabel = getSourceLabel(review);
      const dateLabel = formatDate(review.updatedAt || review.createdAt);

      modalRefs.stageEl.innerHTML = "";
      modalRefs.stageEl.appendChild(
        createStageMediaNode(
          activeMedia,
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

      mediaItems.forEach((mediaItem, index) => {
        const stripBtn = document.createElement("button");
        stripBtn.type = "button";
        stripBtn.className = "hcr-media-modal__strip-item";
        stripBtn.setAttribute("data-media-index", String(index));
        stripBtn.setAttribute(
          "aria-label",
          `Show media ${index + 1} from review by ${displayName}`
        );

        if (index === activeMediaIndex) {
          stripBtn.classList.add("is-active");
        }

        stripBtn.appendChild(
          createThumbMediaNode(
            mediaItem,
            getReviewTitle(review) || getSourceLabel(review)
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
        state.gallery.currentIndex = 0;
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
        state.gallery.currentIndex = 0;
        applyAll();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(state.searchDebounce);
        state.searchDebounce = setTimeout(() => {
          state.searchTerm = safeText(searchInput.value).trim();
          state.currentPage = 1;
          state.gallery.currentIndex = 0;
          applyAll();
        }, SEARCH_DEBOUNCE);
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        state.ratingFilter = "all";
        state.selectedKeyword = "";
        state.searchTerm = "";
        state.currentPage = 1;
        state.gallery.currentIndex = 0;
        if (searchInput) searchInput.value = "";
        applyAll();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sortBy = normalizeSort(sortSelect.value);
        state.currentPage = 1;
        state.gallery.currentIndex = 0;
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
        const navButton = event.target.closest(".hcr-media-nav");
        if (navButton) {
          if (navButton.classList.contains("hcr-media-nav--prev")) {
            goToGalleryIndex(state.gallery.currentIndex - 1);
          } else if (navButton.classList.contains("hcr-media-nav--next")) {
            goToGalleryIndex(state.gallery.currentIndex + 1);
          }
          return;
        }

        const dotButton = event.target.closest(".hcr-media-slider-dot[data-gallery-page]");
        if (dotButton) {
          const pageIndex = Number(dotButton.getAttribute("data-gallery-page"));
          if (!Number.isNaN(pageIndex)) {
            goToGalleryIndex(pageIndex);
          }
          return;
        }

        const target = event.target.closest(".hcr-media-thumb[data-review-entry-index]");
        if (!target) return;

        const entryIndex = Number(target.getAttribute("data-review-entry-index"));
        const mediaIndex = Number(target.getAttribute("data-review-media-index") || 0);

        if (Number.isNaN(entryIndex)) return;

        openMediaModal(entryIndex, Number.isNaN(mediaIndex) ? 0 : mediaIndex);
      });

      mediaGridEl.addEventListener(
        "touchstart",
        (event) => {
          const sliderViewport = event.target.closest(".hcr-media-viewport");
          if (!sliderViewport) return;
          state.gallery.touchStartX = event.touches?.[0]?.clientX || 0;
          state.gallery.touchCurrentX = state.gallery.touchStartX;
        },
        { passive: true }
      );

      mediaGridEl.addEventListener(
        "touchmove",
        (event) => {
          state.gallery.touchCurrentX =
            event.touches?.[0]?.clientX || state.gallery.touchCurrentX;
        },
        { passive: true }
      );

      mediaGridEl.addEventListener(
        "touchend",
        () => {
          const deltaX = state.gallery.touchCurrentX - state.gallery.touchStartX;
          if (Math.abs(deltaX) < 36) return;

          if (deltaX < 0) {
            goToGalleryIndex(state.gallery.currentIndex + 1);
          } else {
            goToGalleryIndex(state.gallery.currentIndex - 1);
          }
        },
        { passive: true }
      );
    }

    if (reviewsListEl) {
      reviewsListEl.addEventListener("click", (event) => {
        const target = event.target.closest(
          ".hcr-review-media-button[data-review-id]"
        );
        if (!target) return;

        const reviewId = target.getAttribute("data-review-id") || "";
        const mediaIndex = Number(
          target.getAttribute("data-review-media-index") || 0
        );

        openModalForReviewMedia(
          reviewId,
          Number.isNaN(mediaIndex) ? 0 : mediaIndex
        );
      });
    }

    if (openReviewFlowBtn) {
      openReviewFlowBtn.addEventListener("click", handleOpenReviewFlow);

      const preloadFlow = () => {
        if (!reviewFlowScript || reviewFlowInstances.has(root)) return;
        loadReviewFlowScript(reviewFlowScript).catch(() => {});
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(preloadFlow, { timeout: 1200 });
      } else {
        window.setTimeout(preloadFlow, 900);
      }
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const nextItemsPerView = getGalleryItemsPerView();

        if (nextItemsPerView !== state.gallery.itemsPerView) {
          state.gallery.itemsPerView = nextItemsPerView;
          updateMediaGallery(state.filteredReviews);
          return;
        }

        syncGallerySliderUI();
      }, 120);
    });

    loadReviews();
  }

  window.HappyCustomersReviewsApp = {
    initRoot(root) {
      if (!root || root.dataset.initialized === "true") return;
      root.dataset.initialized = "true";
      initHappyCustomersReviews(root);
    },
    initAll(scope = document) {
      initAllHappyCustomersReviews(scope);
    },
  };
})(window, document);
