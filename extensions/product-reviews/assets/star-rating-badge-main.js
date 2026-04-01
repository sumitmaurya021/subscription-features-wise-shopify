(function (window, document) {
  if (window.StarRatingBadgeApp) return;

  const PRODUCT_BADGE_ROOT_SELECTOR =
    ".pr-star-rating-badge-root[data-badge-type='product']";
  const COLLECTION_BADGE_ROOT_SELECTOR =
    ".pr-collection-star-rating-badges-root[data-badge-type='collection']";

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
  ].join(",");

  const PRODUCT_TITLE_SELECTORS = [
    ".card__heading",
    ".card-information__text",
    ".product-card__title",
    ".card__heading a",
    "a.full-unstyled-link",
  ].join(",");

  const PRODUCT_INFO_SELECTORS = [
    ".card__information",
    ".card-information",
    ".card__content",
    ".product-card__info",
    ".card-information__wrapper",
  ].join(",");

  const PRODUCT_PRICE_SELECTORS = [
    ".price",
    ".price--on-sale",
    ".product-card__price",
  ].join(",");

  function boolFromData(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value) === "true";
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

  function clampRating(value) {
    const numeric = Number(value) || 0;
    return Math.max(0, Math.min(5, numeric));
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

  function buildBadgeMarkup({
    average = 0,
    count = 0,
    showRatingNumber = true,
    showReviewCount = true,
    href = "",
    extraClass = "",
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

    return `
      <${tagName}
        class="pr-star-badge ${extraClass} ${count > 0 ? "has-reviews" : "is-empty"}"
        ${tagAttrs}
        aria-label="${escapeHtml(reviewText)}"
      >
        <span class="pr-star-badge__stars" aria-hidden="true">
          <span class="pr-star-badge__stars-base">★★★★★</span>
          <span class="pr-star-badge__stars-fill" style="width:${fillWidth};">★★★★★</span>
        </span>
        ${
          showRatingNumber
            ? `<span class="pr-star-badge__rating">${escapeHtml(ratingText)}</span>`
            : ""
        }
        ${
          showReviewCount
            ? `<span class="pr-star-badge__count">${escapeHtml(reviewText)}</span>`
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

    if (productId) {
      params.productId = productId;
    }

    if (productIds && productIds.length) {
      params.productIds = productIds.join(",");
    }

    const response = await fetch(buildUrl(endpoint, params), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load badge reviews");
    }

    return result;
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

    if (!productId || !shop || !endpoint) return;

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
      });
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
      return `${parsed.pathname}${parsed.search}`;
    } catch (error) {
      return href;
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
    ].filter(Boolean);

    for (const element of candidates) {
      const productId =
        element?.dataset?.productId ||
        element?.getAttribute?.("data-product-id");
      if (productId) return safeText(productId);
    }

    return "";
  }

  function findInsertPosition(card) {
    if (!card) return null;

    const existingHost = card.querySelector(".pr-star-badge-host--collection");
    if (existingHost) {
      existingHost.remove();
    }

    const priceEl = card.querySelector(PRODUCT_PRICE_SELECTORS);
    if (priceEl && priceEl.parentNode) {
      return {
        mode: "before",
        target: priceEl,
      };
    }

    const titleEl = card.querySelector(PRODUCT_TITLE_SELECTORS);
    if (titleEl && titleEl.parentNode) {
      return {
        mode: "after",
        target: titleEl,
      };
    }

    const infoEl = card.querySelector(PRODUCT_INFO_SELECTORS);
    if (infoEl) {
      return {
        mode: "append",
        target: infoEl,
      };
    }

    return {
      mode: "append",
      target: card,
    };
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
    if (!handle) return "";

    try {
      const rootPath = window.Shopify?.routes?.root || "/";
      const response = await fetch(`${rootPath}products/${handle}.js`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) return "";

      const product = await response.json();
      return safeText(product?.id);
    } catch (error) {
      return "";
    }
  }

  async function initCollectionBadges(root) {
    if (!root || root.dataset.badgeInitialized === "true") return;
    root.dataset.badgeInitialized = "true";

    const shop = safeText(root.dataset.shop);
    const endpoint = safeText(root.dataset.endpoint);
    const showRatingNumber = boolFromData(root.dataset.showRatingNumber, true);
    const showReviewCount = boolFromData(root.dataset.showReviewCount, true);
    const hideWhenNoReviews = boolFromData(root.dataset.hideWhenNoReviews, true);

    if (!shop || !endpoint) return;

    const productLinks = Array.from(
      document.querySelectorAll('a[href*="/products/"]')
    );

    if (!productLinks.length) return;

    const seenCards = new WeakSet();
    const cardItems = [];

    for (const linkEl of productLinks) {
      const card = findProductCard(linkEl);
      if (!card || seenCards.has(card)) continue;
      seenCards.add(card);

      const handle = extractProductHandleFromUrl(linkEl.getAttribute("href"));
      const productUrl = getProductUrlFromLink(linkEl);
      if (!handle || !productUrl) continue;

      const productId = findExistingProductId(card, linkEl);

      cardItems.push({
        card,
        linkEl,
        handle,
        productId,
        productUrl,
      });
    }

    if (!cardItems.length) return;

    const missingIdItems = cardItems.filter((item) => !item.productId);

    if (missingIdItems.length) {
      const handleIdMap = new Map();

      await Promise.all(
        missingIdItems.map(async (item) => {
          if (handleIdMap.has(item.handle)) {
            item.productId = handleIdMap.get(item.handle);
            return;
          }

          const resolvedId = await fetchProductIdByHandle(item.handle);
          handleIdMap.set(item.handle, resolvedId);
          item.productId = resolvedId;
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

        if (count === 0 && hideWhenNoReviews) {
          return;
        }

        const badgeHtml = buildBadgeMarkup({
          average,
          count,
          showRatingNumber,
          showReviewCount,
          href: `${item.productUrl}#product-reviews-root`,
          extraClass: "pr-star-badge--collection",
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
    const productRoots = Array.from(
      (scope || document).querySelectorAll(PRODUCT_BADGE_ROOT_SELECTOR)
    );
    await Promise.all(productRoots.map(initProductBadge));

    const collectionRoots = Array.from(
      (scope || document).querySelectorAll(COLLECTION_BADGE_ROOT_SELECTOR)
    );

    for (const collectionRoot of collectionRoots) {
      await initCollectionBadges(collectionRoot);
    }
  }

  window.StarRatingBadgeApp = {
    initRoot,
    initAll,
  };
})(window, document);
