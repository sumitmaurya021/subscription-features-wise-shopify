(function () {
  const MAX_REVIEW_IMAGES = 4;
  const MAX_VIDEO_SIZE_MB = 20;
  const TOTAL_STEPS = 4;
  const PRODUCT_FETCH_LIMIT = 24;
  const PRODUCT_SEARCH_DEBOUNCE = 250;

  const RATING_LABELS = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

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

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value).toLowerCase() === "true";
  }

  function getInitial(name = "") {
    const clean = safeText(name).trim();
    return clean ? clean.charAt(0).toUpperCase() : "A";
  }

  function renderStars(rating) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const rounded = Math.round(safeRating);
    return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
  }

  function normalizeYoutubeEmbedUrl(value) {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    try {
      if (raw.includes("/embed/")) {
        const parsedEmbed = new URL(raw);
        const parts = parsedEmbed.pathname.split("/embed/");
        const videoId = parts[1]?.split("/")[0] || "";
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      const parsed = new URL(raw);
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
    } catch {
      return null;
    }
  }

  function getYoutubeVideoId(value) {
    const embed = normalizeYoutubeEmbedUrl(value);
    if (!embed) return "";

    try {
      const parsed = new URL(embed);
      return parsed.pathname.split("/embed/")[1]?.split("/")[0] || "";
    } catch {
      return "";
    }
  }

  function getYoutubeThumbnailUrl(value) {
    const videoId = getYoutubeVideoId(value);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : "";
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function normalizeImageUrl(product) {
    if (!product) return "";

    const directCandidates = [
      product.featured_image,
      product.featuredImage,
      product.image,
      product.image_url,
      product.imageUrl,
      product.src,
    ];

    for (const item of directCandidates) {
      const value = safeText(item).trim();
      if (value) return value;
    }

    if (Array.isArray(product.images) && product.images.length) {
      const first = product.images[0];
      if (typeof first === "string" && first.trim()) return first.trim();
      if (first && typeof first === "object") {
        return safeText(first.src || first.url || first.image || "").trim();
      }
    }

    return "";
  }

  function normalizeProductRecord(product) {
    if (!product) return null;

    const id = safeText(
      product.id ||
        product.admin_graphql_api_id ||
        product.product_id ||
        product.handle
    ).trim();

    const handle = safeText(product.handle).trim();
    const title = safeText(product.title || product.name).trim();
    const image = normalizeImageUrl(product);

    if (!id && !handle) return null;
    if (!title) return null;

    return {
      id,
      handle,
      title,
      image,
    };
  }

  function dedupeProducts(items) {
    const map = new Map();

    toArray(items).forEach((item) => {
      const normalized = normalizeProductRecord(item);
      if (!normalized) return;

      const key = normalized.id || normalized.handle || normalized.title;
      if (!map.has(key)) {
        map.set(key, normalized);
      }
    });

    return Array.from(map.values());
  }

  function getFlowMarkup() {
    return `
      <div class="hcrf-modal" hidden>
        <div class="hcrf-overlay" data-hcrf-close></div>

        <div
          class="hcrf-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hcrf-dialog-title"
        >
          <button
            type="button"
            class="hcrf-close"
            aria-label="Close review form"
            data-hcrf-close
          >
            ×
          </button>

          <div class="hcrf-shell">
            <div class="hcrf-selector-screen" data-hcrf-screen="selector">
              <div class="hcrf-selector-card">
                <div class="hcrf-selector-head">
                  <p class="hcrf-eyebrow">Write a review</p>
                  <h2 id="hcrf-dialog-title" class="hcrf-title">
                    What would you like to review?
                  </h2>
                  <p class="hcrf-subtitle">
                    Choose whether you want to review the store or a product.
                  </p>
                </div>

                <div class="hcrf-choice-grid">
                  <button
                    type="button"
                    class="hcrf-choice-card"
                    data-hcrf-choice="store"
                  >
                    <span class="hcrf-choice-icon">🏬</span>
                    <span class="hcrf-choice-title">Store review</span>
                    <span class="hcrf-choice-copy">
                      Share your shopping experience with this store.
                    </span>
                  </button>

                  <button
                    type="button"
                    class="hcrf-choice-card"
                    data-hcrf-choice="product"
                  >
                    <span class="hcrf-choice-icon">📦</span>
                    <span class="hcrf-choice-title">Product review</span>
                    <span class="hcrf-choice-copy">
                      Select a product and review that specific item.
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div class="hcrf-product-screen" data-hcrf-screen="product-picker" hidden>
              <div class="hcrf-product-picker">
                <div class="hcrf-product-head">
                  <button type="button" class="hcrf-back-btn" data-hcrf-back-to-selector>
                    ← Back
                  </button>

                  <div>
                    <p class="hcrf-eyebrow">Product review</p>
                    <h2 class="hcrf-title">Select a product</h2>
                    <p class="hcrf-subtitle">
                      Search and choose the product you want to review.
                    </p>
                  </div>
                </div>

                <div class="hcrf-product-search">
                  <input
                    type="search"
                    class="hcrf-product-search-input"
                    placeholder="Search products..."
                    autocomplete="off"
                  >
                </div>

                <div class="hcrf-product-status" data-hcrf-product-status>
                  Loading products...
                </div>

                <div class="hcrf-product-list" data-hcrf-product-list></div>
              </div>
            </div>

            <div class="hcrf-form-screen" data-hcrf-screen="form" hidden>
              <div class="hcrf-form-wrap">
                <div class="hcrf-form-top">
                  <button type="button" class="hcrf-back-btn" data-hcrf-back-from-form>
                    ← Back
                  </button>

                  <div class="hcrf-progress">
                    <div class="hcrf-progress-bar">
                      <span class="hcrf-progress-fill" data-hcrf-progress-fill></span>
                    </div>

                    <div class="hcrf-step-dots">
                      <button type="button" class="hcrf-step-dot is-active" data-hcrf-step-dot="1" aria-label="Step 1"></button>
                      <button type="button" class="hcrf-step-dot" data-hcrf-step-dot="2" aria-label="Step 2"></button>
                      <button type="button" class="hcrf-step-dot" data-hcrf-step-dot="3" aria-label="Step 3"></button>
                      <button type="button" class="hcrf-step-dot" data-hcrf-step-dot="4" aria-label="Step 4"></button>
                    </div>
                  </div>
                </div>

                <form class="hcrf-form" novalidate>
                  <input type="hidden" name="reviewType" value="">
                  <input type="hidden" name="targetId" value="">
                  <input type="hidden" name="targetHandle" value="">
                  <input type="hidden" name="targetTitle" value="">
                  <input type="hidden" name="productId" value="">
                  <input type="hidden" name="productTitle" value="">
                  <input type="hidden" name="shop" value="">

                  <div class="hcrf-form-body">
                    <section class="hcrf-step is-active" data-hcrf-step="1" aria-hidden="false">
                      <div class="hcrf-step-inner hcrf-step-inner--center">
                        <p class="hcrf-eyebrow" data-hcrf-current-type-label>Store review</p>
                        <h2 class="hcrf-title" data-hcrf-step-title>
                          How would you rate this?
                        </h2>

                        <div class="hcrf-subject-card">
                          <div class="hcrf-subject-media" data-hcrf-subject-media></div>
                          <div class="hcrf-subject-content">
                            <div class="hcrf-subject-label" data-hcrf-subject-label>Store</div>
                            <div class="hcrf-subject-title" data-hcrf-subject-title></div>
                          </div>
                        </div>

                        <div class="hcrf-rating-wrap">
                          <input type="hidden" name="rating" value="" required>

                          <div class="hcrf-stars" data-hcrf-stars>
                            <button type="button" class="hcrf-star-btn" data-hcrf-star="1" aria-label="1 star">★</button>
                            <button type="button" class="hcrf-star-btn" data-hcrf-star="2" aria-label="2 stars">★</button>
                            <button type="button" class="hcrf-star-btn" data-hcrf-star="3" aria-label="3 stars">★</button>
                            <button type="button" class="hcrf-star-btn" data-hcrf-star="4" aria-label="4 stars">★</button>
                            <button type="button" class="hcrf-star-btn" data-hcrf-star="5" aria-label="5 stars">★</button>
                          </div>

                          <div class="hcrf-rating-scale">
                            <span>Poor</span>
                            <span>Excellent</span>
                          </div>

                          <div class="hcrf-rating-text" data-hcrf-rating-text>Select rating</div>
                          <div class="hcrf-error" data-hcrf-error="rating"></div>
                        </div>
                      </div>
                    </section>

                    <section class="hcrf-step" data-hcrf-step="2" aria-hidden="true">
                      <div class="hcrf-step-inner">
                        <h2 class="hcrf-title">Write your review</h2>

                        <div class="hcrf-rating-preview">
                          <div class="hcrf-rating-preview-stars" data-hcrf-rating-preview-stars>☆☆☆☆☆</div>
                          <div class="hcrf-rating-preview-label" data-hcrf-rating-preview-label>
                            No rating selected
                          </div>
                        </div>

                        <div class="hcrf-field">
                          <label for="hcrf-title-input">Review title</label>
                          <input
                            id="hcrf-title-input"
                            type="text"
                            name="title"
                            maxlength="80"
                            placeholder="Give your review a title"
                          >
                          <div class="hcrf-helper-row">
                            <span>Keep it short and clear</span>
                            <span data-hcrf-title-count>0 / 80</span>
                          </div>
                          <div class="hcrf-error" data-hcrf-error="title"></div>
                        </div>

                        <div class="hcrf-field">
                          <label for="hcrf-message-input">Review content <span class="hcrf-required">*</span></label>
                          <textarea
                            id="hcrf-message-input"
                            name="message"
                            rows="7"
                            maxlength="1000"
                            placeholder="Start writing here..."
                            required
                          ></textarea>
                          <div class="hcrf-helper-row">
                            <span>Minimum 20 characters recommended</span>
                            <span data-hcrf-message-count>0 / 1000</span>
                          </div>
                          <div class="hcrf-error" data-hcrf-error="message"></div>
                        </div>
                      </div>
                    </section>

                    <section class="hcrf-step" data-hcrf-step="3" aria-hidden="true">
                      <div class="hcrf-step-inner">
                        <h2 class="hcrf-title">About you</h2>

                        <div class="hcrf-field">
                          <label for="hcrf-email-input">Email address</label>
                          <input
                            id="hcrf-email-input"
                            type="email"
                            name="customerEmail"
                            placeholder="Your email address"
                          >
                          <div class="hcrf-helper-note">We respect your privacy.</div>
                          <div class="hcrf-error" data-hcrf-error="customerEmail"></div>
                        </div>

                        <div class="hcrf-field">
                          <label for="hcrf-name-input">Display name <span class="hcrf-required">*</span></label>
                          <input
                            id="hcrf-name-input"
                            type="text"
                            name="customerName"
                            placeholder="Display name"
                            required
                          >
                          <div class="hcrf-error" data-hcrf-error="customerName"></div>
                        </div>

                        <label class="hcrf-anonymous-toggle" for="hcrf-anonymous-input">
                          <input id="hcrf-anonymous-input" type="checkbox" name="postAnonymous">
                          <span>Post review as anonymous</span>
                        </label>
                      </div>
                    </section>

                    <section class="hcrf-step" data-hcrf-step="4" aria-hidden="true">
                      <div class="hcrf-step-inner">
                        <h2 class="hcrf-title">Add photo or video</h2>

                        <div class="hcrf-upload-grid">
                          <div class="hcrf-field">
                            <label for="hcrf-images-input">Upload photos</label>

                            <div class="hcrf-dropzone" data-hcrf-image-dropzone tabindex="0" role="button">
                              <input
                                id="hcrf-images-input"
                                type="file"
                                name="reviewImages"
                                accept="image/png,image/jpeg,image/jpg"
                                multiple
                              >
                              <div class="hcrf-dropzone-title">Click to upload <span>or drag and drop</span></div>
                              <div class="hcrf-dropzone-subtext">JPG, PNG</div>
                            </div>

                            <div class="hcrf-preview-wrap" data-hcrf-image-preview-wrap hidden>
                              <div class="hcrf-preview-label">Selected photos</div>
                              <div class="hcrf-image-preview" data-hcrf-image-preview></div>
                            </div>

                            <div class="hcrf-error" data-hcrf-error="reviewImages"></div>
                          </div>

                          <div class="hcrf-field">
                            <label for="hcrf-video-input">Upload video</label>

                            <div class="hcrf-dropzone" data-hcrf-video-dropzone tabindex="0" role="button">
                              <input
                                id="hcrf-video-input"
                                type="file"
                                name="reviewVideo"
                                accept="video/mp4,video/webm,video/quicktime"
                              >
                              <div class="hcrf-dropzone-title">Click to upload <span>or drag and drop</span></div>
                              <div class="hcrf-dropzone-subtext">MP4, WEBM, MOV</div>
                            </div>

                            <div class="hcrf-preview-wrap" data-hcrf-video-preview-wrap hidden>
                              <div class="hcrf-preview-label">Selected video</div>
                              <div class="hcrf-video-preview" data-hcrf-video-preview></div>
                            </div>

                            <div class="hcrf-error" data-hcrf-error="reviewVideo"></div>
                          </div>
                        </div>

                        <div class="hcrf-field">
                          <label for="hcrf-youtube-input">YouTube URL</label>
                          <input
                            id="hcrf-youtube-input"
                            type="url"
                            name="reviewYoutubeUrl"
                            placeholder="Paste your YouTube URL here"
                          >
                          <div class="hcrf-error" data-hcrf-error="reviewYoutubeUrl"></div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div class="hcrf-form-footer">
                    <button type="button" class="hcrf-footer-back" data-hcrf-step-back>
                      ← Back
                    </button>

                    <div class="hcrf-footer-actions">
                      <button type="button" class="hcrf-footer-next" data-hcrf-step-next>
                        Next
                      </button>
                      <button type="submit" class="hcrf-footer-submit" data-hcrf-submit hidden>
                        Submit review
                      </button>
                    </div>
                  </div>

                  <p class="hcrf-message-box" data-hcrf-message-box></p>
                </form>
              </div>
            </div>

            <div class="hcrf-success-screen" data-hcrf-screen="success" hidden>
              <div class="hcrf-success-card">
                <div class="hcrf-success-icon">✓</div>
                <h2 class="hcrf-title">Thanks for your review!</h2>
                <p class="hcrf-subtitle">
                  Your review has been submitted successfully and is waiting for approval.
                </p>

                <button type="button" class="hcrf-success-close" data-hcrf-success-close>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="hcrf-toast" data-hcrf-toast hidden></div>
      </div>
    `;
  }

  function getProductCardMarkup(product, index) {
    const image = product.image
      ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy">`
      : `<div class="hcrf-product-placeholder">${escapeHtml(
          getInitial(product.title)
        )}</div>`;

    return `
      <button
        type="button"
        class="hcrf-product-card"
        data-hcrf-product-index="${index}"
      >
        <div class="hcrf-product-thumb">${image}</div>
        <div class="hcrf-product-meta">
          <div class="hcrf-product-title">${escapeHtml(product.title)}</div>
          <div class="hcrf-product-action">Select product</div>
        </div>
      </button>
    `;
  }

  async function uploadVideoToCloudinary(file, config, reviewType, targetKey) {
    const cloudinaryCloudName = safeText(config.cloudinaryCloudName).trim();
    const cloudinaryUploadPreset = safeText(config.cloudinaryUploadPreset).trim();

    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      throw new Error("Cloudinary is not configured.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryUploadPreset);
    formData.append(
      "folder",
      `shopify-review-videos/${config.shop}/${reviewType}/${targetKey || "general"}`
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/video/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || "Video upload failed");
    }

    return result.secure_url;
  }

  function lockBody() {
    document.documentElement.classList.add("hcrf-modal-open");
    document.body.classList.add("hcrf-modal-open");
  }

  function unlockBody() {
    document.documentElement.classList.remove("hcrf-modal-open");
    document.body.classList.remove("hcrf-modal-open");
  }

  const HappyCustomersReviewFlow = {
    async create({ root, host, config, onSubmitted }) {
    const wrapper = document.createElement("div");
    wrapper.className = "hcrf-root";
    wrapper.innerHTML = getFlowMarkup();

    const rootStyles = window.getComputedStyle(root);
    const accentColor = rootStyles.getPropertyValue("--hcr-accent").trim() || "#108474";
    const buttonBg = rootStyles.getPropertyValue("--hcr-button-bg").trim() || accentColor;
    const buttonText = rootStyles.getPropertyValue("--hcr-button-text").trim() || "#ffffff";
    const textColor = rootStyles.getPropertyValue("--hcr-text").trim() || "#111827";
    const subtextColor = rootStyles.getPropertyValue("--hcr-subtext").trim() || "#6b7280";
    const borderColor = rootStyles.getPropertyValue("--hcr-border").trim() || "#e5e7eb";

    wrapper.style.setProperty("--hcr-accent", accentColor);
    wrapper.style.setProperty("--hcr-button-bg", buttonBg);
    wrapper.style.setProperty("--hcr-button-text", buttonText);
    wrapper.style.setProperty("--hcr-text", textColor);
    wrapper.style.setProperty("--hcr-subtext", subtextColor);
    wrapper.style.setProperty("--hcr-border", borderColor);

    document.body.appendChild(wrapper);

      const modal = wrapper.querySelector(".hcrf-modal");
      const overlayCloseEls = Array.from(
        wrapper.querySelectorAll("[data-hcrf-close]")
      );

      const screens = {
        selector: wrapper.querySelector('[data-hcrf-screen="selector"]'),
        productPicker: wrapper.querySelector('[data-hcrf-screen="product-picker"]'),
        form: wrapper.querySelector('[data-hcrf-screen="form"]'),
        success: wrapper.querySelector('[data-hcrf-screen="success"]'),
      };

      const selectorButtons = Array.from(
        wrapper.querySelectorAll("[data-hcrf-choice]")
      );

      const backToSelectorBtn = wrapper.querySelector("[data-hcrf-back-to-selector]");
      const backFromFormBtn = wrapper.querySelector("[data-hcrf-back-from-form]");
      const successCloseBtn = wrapper.querySelector("[data-hcrf-success-close]");

      const productSearchInput = wrapper.querySelector(".hcrf-product-search-input");
      const productStatusEl = wrapper.querySelector("[data-hcrf-product-status]");
      const productListEl = wrapper.querySelector("[data-hcrf-product-list]");

      const form = wrapper.querySelector(".hcrf-form");
      const messageBox = wrapper.querySelector("[data-hcrf-message-box]");
      const toastEl = wrapper.querySelector("[data-hcrf-toast]");

      const progressFill = wrapper.querySelector("[data-hcrf-progress-fill]");
      const stepDots = Array.from(
        wrapper.querySelectorAll("[data-hcrf-step-dot]")
      );
      const stepEls = Array.from(
        wrapper.querySelectorAll("[data-hcrf-step]")
      );

      const stepBackBtn = wrapper.querySelector("[data-hcrf-step-back]");
      const stepNextBtn = wrapper.querySelector("[data-hcrf-step-next]");
      const submitBtn = wrapper.querySelector("[data-hcrf-submit]");

      const currentTypeLabelEl = wrapper.querySelector("[data-hcrf-current-type-label]");
      const stepTitleEl = wrapper.querySelector("[data-hcrf-step-title]");
      const subjectLabelEl = wrapper.querySelector("[data-hcrf-subject-label]");
      const subjectTitleEl = wrapper.querySelector("[data-hcrf-subject-title]");
      const subjectMediaEl = wrapper.querySelector("[data-hcrf-subject-media]");

      const ratingInput = form.querySelector('input[name="rating"]');
      const starButtons = Array.from(
        wrapper.querySelectorAll("[data-hcrf-star]")
      );
      const ratingTextEl = wrapper.querySelector("[data-hcrf-rating-text]");
      const ratingPreviewStarsEl = wrapper.querySelector(
        "[data-hcrf-rating-preview-stars]"
      );
      const ratingPreviewLabelEl = wrapper.querySelector(
        "[data-hcrf-rating-preview-label]"
      );

      const titleInput = form.querySelector('input[name="title"]');
      const titleCountEl = wrapper.querySelector("[data-hcrf-title-count]");
      const messageInput = form.querySelector('textarea[name="message"]');
      const messageCountEl = wrapper.querySelector("[data-hcrf-message-count]");

      const emailInput = form.querySelector('input[name="customerEmail"]');
      const nameInput = form.querySelector('input[name="customerName"]');
      const anonymousInput = form.querySelector('input[name="postAnonymous"]');

      const imageInput = form.querySelector('input[name="reviewImages"]');
      const imageDropzone = wrapper.querySelector("[data-hcrf-image-dropzone]");
      const imagePreviewWrap = wrapper.querySelector(
        "[data-hcrf-image-preview-wrap]"
      );
      const imagePreviewEl = wrapper.querySelector("[data-hcrf-image-preview]");

      const videoInput = form.querySelector('input[name="reviewVideo"]');
      const videoDropzone = wrapper.querySelector("[data-hcrf-video-dropzone]");
      const videoPreviewWrap = wrapper.querySelector(
        "[data-hcrf-video-preview-wrap]"
      );
      const videoPreviewEl = wrapper.querySelector("[data-hcrf-video-preview]");

      const youtubeInput = form.querySelector('input[name="reviewYoutubeUrl"]');

      const hiddenFields = {
        reviewType: form.querySelector('input[name="reviewType"]'),
        targetId: form.querySelector('input[name="targetId"]'),
        targetHandle: form.querySelector('input[name="targetHandle"]'),
        targetTitle: form.querySelector('input[name="targetTitle"]'),
        productId: form.querySelector('input[name="productId"]'),
        productTitle: form.querySelector('input[name="productTitle"]'),
        shop: form.querySelector('input[name="shop"]'),
      };

      const state = {
        isOpen: false,
        screen: "selector",
        currentStep: 1,
        currentReviewType: "",
        selectedProduct: null,
        productsLoaded: false,
        productsLoading: false,
        allProducts: [],
        filteredProducts: [],
        productSearchTerm: "",
        productSearchTimer: null,
        selectedImages: [],
        selectedVideoFile: null,
        activeRating: 0,
        submitting: false,
      };

      hiddenFields.shop.value = safeText(config.shop || "").trim();
            function showToast(message, type = "success") {
        if (!toastEl) return;

        toastEl.hidden = false;
        toastEl.className = `hcrf-toast hcrf-toast--${type}`;
        toastEl.textContent = message;

        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
          toastEl.hidden = true;
          toastEl.textContent = "";
          toastEl.className = "hcrf-toast";
        }, 2800);
      }

      function setMessage(message, type = "") {
        if (!messageBox) return;

        messageBox.className = "hcrf-message-box";
        if (type) {
          messageBox.classList.add(`is-${type}`);
        }
        messageBox.textContent = message || "";
      }

      function getErrorEl(fieldName) {
        return wrapper.querySelector(`[data-hcrf-error="${fieldName}"]`);
      }

      function setFieldError(fieldName, message, inputEl) {
        const errorEl = getErrorEl(fieldName);
        if (errorEl) errorEl.textContent = message || "";
        if (inputEl) inputEl.classList.add("is-invalid");
      }

      function clearFieldError(fieldName, inputEl) {
        const errorEl = getErrorEl(fieldName);
        if (errorEl) errorEl.textContent = "";
        if (inputEl) inputEl.classList.remove("is-invalid");
      }

      function clearAllErrors() {
        [
          "rating",
          "title",
          "message",
          "customerEmail",
          "customerName",
          "reviewImages",
          "reviewVideo",
          "reviewYoutubeUrl",
        ].forEach((field) => clearFieldError(field));
      }

      function renderSubjectMedia() {
        if (!subjectMediaEl) return;

        const selected = state.selectedProduct;
        const isStore = state.currentReviewType === "store";

        if (isStore) {
          subjectMediaEl.innerHTML = `
            <div class="hcrf-subject-placeholder">
              <span>🏬</span>
            </div>
          `;
          return;
        }

        if (selected && selected.image) {
          subjectMediaEl.innerHTML = `
            <img src="${escapeHtml(selected.image)}" alt="${escapeHtml(
              selected.title
            )}">
          `;
          return;
        }

        subjectMediaEl.innerHTML = `
          <div class="hcrf-subject-placeholder">
            <span>${escapeHtml(
              getInitial(selected?.title || config.shopName || "P")
            )}</span>
          </div>
        `;
      }

      function syncSubjectUI() {
        const isStore = state.currentReviewType === "store";
        const title = isStore
          ? safeText(config.shopName || config.shop).trim()
          : safeText(state.selectedProduct?.title).trim();

        if (currentTypeLabelEl) {
          currentTypeLabelEl.textContent = isStore ? "Store review" : "Product review";
        }

        if (stepTitleEl) {
          stepTitleEl.textContent = isStore
            ? "How would you rate this store?"
            : "How would you rate this product?";
        }

        if (subjectLabelEl) {
          subjectLabelEl.textContent = isStore ? "Store" : "Product";
        }

        if (subjectTitleEl) {
          subjectTitleEl.textContent = title;
        }

        hiddenFields.reviewType.value = state.currentReviewType || "";
        hiddenFields.targetTitle.value = title || "";

        if (isStore) {
          hiddenFields.targetId.value = "";
          hiddenFields.targetHandle.value = "";
          hiddenFields.productId.value = "";
          hiddenFields.productTitle.value = "";
        } else {
          hiddenFields.targetId.value = safeText(state.selectedProduct?.id).trim();
          hiddenFields.targetHandle.value = safeText(state.selectedProduct?.handle).trim();
          hiddenFields.productId.value = safeText(state.selectedProduct?.id).trim();
          hiddenFields.productTitle.value = title || "";
        }

        renderSubjectMedia();
      }

      function setScreen(screenName) {
        state.screen = screenName;

        Object.entries(screens).forEach(([key, el]) => {
          if (!el) return;
          el.hidden = key !== screenName;
        });
      }

      function updateProgress() {
        if (!progressFill) return;
        progressFill.style.width = `${(state.currentStep / TOTAL_STEPS) * 100}%`;
      }

      function updateStepDots() {
        stepDots.forEach((dot) => {
          const step = Number(dot.getAttribute("data-hcrf-step-dot") || 0);
          dot.classList.toggle("is-active", step === state.currentStep);
        });
      }

      function updateStepButtons() {
        if (stepBackBtn) stepBackBtn.hidden = state.currentStep === 1;
        if (stepNextBtn) stepNextBtn.hidden = state.currentStep === TOTAL_STEPS;
        if (submitBtn) submitBtn.hidden = state.currentStep !== TOTAL_STEPS;
      }

      function getStepEl(step) {
        return stepEls.find(
          (item) => Number(item.getAttribute("data-hcrf-step")) === Number(step)
        );
      }

      function syncStepUI() {
        stepEls.forEach((stepEl) => {
          const stepNumber = Number(stepEl.getAttribute("data-hcrf-step") || 0);
          const isActive = stepNumber === state.currentStep;
          stepEl.classList.toggle("is-active", isActive);
          stepEl.setAttribute("aria-hidden", isActive ? "false" : "true");
        });

        updateProgress();
        updateStepDots();
        updateStepButtons();
      }

      function goToStep(step) {
        if (step < 1 || step > TOTAL_STEPS) return;
        state.currentStep = step;
        syncStepUI();
      }

      function resetStepFlow() {
        state.currentStep = 1;
        syncStepUI();
      }

      function resetProductPickerState() {
        state.productSearchTerm = "";
        if (productSearchInput) productSearchInput.value = "";
      }

      function resetFormState(keepTypeAndProduct = false) {
        form.reset();
        clearAllErrors();
        setMessage("");

        state.selectedImages = [];
        state.selectedVideoFile = null;
        state.activeRating = 0;

        if (!keepTypeAndProduct) {
          state.currentReviewType = "";
          state.selectedProduct = null;
        }

        if (imagePreviewEl) imagePreviewEl.innerHTML = "";
        if (imagePreviewWrap) imagePreviewWrap.hidden = true;

        if (videoPreviewEl) videoPreviewEl.innerHTML = "";
        if (videoPreviewWrap) videoPreviewWrap.hidden = true;

        if (imageInput) imageInput.value = "";
        if (videoInput) videoInput.value = "";
        if (youtubeInput) youtubeInput.value = "";

        if (titleCountEl) titleCountEl.textContent = "0 / 80";
        if (messageCountEl) messageCountEl.textContent = "0 / 1000";

        updateStarUI(0);
        updateRatingPreview();
        resetStepFlow();
        syncSubjectUI();
      }

      function open() {
        modal.hidden = false;
        state.isOpen = true;
        setScreen("selector");
        resetFormState(false);
        resetProductPickerState();
        lockBody();
      }

      function close() {
        modal.hidden = true;
        state.isOpen = false;
        unlockBody();
        setMessage("");
      }

      function openStoreForm() {
        state.currentReviewType = "store";
        state.selectedProduct = null;
        resetFormState(true);
        syncSubjectUI();
        setScreen("form");
      }

      function openProductPicker() {
        state.currentReviewType = "product";
        state.selectedProduct = null;
        resetFormState(true);
        resetProductPickerState();
        syncSubjectUI();
        setScreen("productPicker");
        loadProducts();
      }

      function backFromForm() {
        if (state.currentReviewType === "product") {
          setScreen("productPicker");
          return;
        }

        setScreen("selector");
      }

      function setProductStatus(message) {
        if (!productStatusEl) return;
        productStatusEl.textContent = message || "";
      }

      function renderProducts(items) {
        if (!productListEl) return;

        const products = dedupeProducts(items);
        state.filteredProducts = products;

        if (!products.length) {
          productListEl.innerHTML = "";
          setProductStatus("No products found.");
          return;
        }

        setProductStatus(`${products.length} product${products.length > 1 ? "s" : ""} found`);
        productListEl.innerHTML = products
          .map((product, index) => getProductCardMarkup(product, index))
          .join("");
      }

      function filterProductsLocally(keyword) {
        const search = safeText(keyword).trim().toLowerCase();

        if (!search) {
          renderProducts(state.allProducts);
          return;
        }

        const filtered = state.allProducts.filter((product) => {
          const title = safeText(product.title).toLowerCase();
          const handle = safeText(product.handle).toLowerCase();
          return title.includes(search) || handle.includes(search);
        });

        renderProducts(filtered);
      }

      async function fetchProductsJson(searchTerm = "") {
        const baseUrl = safeText(config.productsJsonUrl).trim();
        if (!baseUrl) return [];

        try {
          const url = new URL(baseUrl, window.location.origin);

          url.searchParams.set("limit", String(PRODUCT_FETCH_LIMIT));
          if (searchTerm) {
            url.searchParams.set("q", searchTerm);
          }

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: { Accept: "application/json" },
          });

          if (!response.ok) return [];

          const result = await response.json();
          const products = Array.isArray(result?.products) ? result.products : [];
          return dedupeProducts(products);
        } catch {
          return [];
        }
      }

      async function fetchPredictiveProducts(searchTerm = "") {
        const baseUrl = safeText(config.predictiveSearchUrl).trim();
        if (!baseUrl || !searchTerm) return [];

        try {
          const url = new URL(baseUrl, window.location.origin);
          url.searchParams.set("q", searchTerm);
          url.searchParams.set("resources[type]", "product");
          url.searchParams.set("resources[limit]", String(PRODUCT_FETCH_LIMIT));
          url.searchParams.set("section_id", "predictive-search");

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: { Accept: "text/html,application/json" },
          });

          if (!response.ok) return [];

          const contentType = response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const result = await response.json();
            const rawProducts =
              result?.resources?.results?.products ||
              result?.products ||
              [];
            return dedupeProducts(rawProducts);
          }

          const html = await response.text();
          const temp = document.createElement("div");
          temp.innerHTML = html;

          const links = Array.from(temp.querySelectorAll('a[href*="/products/"]'));
          const products = links.map((link) => {
            const href = safeText(link.getAttribute("href")).trim();
            const title =
              safeText(link.textContent).trim() ||
              safeText(link.getAttribute("title")).trim();

            const match = href.match(/\/products\/([^/?#]+)/i);
            return {
              id: match?.[1] || href,
              handle: match?.[1] || "",
              title,
              image:
                safeText(link.querySelector("img")?.getAttribute("src")).trim() ||
                safeText(link.querySelector("img")?.getAttribute("data-src")).trim(),
            };
          });

          return dedupeProducts(products);
        } catch {
          return [];
        }
      }

      async function loadProducts(searchTerm = "") {
        if (state.productsLoading) return;

        state.productsLoading = true;
        setProductStatus("Loading products...");
        if (productListEl) productListEl.innerHTML = "";

        try {
          let products = [];

          if (searchTerm) {
            products = await fetchPredictiveProducts(searchTerm);

            if (!products.length) {
              products = await fetchProductsJson(searchTerm);
            }
          } else {
            if (state.productsLoaded && state.allProducts.length) {
              renderProducts(state.allProducts);
              state.productsLoading = false;
              return;
            }

            products = await fetchProductsJson("");
          }

          products = dedupeProducts(products);

          if (!searchTerm) {
            state.allProducts = products;
            state.productsLoaded = true;
          } else if (!products.length && state.allProducts.length) {
            filterProductsLocally(searchTerm);
            state.productsLoading = false;
            return;
          }

          renderProducts(products);
        } catch (error) {
          console.error("Product load error:", error);
          setProductStatus("Failed to load products.");
          if (productListEl) productListEl.innerHTML = "";
        } finally {
          state.productsLoading = false;
        }
      }

      function selectProductByIndex(index) {
        const selected = state.filteredProducts[index];
        if (!selected) return;

        state.selectedProduct = selected;
        state.currentReviewType = "product";
        resetFormState(true);
        syncSubjectUI();
        setScreen("form");
      }

      selectorButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const choice = button.getAttribute("data-hcrf-choice");
          if (choice === "store") {
            openStoreForm();
          } else {
            openProductPicker();
          }
        });
      });

      if (backToSelectorBtn) {
        backToSelectorBtn.addEventListener("click", () => {
          setScreen("selector");
        });
      }

      if (backFromFormBtn) {
        backFromFormBtn.addEventListener("click", () => {
          backFromForm();
        });
      }

      if (successCloseBtn) {
        successCloseBtn.addEventListener("click", () => {
          close();
        });
      }

      overlayCloseEls.forEach((el) => {
        el.addEventListener("click", () => {
          close();
        });
      });

      if (productListEl) {
        productListEl.addEventListener("click", (event) => {
          const target = event.target.closest("[data-hcrf-product-index]");
          if (!target) return;

          const index = Number(target.getAttribute("data-hcrf-product-index"));
          if (Number.isNaN(index)) return;

          selectProductByIndex(index);
        });
      }

      if (productSearchInput) {
        productSearchInput.addEventListener("input", () => {
          const nextValue = safeText(productSearchInput.value).trim();
          state.productSearchTerm = nextValue;

          clearTimeout(state.productSearchTimer);
          state.productSearchTimer = setTimeout(() => {
            if (!nextValue) {
              renderProducts(state.allProducts);
              return;
            }

            if (state.allProducts.length) {
              filterProductsLocally(nextValue);
            }

            loadProducts(nextValue);
          }, PRODUCT_SEARCH_DEBOUNCE);
        });
      }

      document.addEventListener("keydown", (event) => {
        if (!state.isOpen) return;
        if (event.key === "Escape") {
          close();
        }
      });
            function updateRatingPreview() {
        const numericValue = Number(ratingInput?.value || 0);

        if (ratingPreviewStarsEl) {
          ratingPreviewStarsEl.textContent = renderStars(numericValue);
        }

        if (ratingPreviewLabelEl) {
          ratingPreviewLabelEl.textContent = numericValue
            ? `${RATING_LABELS[numericValue]} • ${numericValue}/5`
            : "No rating selected";
        }
      }

      function updateStarUI(value) {
        const numericValue = Number(value) || 0;
        state.activeRating = numericValue;

        if (ratingInput) {
          ratingInput.value = numericValue ? String(numericValue) : "";
        }

        if (ratingTextEl) {
          ratingTextEl.textContent = numericValue
            ? RATING_LABELS[numericValue]
            : "Select rating";
        }

        starButtons.forEach((btn) => {
          const starValue = Number(btn.getAttribute("data-hcrf-star") || 0);
          btn.classList.toggle("is-selected", starValue <= numericValue);
        });

        clearFieldError("rating");
        updateRatingPreview();
      }

      starButtons.forEach((btn) => {
        btn.addEventListener("mouseenter", () => {
          const hoverValue = Number(btn.getAttribute("data-hcrf-star") || 0);

          starButtons.forEach((starBtn) => {
            const starValue = Number(starBtn.getAttribute("data-hcrf-star") || 0);
            starBtn.classList.toggle("is-hover", starValue <= hoverValue);
          });
        });

        btn.addEventListener("mouseleave", () => {
          starButtons.forEach((starBtn) => {
            starBtn.classList.remove("is-hover");
          });
        });

        btn.addEventListener("click", () => {
          const value = Number(btn.getAttribute("data-hcrf-star") || 0);
          updateStarUI(value);
        });
      });

      const starsWrap = wrapper.querySelector("[data-hcrf-stars]");
      if (starsWrap) {
        starsWrap.addEventListener("mouseleave", () => {
          starButtons.forEach((starBtn) => {
            starBtn.classList.remove("is-hover");
          });
        });
      }

      function updateImageInputFiles() {
        if (!imageInput) return;

        const dt = new DataTransfer();
        state.selectedImages.forEach((file) => dt.items.add(file));
        imageInput.files = dt.files;
      }

      function renderImagePreview(files) {
        if (!imagePreviewEl || !imagePreviewWrap) return;

        imagePreviewEl.innerHTML = "";

        if (!files.length) {
          imagePreviewWrap.hidden = true;
          return;
        }

        imagePreviewWrap.hidden = false;

        files.forEach((file, index) => {
          const reader = new FileReader();

          reader.onload = (e) => {
            const item = document.createElement("div");
            item.className = "hcrf-image-item";
            item.innerHTML = `
              <img src="${escapeHtml(e.target?.result || "")}" alt="Preview">
              <button
                type="button"
                class="hcrf-image-remove"
                data-hcrf-remove-image="${index}"
                aria-label="Remove image"
              >
                ×
              </button>
            `;
            imagePreviewEl.appendChild(item);
          };

          reader.readAsDataURL(file);
        });
      }

      function renderVideoPreview(file) {
        if (!videoPreviewEl || !videoPreviewWrap) return;

        videoPreviewEl.innerHTML = "";

        if (!file) {
          videoPreviewWrap.hidden = true;
          return;
        }

        const videoUrl = URL.createObjectURL(file);
        videoPreviewWrap.hidden = false;
        videoPreviewEl.innerHTML = `
          <div class="hcrf-video-item">
            <video src="${videoUrl}" controls playsinline></video>
            <button
              type="button"
              class="hcrf-video-remove"
              data-hcrf-remove-video
              aria-label="Remove video"
            >
              ×
            </button>
          </div>
        `;
      }

      function getFileUniqueKey(file) {
        return [file.name, file.size, file.lastModified, file.type].join("__");
      }

      function handleSelectedImages(fileList) {
        const incomingFiles = Array.from(fileList || []);
        if (!incomingFiles.length) return;

        const validFiles = incomingFiles.filter((file) =>
          ["image/jpeg", "image/jpg", "image/png"].includes(file.type)
        );

        if (!validFiles.length) {
          setFieldError(
            "reviewImages",
            "Only JPG and PNG images are allowed.",
            imageDropzone
          );
          showToast("Only JPG and PNG images are allowed.", "error");
          return;
        }

        const existingMap = new Map(
          state.selectedImages.map((file) => [getFileUniqueKey(file), file])
        );

        validFiles.forEach((file) => {
          const key = getFileUniqueKey(file);
          if (!existingMap.has(key)) {
            existingMap.set(key, file);
          }
        });

        const mergedFiles = Array.from(existingMap.values());

        if (mergedFiles.length > MAX_REVIEW_IMAGES) {
          state.selectedImages = mergedFiles.slice(0, MAX_REVIEW_IMAGES);
          showToast(`You can upload up to ${MAX_REVIEW_IMAGES} images only.`, "error");
        } else {
          state.selectedImages = mergedFiles;
        }

        updateImageInputFiles();
        renderImagePreview(state.selectedImages);
        clearFieldError("reviewImages", imageDropzone);

        if (imageInput) imageInput.value = "";
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
          showToast("Only MP4, WEBM, and MOV videos are allowed.", "error");
          return;
        }

        if (file.size > maxVideoSize) {
          setFieldError(
            "reviewVideo",
            `Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`,
            videoDropzone
          );
          showToast(`Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`, "error");
          return;
        }

        state.selectedVideoFile = file;
        renderVideoPreview(file);
        clearFieldError("reviewVideo", videoDropzone);
      }

      function bindDropzone(dropzoneEl, inputEl, onFiles) {
        if (!dropzoneEl || !inputEl) return;

        dropzoneEl.addEventListener("click", () => inputEl.click());

        dropzoneEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputEl.click();
          }
        });

        ["dragenter", "dragover"].forEach((eventName) => {
          dropzoneEl.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzoneEl.classList.add("is-dragover");
          });
        });

        ["dragleave", "dragend"].forEach((eventName) => {
          dropzoneEl.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
            dropzoneEl.classList.remove("is-dragover");
          });
        });

        dropzoneEl.addEventListener("drop", (event) => {
          event.preventDefault();
          event.stopPropagation();
          dropzoneEl.classList.remove("is-dragover");
          const files = event.dataTransfer?.files;
          if (files?.length) onFiles(files);
        });
      }

      if (imageInput) {
        imageInput.addEventListener("change", (event) => {
          handleSelectedImages(event.target.files);
        });
      }

      if (videoInput) {
        videoInput.addEventListener("change", (event) => {
          const file = event.target.files?.[0];
          if (file) handleSelectedVideo(file);
        });
      }

      bindDropzone(imageDropzone, imageInput, handleSelectedImages);
      bindDropzone(videoDropzone, videoInput, (files) => {
        const file = files?.[0];
        if (file) handleSelectedVideo(file);
      });

      if (imagePreviewEl) {
        imagePreviewEl.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-hcrf-remove-image]");
          if (!btn) return;

          const index = Number(btn.getAttribute("data-hcrf-remove-image"));
          if (Number.isNaN(index)) return;

          state.selectedImages.splice(index, 1);
          updateImageInputFiles();
          renderImagePreview(state.selectedImages);
          clearFieldError("reviewImages", imageDropzone);
        });
      }

      if (videoPreviewEl) {
        videoPreviewEl.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-hcrf-remove-video]");
          if (!btn) return;

          state.selectedVideoFile = null;
          if (videoInput) videoInput.value = "";
          renderVideoPreview(null);
          clearFieldError("reviewVideo", videoDropzone);
        });
      }

      function validateStep(step, showErrors = true) {
        let isValid = true;

        const reviewType = safeText(hiddenFields.reviewType.value).trim();
        const rating = Number(ratingInput?.value || 0);
        const title = safeText(titleInput?.value).trim();
        const message = safeText(messageInput?.value).trim();
        const customerEmail = safeText(emailInput?.value).trim();
        const customerName = safeText(nameInput?.value).trim();
        const youtubeUrl = safeText(youtubeInput?.value).trim();

        if (!reviewType) {
          isValid = false;
          if (showErrors) {
            setMessage("Please choose store or product first.", "error");
          }
          return isValid;
        }

        if (reviewType === "product" && !safeText(hiddenFields.productId.value).trim()) {
          isValid = false;
          if (showErrors) {
            setMessage("Please select a product first.", "error");
          }
          return isValid;
        }

        if (step === 1) {
          if (!rating) {
            isValid = false;
            if (showErrors) setFieldError("rating", "Please select a rating.", starsWrap);
          } else {
            clearFieldError("rating", starsWrap);
          }
        }

        if (step === 2) {
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
              setFieldError("message", "Review content is required.", messageInput);
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
        }

        if (step === 3) {
          if (!customerName && !anonymousInput?.checked) {
            isValid = false;
            if (showErrors) {
              setFieldError("customerName", "Display name is required.", nameInput);
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
        }

        if (step === 4) {
          if (state.selectedImages.length > MAX_REVIEW_IMAGES) {
            isValid = false;
            if (showErrors) {
              setFieldError(
                "reviewImages",
                `You can upload up to ${MAX_REVIEW_IMAGES} images only.`,
                imageDropzone
              );
            }
          } else {
            clearFieldError("reviewImages", imageDropzone);
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
        }

        return isValid;
      }

      if (stepBackBtn) {
        stepBackBtn.addEventListener("click", () => {
          goToStep(state.currentStep - 1);
        });
      }

      if (stepNextBtn) {
        stepNextBtn.addEventListener("click", () => {
          const isValid = validateStep(state.currentStep, true);
          if (!isValid) {
            showToast("Please complete this step first.", "error");
            return;
          }
          goToStep(state.currentStep + 1);
        });
      }

      stepDots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const nextStep = Number(dot.getAttribute("data-hcrf-step-dot") || 0);
          if (!nextStep || nextStep === state.currentStep) return;

          if (nextStep > state.currentStep) {
            for (let step = 1; step < nextStep; step += 1) {
              if (!validateStep(step, true)) {
                showToast("Please complete previous steps first.", "error");
                return;
              }
            }
          }

          goToStep(nextStep);
        });
      });

      if (titleInput) {
        titleInput.addEventListener("input", () => {
          const count = titleInput.value.length;
          if (titleCountEl) titleCountEl.textContent = `${count} / 80`;
          if (count <= 80) clearFieldError("title", titleInput);
        });
      }

      if (messageInput) {
        messageInput.addEventListener("input", () => {
          const count = messageInput.value.length;
          if (messageCountEl) messageCountEl.textContent = `${count} / 1000`;
          if (count >= 20) clearFieldError("message", messageInput);
        });
      }

      if (nameInput) {
        nameInput.addEventListener("input", () => {
          if (nameInput.value.trim()) {
            clearFieldError("customerName", nameInput);
          }
        });
      }

      if (emailInput) {
        emailInput.addEventListener("input", () => {
          const value = emailInput.value.trim();
          if (!value) {
            clearFieldError("customerEmail", emailInput);
            return;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(value)) {
            clearFieldError("customerEmail", emailInput);
          }
        });
      }

      if (anonymousInput) {
        anonymousInput.addEventListener("change", () => {
          if (anonymousInput.checked) {
            clearFieldError("customerName", nameInput);
          }
        });
      }

      if (youtubeInput) {
        youtubeInput.addEventListener("input", () => {
          const value = youtubeInput.value.trim();
          if (!value) {
            clearFieldError("reviewYoutubeUrl", youtubeInput);
            return;
          }

          if (normalizeYoutubeEmbedUrl(value)) {
            clearFieldError("reviewYoutubeUrl", youtubeInput);
          }
        });
      }      if (form) {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();

          if (state.submitting) return;
          setMessage("");

          const allStepsValid = [1, 2, 3, 4].every((step) =>
            validateStep(step, true)
          );

          if (!allStepsValid) {
            showToast("Please fix the highlighted fields.", "error");

            for (let step = 1; step <= 4; step += 1) {
              if (!validateStep(step, false)) {
                goToStep(step);
                break;
              }
            }
            return;
          }

          state.submitting = true;

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";
          }

          try {
            const reviewType = safeText(hiddenFields.reviewType.value).trim();
            const targetId = safeText(hiddenFields.targetId.value).trim();
            const targetHandle = safeText(hiddenFields.targetHandle.value).trim();
            const targetTitle = safeText(hiddenFields.targetTitle.value).trim();
            const productId = safeText(hiddenFields.productId.value).trim();
            const productTitle = safeText(hiddenFields.productTitle.value).trim();
            const shop = safeText(hiddenFields.shop.value).trim();

            let imageUrls = [];
            if (state.selectedImages.length) {
              imageUrls = await Promise.all(
                state.selectedImages.map((file) => fileToDataUrl(file))
              );
            }

            let uploadedVideoUrl = null;
            if (state.selectedVideoFile) {
              const uploadTargetKey =
                reviewType === "store"
                  ? "store"
                  : targetId || targetHandle || productId || "product";

              uploadedVideoUrl = await uploadVideoToCloudinary(
                state.selectedVideoFile,
                config,
                reviewType,
                uploadTargetKey
              );
            }

            const youtubeUrl = safeText(youtubeInput?.value).trim();
            const normalizedYoutubeUrl = youtubeUrl
              ? normalizeYoutubeEmbedUrl(youtubeUrl)
              : null;

            const useAnonymous = Boolean(anonymousInput?.checked);
            const customerName = useAnonymous
              ? "Anonymous"
              : safeText(nameInput?.value).trim();

            const payload = {
              shop,
              reviewType,
              targetId: reviewType === "store" ? null : targetId || null,
              targetHandle:
                reviewType === "collection"
                  ? targetHandle || null
                  : reviewType === "product"
                  ? targetHandle || null
                  : null,
              targetTitle: targetTitle || null,

              productId: reviewType === "product" ? productId || null : null,
              productTitle: reviewType === "product" ? productTitle || null : null,

              customerName,
              customerEmail: safeText(emailInput?.value).trim() || null,
              rating: Number(ratingInput?.value || 0),
              title: safeText(titleInput?.value).trim() || null,
              message: safeText(messageInput?.value).trim(),
              reviewImages: imageUrls,
              reviewVideoUrl: uploadedVideoUrl,
              reviewYoutubeUrl: normalizedYoutubeUrl || null,
            };

            const response = await fetch(config.endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
              const errorMessage =
                result.message || "Failed to submit review.";
              setMessage(errorMessage, "error");
              showToast(errorMessage, "error");
              return;
            }

            resetFormState(false);
            setScreen("success");
            showToast("Thanks for sharing your feedback!", "success");

            if (typeof onSubmitted === "function") {
              try {
                await onSubmitted({
                  reviewType,
                  review: result.data || null,
                });
              } catch (callbackError) {
                console.error("onSubmitted callback error:", callbackError);
              }
            }
          } catch (error) {
            console.error("Review submit error:", error);
            const errorMessage =
              error?.message || "Something went wrong while submitting review.";
            setMessage(errorMessage, "error");
            showToast(errorMessage, "error");
          } finally {
            state.submitting = false;

            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit review";
            }
          }
        });
      }

      updateStarUI(0);
      updateRatingPreview();
      syncSubjectUI();
      resetStepFlow();

      return {
        open,
        close,
        destroy() {
          unlockBody();
          wrapper.remove();
        },
      };
    },
  };

  window.HappyCustomersReviewFlow = HappyCustomersReviewFlow;
})();
