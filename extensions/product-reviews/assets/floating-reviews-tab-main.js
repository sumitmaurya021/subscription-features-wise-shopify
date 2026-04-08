(function (window, document) {
  if (window.FloatingReviewsTabApp) return;

  const PANEL_ANIMATION_MS = 620;

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

  function parseBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value).toLowerCase() === "true";
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
    return formatDate(dateValue);
  }

  function renderStarsText(rating) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const rounded = Math.round(safeRating);
    return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
  }

  function setFilledStars(elements, ratingValue) {
    if (!elements.length) return;

    const safeRating = Math.max(0, Math.min(5, Number(ratingValue) || 0));
    const filledCount = Math.round(safeRating);

    elements.forEach((starEl, index) => {
      if (index < filledCount) {
        starEl.classList.add("is-filled");
      } else {
        starEl.classList.remove("is-filled");
      }
    });
  }

  function getInitial(name) {
    const cleanName = safeText(name).trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "A";
  }

  function getAverageRating(items) {
    if (!items.length) return 0;
    const total = items.reduce((sum, item) => sum + (Number(item.rating) || 0), 0);
    return total / items.length;
  }

  function createFloatingReviewsController(root) {
    const shop = root.dataset.shop || "";
    const endpoint = root.dataset.endpoint || "";
    const reviewType = safeText(root.dataset.reviewType || "store").trim().toLowerCase();
    const maxReviews = Math.max(1, Number(root.dataset.maxReviews || 12));
    const hideTriggerWhenOpen = parseBoolean(root.dataset.hideTriggerWhenOpen, true);

    const trigger = root.querySelector(".frt-trigger");
    const panel = root.querySelector(".frt-panel");
    const overlay = root.querySelector(".frt-overlay");
    const closeBtn = root.querySelector(".frt-close");

    const triggerRatingValue = root.querySelector(".frt-rating-value");
    const triggerRatingCount = root.querySelector(".frt-rating-count");
    const triggerStars = Array.from(root.querySelectorAll(".frt-star"));

    const summaryRating = root.querySelector(".frt-summary-rating");
    const summaryCount = root.querySelector(".frt-summary-count");
    const summaryStars = Array.from(root.querySelectorAll(".frt-summary-star"));

    const loadingEl = root.querySelector(".frt-loading");
    const listEl = root.querySelector(".frt-list");
    const emptyEl = root.querySelector(".frt-empty");
    const errorEl = root.querySelector(".frt-error");

    let reviews = [];
    let isOpen = false;
    let isAnimating = false;
    let closeTimer = null;

    if (!trigger || !panel) return null;

    if (hideTriggerWhenOpen) {
      trigger.classList.add("frt-hide-on-open");
    }

    function updateTopSummary({ items = [], total = null, average = null } = {}) {
      const resolvedTotal = Math.max(
        0,
        Number.isFinite(Number(total)) ? Number(total) : items.length
      );

      const resolvedAverage = Math.max(
        0,
        Math.min(
          5,
          Number.isFinite(Number(average)) ? Number(average) : getAverageRating(items)
        )
      );

      if (triggerRatingValue) {
        triggerRatingValue.textContent = resolvedTotal ? resolvedAverage.toFixed(1) : "--";
      }

      if (triggerRatingCount) {
        triggerRatingCount.textContent = resolvedTotal
          ? `${resolvedTotal} review${resolvedTotal !== 1 ? "s" : ""}`
          : "No reviews";
      }

      setFilledStars(triggerStars, resolvedAverage);
      setFilledStars(summaryStars, resolvedAverage);

      if (summaryRating) {
        summaryRating.textContent = resolvedTotal ? resolvedAverage.toFixed(1) : "--";
      }

      if (summaryCount) {
        summaryCount.textContent = resolvedTotal
          ? `${resolvedTotal} approved store review${resolvedTotal !== 1 ? "s" : ""}`
          : "No approved store reviews yet";
      }
    }

    function showLoading() {
      if (loadingEl) loadingEl.hidden = false;
      if (listEl) listEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
    }

    function showError(message) {
      if (loadingEl) loadingEl.hidden = true;
      if (listEl) listEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;

      if (errorEl) {
        errorEl.hidden = false;
        errorEl.textContent = message || "Failed to load store reviews.";
      }
    }

    function showEmpty() {
      if (loadingEl) loadingEl.hidden = true;
      if (listEl) listEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
    }

    function renderReviewItem(review) {
      const customerName = escapeHtml(review.customerName || "Anonymous");
      const reviewTitle = escapeHtml(review.title || "");
      const reviewMessage = escapeHtml(review.message || "");
      const rating = Number(review.rating) || 0;
      const createdAt = escapeHtml(formatRelativeDate(review.createdAt));
      const avatarInitial = escapeHtml(getInitial(review.customerName || "A"));

      return `
        <div class="frt-item">
          <div class="frt-item-top">
            <div class="frt-item-user">
              <div class="frt-avatar">${avatarInitial}</div>
              <div class="frt-user-meta">
                <div class="frt-user-name">${customerName}</div>
                <div class="frt-item-date">${createdAt}</div>
              </div>
            </div>

            <div class="frt-item-rating">
              ${renderStarsText(rating)}
            </div>
          </div>

          ${reviewTitle ? `<div class="frt-item-title">${reviewTitle}</div>` : ""}
          <div class="frt-item-message">${reviewMessage}</div>
        </div>
      `;
    }

    function renderReviews(items) {
      if (!listEl) return;

      if (!items.length) {
        showEmpty();
        return;
      }

      listEl.innerHTML = items.map(renderReviewItem).join("");
      if (loadingEl) loadingEl.hidden = true;
      if (errorEl) errorEl.hidden = true;
      if (emptyEl) emptyEl.hidden = true;
      listEl.hidden = false;
    }

    function lockScroll() {
      document.documentElement.classList.add("frt-no-scroll");
      document.body.classList.add("frt-no-scroll");
    }

    function unlockScrollIfNeeded() {
      const activeRoot = document.querySelector(
        ".frt-root.frt-is-open, .frt-root.frt-is-closing"
      );

      if (!activeRoot) {
        document.documentElement.classList.remove("frt-no-scroll");
        document.body.classList.remove("frt-no-scroll");
      }
    }

    function forceReflow(element) {
      if (!element) return;
      void element.offsetWidth;
    }

    function closeOtherTabs() {
      const openRoots = Array.from(
        document.querySelectorAll(".frt-root.frt-is-open, .frt-root.frt-is-closing")
      );

      openRoots.forEach((otherRoot) => {
        if (otherRoot === root) return;
        otherRoot.dispatchEvent(new CustomEvent("frt:close-self"));
      });
    }

    function openPanel() {
      if (!panel || !trigger || isOpen || isAnimating) return;

      clearTimeout(closeTimer);
      closeOtherTabs();

      isAnimating = true;
      panel.hidden = false;
      forceReflow(panel);

      root.classList.remove("frt-is-closing");
      root.classList.add("frt-is-open");

      trigger.setAttribute("aria-expanded", "true");
      lockScroll();

      requestAnimationFrame(() => {
        isOpen = true;
        if (closeBtn) {
          closeBtn.focus({ preventScroll: true });
        }
      });

      setTimeout(() => {
        isAnimating = false;
      }, PANEL_ANIMATION_MS);
    }

    function closePanel() {
      if (!panel || !trigger || (!isOpen && !isAnimating)) return;

      clearTimeout(closeTimer);
      isAnimating = true;

      root.classList.remove("frt-is-open");
      root.classList.add("frt-is-closing");

      trigger.setAttribute("aria-expanded", "false");
      isOpen = false;

      closeTimer = setTimeout(() => {
        panel.hidden = true;
        root.classList.remove("frt-is-closing");
        isAnimating = false;
        unlockScrollIfNeeded();
        trigger.focus({ preventScroll: true });
      }, PANEL_ANIMATION_MS);
    }

    function togglePanel() {
      if (isAnimating) return;
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    }

    function buildFetchUrl() {
      const params = new URLSearchParams();
      params.set("shop", shop);
      params.set("reviewType", reviewType);
      params.set("approvedOnly", "true");
      params.set("limit", String(maxReviews));
      return `${endpoint}?${params.toString()}`;
    }

    async function loadStoreReviews() {
      showLoading();

      try {
        const response = await fetch(buildFetchUrl(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
        });

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Non-JSON response received from reviews endpoint.");
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
          updateTopSummary({ items: [], total: 0, average: 0 });
          showError(result.message || "Failed to load store reviews.");
          return;
        }

        reviews = Array.isArray(result.data)
          ? result.data.filter(
              (item) =>
                String(item.reviewType || "store").trim().toLowerCase() === "store"
            )
          : [];

        const totalReviews = Number(result.totalReviews || reviews.length || 0);
        const averageRating = Number(
          result.averageRating !== undefined && result.averageRating !== null
            ? result.averageRating
            : getAverageRating(reviews)
        );

        updateTopSummary({
          items: reviews,
          total: totalReviews,
          average: averageRating,
        });

        renderReviews(reviews);
      } catch (error) {
        console.error("Floating reviews load error:", error);
        updateTopSummary({ items: [], total: 0, average: 0 });
        showError("Failed to load store reviews.");
      }
    }

    function bindEvents() {
      trigger.addEventListener("click", togglePanel);

      if (closeBtn) {
        closeBtn.addEventListener("click", closePanel);
      }

      if (overlay) {
        overlay.addEventListener("click", closePanel);
      }

      root.addEventListener("frt:close-self", () => {
        closePanel();
      });

      document.addEventListener("keydown", (event) => {
        if (!isOpen) return;
        if (event.key === "Escape") {
          closePanel();
        }
      });
    }

    function init() {
      bindEvents();
      loadStoreReviews();
    }

    return { init };
  }

  function initRoot(root) {
    if (!root || root.dataset.initialized === "true") return;

    const controller = createFloatingReviewsController(root);
    if (!controller) return;

    root.dataset.initialized = "true";
    controller.init();
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".frt-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      initRoot(root);
    });
  }

  window.FloatingReviewsTabApp = {
    initRoot,
    initAll,
  };
})(window, document);
