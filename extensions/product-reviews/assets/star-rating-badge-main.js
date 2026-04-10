(function (window, document) {
  if (window.StarRatingBadgeApp) return;

  const PRODUCT_BADGE_ROOT_SELECTOR =
    ".pr-star-rating-badge-root[data-badge-type='product']";
  const COLLECTION_BADGE_ROOT_SELECTOR =
    ".pr-collection-star-rating-badges-root[data-badge-type='collection']";
  const COLLECTION_HOST_SELECTOR = ".pr-star-badge-host--collection";

  const PRODUCT_CARD_SELECTORS = [
    ".card-wrapper",
    ".product-card-wrapper",
    ".product-card",
    ".card",
    ".grid__item",
    ".product-grid-item",
    ".boost-sd__product-item",
    ".boost-pfs-filter-product-item",
    ".splide__slide",
    ".swiper-slide",
    ".product-item",
  ].join(",");

  const PRODUCT_TITLE_SELECTORS = [
    ".card__heading",
    ".card-information__text",
    ".product-card__title",
    ".card__heading a",
    "a.full-unstyled-link",
    ".product-item__title",
    ".card-title",
  ].join(",");

  const PRODUCT_INFO_SELECTORS = [
    ".card__information",
    ".card-information",
    ".card__content",
    ".product-card__info",
    ".card-information__wrapper",
    ".product-item__info",
  ].join(",");

  const PRODUCT_PRICE_SELECTORS = [
    ".price",
    ".price--on-sale",
    ".product-card__price",
    ".price__container",
    ".product-item__price",
  ].join(",");

  const reviewsRequestCache = new Map();
  const handleToIdCache = new Map();

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

  function boolFromData(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value) === "true";
  }

  function numberFromData(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clampRating(value) {
    const numeric = Number(value) || 0;
    return Math.max(0, Math.min(5, numeric));
  }

  function normalizeColor(value, fallback) {
    const color = safeText(value).trim();
    return color || fallback;
  }

  function buildUrl(endpoint, params = {}) {
    const url = new URL(endpoint, window.location.origin);

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  function calculateAverage(reviews) {
    if (!Array.isArray(reviews) || !reviews.length) return 0;

    const total = reviews.reduce((sum, review) => {
      return sum + (Number(review?.rating) || 0);
    }, 0);

    return total / reviews.length;
  }

  function getReviewCountText(count) {
    const numericCount = Number(count) || 0;
    return `${numericCount} review${numericCount === 1 ? "" : "s"}`;
  }

  function getBadgeStyleVars(options = {}) {
    const starSizeDesktop = Math.max(
      10,
      numberFromData(options.starSizeDesktop, 16)
    );
    const starSizeMobile = Math.max(
      10,
      numberFromData(options.starSizeMobile, 14)
    );
    const starColor = normalizeColor(options.starColor, "#0f766e");
    const starBaseColor = normalizeColor(options.starBaseColor, "#d1d5db");

    return [
      `--pr-star-size-desktop:${starSizeDesktop}px`,
      `--pr-star-size-mobile:${starSizeMobile}px`,
      `--pr-star-fill:${starColor}`,
      `--pr-star-base:${starBaseColor}`,
    ].join(";");
  }

  function buildBadgeMarkup({
    average = 0,
    count = 0,
    showRatingNumber = true,
    showReviewCount = true,
    href = "",
    extraClass = "",
    styleVars = "",
  }) {
    const avg = clampRating(average);
    const fillWidth = `${(avg / 5) * 100}%`;
    const ratingText = count > 0 ? avg.toFixed(1) : "0.0";
    const reviewText = count > 0 ? getReviewCountText(count) : "No reviews";
    const isLink = Boolean(href);
    const tagName = isLink ? "a" : "button";
    const tagAttrs = isLink
      ? `href="${escapeHtml(href)}"`
      : `type="button"`;

    const shouldShowDivider = showRatingNumber && showReviewCount;

    return `
      <${tagName}
        class="pr-star-badge ${escapeHtml(extraClass)} ${
      count > 0 ? "has-reviews" : "is-empty"
    }"
        ${tagAttrs}
        aria-label="${escapeHtml(reviewText)}"
        style="${escapeHtml(styleVars)}"
      >
        <span class="pr-star-badge__stars" aria-hidden="true">
          <span class="pr-star-badge__stars-base">★★★★★</span>
          <span class="pr-star-badge__stars-fill" style="width:${fillWidth};">★★★★★</span>
        </span>
        ${
          showRatingNumber
            ? `<span class="pr-star-badge__rating">${escapeHtml(
                ratingText
              )}</span>`
            : ""
        }
        ${
          shouldShowDivider
            ? `<span class="pr-star-badge__divider" aria-hidden="true"></span>`
            : ""
        }
        ${
          showReviewCount
            ? `<span class="pr-star-badge__count">${escapeHtml(
                reviewText
              )}</span>`
            : ""
        }
      </${tagName}>
    `;
  }

  async function fetchApprovedReviews({ endpoint, shop, productId, productIds }) {
    const params = {
      shop,
      approvedOnly: "true",
    };

    if (productId) params.productId = productId;
    if (productIds && productIds.length) {
      params.productIds = productIds.join(",");
    }

    const cacheKey = JSON.stringify({
      endpoint,
      shop,
      productId: safeText(productId),
      productIds: Array.isArray(productIds) ? [...productIds].sort() : [],
    });

    if (reviewsRequestCache.has(cacheKey)) {
      return reviewsRequestCache.get(cacheKey);
    }

    const requestPromise = fetch(buildUrl(endpoint, params), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load badge reviews");
        }

        return result;
      })
      .catch((error) => {
        reviewsRequestCache.delete(cacheKey);
        throw error;
      });

    reviewsRequestCache.set(cacheKey, requestPromise);
    return requestPromise;
  }

  function groupReviewsByProductId(reviews) {
    const grouped = new Map();

    (Array.isArray(reviews) ? reviews : []).forEach((review) => {
      const key = safeText(review?.productId);
      if (!key) return;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key).push(review);
    });

    return grouped;
  }

  function scrollToReviewsSection(root) {
    const targetSelector = root.dataset.scrollTarget || "#product-reviews-root";
    const target = document.querySelector(targetSelector);
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function applyRootStyleVars(root) {
    if (!root) return;

    const styleVars = getBadgeStyleVars({
      starSizeDesktop: root.dataset.starSizeDesktop,
      starSizeMobile: root.dataset.starSizeMobile,
      starColor: root.dataset.starColor,
      starBaseColor: root.dataset.starBaseColor,
    });

    styleVars.split(";").forEach((entry) => {
      const [key, value] = entry.split(":");
      if (!key || !value) return;
      root.style.setProperty(key.trim(), value.trim());
    });

    return styleVars;
  }

  async function initProductBadge(root) {
    if (!root || root.dataset.badgeInitialized === "true") return;
    root.dataset.badgeInitialized = "true";

    const productId = safeText(root.dataset.productId);
    const shop = safeText(root.dataset.shop);
    const endpoint = safeText(root.dataset.endpoint);
    const showRatingNumber = boolFromData(root.dataset.showRatingNumber, true);
    const showReviewCount = boolFromData(root.dataset.showReviewCount, true);
    const hideWhenNoReviews = boolFromData(root.dataset.hideWhenNoReviews, true);
    const scrollToReviews = boolFromData(root.dataset.scrollToReviews, true);
    const styleVars = applyRootStyleVars(root);

    if (!productId || !shop || !endpoint) return;

    root.classList.add("is-loading");

    try {
      const result = await fetchApprovedReviews({
        endpoint,
        shop,
        productId,
      });

      const reviews = Array.isArray(result?.data) ? result.data : [];
      const count = Number(result?.totalReviews || reviews.length || 0);
      const average =
        count > 0
          ? Number(result?.averageRating || calculateAverage(reviews) || 0)
          : 0;

      if (count === 0 && hideWhenNoReviews) {
        root.style.display = "none";
        return;
      }

      root.innerHTML = buildBadgeMarkup({
        average,
        count,
        showRatingNumber,
        showReviewCount,
        extraClass: "pr-star-badge--product",
        styleVars,
      });

      const badgeEl = root.querySelector(".pr-star-badge");

      if (badgeEl && scrollToReviews) {
        badgeEl.addEventListener("click", (event) => {
          event.preventDefault();
          scrollToReviewsSection(root);
        });
      }
    } catch (error) {
      console.error("PRODUCT STAR BADGE ERROR:", error);

      if (hideWhenNoReviews) {
        root.style.display = "none";
        return;
      }

      root.innerHTML = buildBadgeMarkup({
        average: 0,
        count: 0,
        showRatingNumber,
        showReviewCount,
        extraClass: "pr-star-badge--product",
        styleVars,
      });
    } finally {
      root.classList.remove("is-loading");
    }
  }

  function extractProductHandleFromUrl(rawUrl) {
    if (!rawUrl) return "";

    try {
      const parsed = new URL(rawUrl, window.location.origin);
      const match = parsed.pathname.match(/\/products\/([^/?#]+)/i);
      return match ? match[1] : "";
    } catch (error) {
      return "";
    }
  }

  function getProductUrlFromLink(linkEl) {
    if (!linkEl) return "";
    const href = linkEl.getAttribute("href") || "";
    if (!href) return "";

    try {
      const parsed = new URL(href, window.location.origin);
      return `${parsed.pathname}${parsed.search}#product-reviews-root`;
    } catch (error) {
      return `${href}#product-reviews-root`;
    }
  }

  function findProductCard(linkEl) {
    if (!linkEl) return null;

    return (
      linkEl.closest(PRODUCT_CARD_SELECTORS) ||
      linkEl.closest("li") ||
      linkEl.parentElement
    );
  }

  function findExistingProductId(card, linkEl) {
    const candidates = [
      card,
      linkEl,
      linkEl?.closest("[data-product-id]"),
      card?.closest("[data-product-id]"),
      card?.querySelector("[data-product-id]"),
      card?.querySelector("[data-productid]"),
      card?.querySelector("[data-id]"),
    ].filter(Boolean);

    for (const element of candidates) {
      const productId =
        element?.dataset?.productId ||
        element?.dataset?.productid ||
        element?.getAttribute?.("data-product-id") ||
        element?.getAttribute?.("data-productid");

      if (productId) return safeText(productId);
    }

    return "";
  }

  function removeExistingCollectionBadge(card) {
    if (!card) return;
    const existing = card.querySelector(COLLECTION_HOST_SELECTOR);
    if (existing) existing.remove();
  }

  function findInsertPosition(card) {
    if (!card) return null;

    const priceEl = card.querySelector(PRODUCT_PRICE_SELECTORS);
    if (priceEl && priceEl.parentNode) {
      return { mode: "before", target: priceEl };
    }

    const titleEl = card.querySelector(PRODUCT_TITLE_SELECTORS);
    if (titleEl && titleEl.parentNode) {
      return { mode: "after", target: titleEl };
    }

    const infoEl = card.querySelector(PRODUCT_INFO_SELECTORS);
    if (infoEl) {
      return { mode: "append", target: infoEl };
    }

    return { mode: "append", target: card };
  }

  function insertCollectionBadge(card, html) {
    const position = findInsertPosition(card);
    if (!position || !position.target) return;

    const host = document.createElement("div");
    host.className = "pr-star-badge-host pr-star-badge-host--collection";
    host.innerHTML = html;

    if (position.mode === "before") {
      position.target.parentNode.insertBefore(host, position.target);
      return;
    }

    if (position.mode === "after") {
      position.target.insertAdjacentElement("afterend", host);
      return;
    }

    position.target.appendChild(host);
  }

  async function fetchProductIdByHandle(handle) {
    const normalizedHandle = safeText(handle);
    if (!normalizedHandle) return "";

    if (handleToIdCache.has(normalizedHandle)) {
      return handleToIdCache.get(normalizedHandle);
    }

    const promise = fetch(
      `${window.Shopify?.routes?.root || "/"}products/${normalizedHandle}.js`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    )
      .then(async (response) => {
        if (!response.ok) return "";
        const product = await response.json();
        return safeText(product?.id);
      })
      .catch(() => "")
      .then((resolvedId) => {
        handleToIdCache.set(normalizedHandle, Promise.resolve(resolvedId));
        return resolvedId;
      });

    handleToIdCache.set(normalizedHandle, promise);
    return promise;
  }

  function getCollectionCardItems() {
    const productLinks = Array.from(
      document.querySelectorAll('a[href*="/products/"]')
    );

    if (!productLinks.length) return [];

    const seenCards = new WeakSet();
    const items = [];

    for (const linkEl of productLinks) {
      const card = findProductCard(linkEl);
      if (!card || seenCards.has(card)) continue;
      seenCards.add(card);

      const handle = extractProductHandleFromUrl(linkEl.getAttribute("href"));
      const productUrl = getProductUrlFromLink(linkEl);
      if (!handle || !productUrl) continue;

      removeExistingCollectionBadge(card);

      items.push({
        card,
        linkEl,
        handle,
        productId: findExistingProductId(card, linkEl),
        productUrl,
      });
    }

    return items;
  }

  async function initCollectionBadges(root) {
    if (!root || root.dataset.badgeInitialized === "true") return;
    root.dataset.badgeInitialized = "true";

    const shop = safeText(root.dataset.shop);
    const endpoint = safeText(root.dataset.endpoint);
    const showRatingNumber = boolFromData(root.dataset.showRatingNumber, true);
    const showReviewCount = boolFromData(root.dataset.showReviewCount, true);
    const hideWhenNoReviews = boolFromData(root.dataset.hideWhenNoReviews, true);
    const styleVars = applyRootStyleVars(root);

    if (!shop || !endpoint) return;

    const cardItems = getCollectionCardItems();
    if (!cardItems.length) return;

    const missingIdItems = cardItems.filter((item) => !item.productId);

    if (missingIdItems.length) {
      await Promise.all(
        missingIdItems.map(async (item) => {
          item.productId = await fetchProductIdByHandle(item.handle);
        })
      );
    }

    const validItems = cardItems.filter((item) => safeText(item.productId));
    if (!validItems.length) return;

    const uniqueProductIds = [
      ...new Set(validItems.map((item) => safeText(item.productId))),
    ];

    try {
      const result = await fetchApprovedReviews({
        endpoint,
        shop,
        productIds: uniqueProductIds,
      });

      const grouped = groupReviewsByProductId(result?.data || []);

      validItems.forEach((item) => {
        const productReviews = grouped.get(safeText(item.productId)) || [];
        const count = productReviews.length;
        const average = count > 0 ? calculateAverage(productReviews) : 0;

        if (count === 0 && hideWhenNoReviews) return;

        const badgeHtml = buildBadgeMarkup({
          average,
          count,
          showRatingNumber,
          showReviewCount,
          href: item.productUrl,
          extraClass: "pr-star-badge--collection",
          styleVars,
        });

        insertCollectionBadge(item.card, badgeHtml);
      });
    } catch (error) {
      console.error("COLLECTION STAR BADGES ERROR:", error);
    }
  }

  async function initRoot(root) {
    if (!root) return;

    if (root.matches(PRODUCT_BADGE_ROOT_SELECTOR)) {
      await initProductBadge(root);
      return;
    }

    if (root.matches(COLLECTION_BADGE_ROOT_SELECTOR)) {
      await initCollectionBadges(root);
    }
  }

  async function initAll(scope = document) {
    const container = scope || document;

    const productRoots = Array.from(
      container.querySelectorAll(PRODUCT_BADGE_ROOT_SELECTOR)
    );
    await Promise.all(productRoots.map((root) => initProductBadge(root)));

    const collectionRoots = Array.from(
      container.querySelectorAll(COLLECTION_BADGE_ROOT_SELECTOR)
    );

    for (const root of collectionRoots) {
      await initCollectionBadges(root);
    }
  }

  window.StarRatingBadgeApp = {
    initRoot,
    initAll,
  };
})(window, document);
