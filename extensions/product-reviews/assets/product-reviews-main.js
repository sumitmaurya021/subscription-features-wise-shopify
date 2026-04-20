(function () {
  const ROOT_SELECTOR = "#product-reviews-root";
  const MAX_REVIEW_IMAGES = 4;
  const MAX_VIDEO_SIZE_MB = 20;
  const MAX_IMAGE_SIZE_MB = 10;
  const DEFAULT_VISIBLE_COUNT = 4;
  const LOAD_MORE_STEP = 4;
  const TOTAL_STEPS = 4;
  const PAGE_SIZE = 8;

  const UPLOAD_DB_NAME = "pr-media-upload-db";
  const UPLOAD_DB_STORE = "jobs";
  const ACTIVE_UPLOAD_JOBS = new Set();

  const RATING_LABELS = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very Good",
    5: "Excellent",
  };

  function openUploadDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(UPLOAD_DB_NAME, 1);

      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(UPLOAD_DB_STORE)) {
          db.createObjectStore(UPLOAD_DB_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error || new Error("Failed to open upload DB"));
      };
    });
  }

  async function idbPut(value) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(UPLOAD_DB_STORE, "readwrite");
      const store = tx.objectStore(UPLOAD_DB_STORE);
      store.put(value);

      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error("Failed to save upload job"));
    });
  }

  async function idbGetAll() {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(UPLOAD_DB_STORE, "readonly");
      const store = tx.objectStore(UPLOAD_DB_STORE);
      const req = store.getAll();

      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error || new Error("Failed to list upload jobs"));
    });
  }

  async function idbDelete(key) {
    const db = await openUploadDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(UPLOAD_DB_STORE, "readwrite");
      const store = tx.objectStore(UPLOAD_DB_STORE);
      store.delete(key);

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error("Failed to delete upload job"));
    });
  }

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

  function getCloudinaryThumb(url, width = 300, height = 300) {
    if (!url || typeof url !== "string" || !url.includes("/upload/")) return url;
    return url.replace(
      "/upload/",
      `/upload/f_auto,q_auto,c_fill,w_${width},h_${height}/`
    );
  }

  function getCloudinaryContain(url, width = 1800, height = 1800) {
    if (!url || typeof url !== "string" || !url.includes("/upload/")) return url;
    return url.replace(
      "/upload/",
      `/upload/f_auto,q_auto,c_limit,w_${width},h_${height}/`
    );
  }

  function getWidgetMarkup(config) {
    return `
      <div class="pr-widget">
        <div class="pr-shell">
          <div class="pr-topbar">
            <div class="pr-topbar-content">
              <div class="pr-topbar-copy">
                <div class="pr-title-row">
                  <h3 class="pr-heading">Customer Reviews</h3>
                </div>

                <p class="pr-subheading">${escapeHtml(config.contextSubheading)}</p>

                <p class="pr-product-context">
                  Reviewing ${escapeHtml(config.contextLabel)}:
                  <strong>${escapeHtml(config.targetTitle)}</strong>
                </p>

                <div class="pr-inline-summary">
                  <div class="pr-average">Loading reviews...</div>
                </div>
              </div>

              <div class="pr-topbar-actions">
                <button type="button" id="pr-open-review-modal-btn" class="pr-open-review-modal-btn">
                  Write a review
                </button>

                <button
                  type="button"
                  id="pr-toggle-filter-panel-btn"
                  class="pr-icon-btn"
                  aria-expanded="false"
                  aria-controls="pr-toolbar-panel"
                  aria-label="Open filters"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16l-6 7v4l-4 2v-6L4 6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>
                  </svg>
                </button>

                <button
                  type="button"
                  id="pr-toggle-sort-panel-btn"
                  class="pr-icon-btn"
                  aria-expanded="false"
                  aria-controls="pr-toolbar-panel"
                  aria-label="Open sort options"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14M8 19l-3-3M8 19l3-3M16 5l3 3M16 5l-3 3M16 19V5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div id="pr-toolbar-panel" class="pr-toolbar-panel" hidden>
            <div class="pr-toolbar">
              <div class="pr-toolbar-top">
                <div class="pr-toolbar-search">
                  <input
                    type="text"
                    id="pr-search-input"
                    class="pr-search-input"
                    placeholder="Search reviews..."
                  >
                </div>

                <div id="pr-filter-chips" class="pr-filter-chips">
                  <button type="button" class="pr-filter-chip is-active" data-rating="all">All Reviews</button>
                  <button type="button" class="pr-filter-chip" data-rating="pinned">Pinned Reviews</button>
                  <button type="button" class="pr-filter-chip" data-rating="5">5★</button>
                  <button type="button" class="pr-filter-chip" data-rating="4">4★</button>
                  <button type="button" class="pr-filter-chip" data-rating="3">3★</button>
                  <button type="button" class="pr-filter-chip" data-rating="2">2★</button>
                  <button type="button" class="pr-filter-chip" data-rating="1">1★</button>
                </div>
              </div>

              <div class="pr-toolbar-bottom">
                <div class="pr-sort-segment" id="pr-sort-segment">
                  <button type="button" class="pr-sort-btn is-active" data-sort="newest">Newest</button>
                  <button type="button" class="pr-sort-btn" data-sort="highest">Highest</button>
                  <button type="button" class="pr-sort-btn" data-sort="lowest">Lowest</button>
                  <button type="button" class="pr-sort-btn" data-sort="oldest">Oldest</button>
                </div>

                <div id="pr-results-meta" class="pr-results-meta"></div>
              </div>
            </div>
          </div>

          <div class="pr-media-strip-block">
            <div class="pr-media-strip-head">
              <div>
                <h4 class="pr-media-strip-title">Real customer stories</h4>
                <div id="pr-media-strip-meta" class="pr-media-strip-meta"></div>
              </div>
            </div>

            <div class="pr-media-strip-slider">
              <button
                type="button"
                id="pr-media-strip-prev"
                class="pr-media-strip-nav pr-media-strip-prev"
                aria-label="Previous review media"
              >
                ‹
              </button>

              <div class="pr-media-strip-viewport">
                <div id="pr-media-strip-track" class="pr-media-strip-track"></div>
              </div>

              <button
                type="button"
                id="pr-media-strip-next"
                class="pr-media-strip-nav pr-media-strip-next"
                aria-label="Next review media"
              >
                ›
              </button>
            </div>
          </div>

          <div class="pr-list-section">
            <div class="pr-list"></div>

            <div class="pr-load-more-wrap">
              <button type="button" id="pr-load-more-btn" class="pr-load-more-btn">
                Load more reviews
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getPortalMarkup(config) {
    const subjectMedia = config.contextImage
      ? `<img src="${escapeHtml(config.contextImage)}" alt="${escapeHtml(config.targetTitle)}">`
      : `
        <div class="pr-review-subject-placeholder">
          <span>${escapeHtml((config.targetTitle || "A").slice(0, 1).toUpperCase())}</span>
        </div>
      `;

    return `
      <div id="pr-review-modal" class="pr-review-modal" hidden>
        <div class="pr-review-modal-overlay" data-close-review-modal="true"></div>

        <div class="pr-review-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="pr-review-modal-title">
          <button type="button" id="pr-review-modal-close" class="pr-review-modal-close" aria-label="Close review form">
            ×
          </button>

          <div class="pr-review-modal-shell">
            <div id="pr-review-modal-form-shell" class="pr-review-modal-form-shell">
              <form id="product-review-form" class="pr-review-form" novalidate>
                <input type="hidden" name="reviewType" value="${escapeHtml(config.reviewType)}">
                <input type="hidden" name="targetId" value="${escapeHtml(config.targetId)}">
                <input type="hidden" name="targetHandle" value="${escapeHtml(config.targetHandle)}">
                <input type="hidden" name="targetTitle" value="${escapeHtml(config.targetTitle)}">
                <input type="hidden" name="productId" value="${escapeHtml(config.productId)}">
                <input type="hidden" name="productTitle" value="${escapeHtml(config.productTitle)}">

                <div class="pr-review-modal-progress">
                  <div class="pr-review-modal-progress-bar">
                    <span id="pr-review-modal-progress-fill"></span>
                  </div>

                  <div class="pr-review-modal-steps">
                    <button type="button" class="pr-step-dot is-active" data-step-dot="1" aria-label="Step 1"></button>
                    <button type="button" class="pr-step-dot" data-step-dot="2" aria-label="Step 2"></button>
                    <button type="button" class="pr-step-dot" data-step-dot="3" aria-label="Step 3"></button>
                    <button type="button" class="pr-step-dot" data-step-dot="4" aria-label="Step 4"></button>
                  </div>
                </div>

                <div class="pr-review-modal-body">
                  <section class="pr-review-step is-active" data-step="1" aria-hidden="false">
                    <div class="pr-review-step-inner pr-review-step-rating">
                      <h2 id="pr-review-modal-title" class="pr-review-step-title">
                        How would you rate this ${escapeHtml(config.reviewSubject)}?
                      </h2>

                      <p class="pr-review-step-subtitle">
                        We would love it if you would share a bit about your experience.
                      </p>

                      <div class="pr-review-subject-card">
                        <div class="pr-review-subject-media">
                          ${subjectMedia}
                        </div>

                        <div class="pr-review-subject-title">${escapeHtml(config.targetTitle)}</div>
                      </div>

                      <div class="pr-rating-selector-wrap pr-rating-selector-wrap--modal">
                        <input type="hidden" id="pr-rating" name="rating" value="" required>

                        <div class="pr-star-selector pr-star-selector--modal" aria-label="Choose rating">
                          <button type="button" class="pr-star-btn" data-value="1" aria-label="1 star"><span class="pr-star-fill">★</span></button>
                          <button type="button" class="pr-star-btn" data-value="2" aria-label="2 stars"><span class="pr-star-fill">★</span></button>
                          <button type="button" class="pr-star-btn" data-value="3" aria-label="3 stars"><span class="pr-star-fill">★</span></button>
                          <button type="button" class="pr-star-btn" data-value="4" aria-label="4 stars"><span class="pr-star-fill">★</span></button>
                          <button type="button" class="pr-star-btn" data-value="5" aria-label="5 stars"><span class="pr-star-fill">★</span></button>
                        </div>

                        <div class="pr-rating-scale">
                          <span>Poor</span>
                          <span>Great</span>
                        </div>

                        <div id="pr-rating-live-text" class="pr-rating-live-text">Select rating</div>
                        <div class="pr-inline-error" data-error-for="rating"></div>
                      </div>
                    </div>
                  </section>

                  <section class="pr-review-step" data-step="2" aria-hidden="true">
                    <div class="pr-review-step-inner pr-review-step-content">
                      <h2 class="pr-review-step-title">${escapeHtml(config.targetTitle)}</h2>

                      <div class="pr-rating-preview-row">
                        <div class="pr-rating-preview-stars" id="pr-rating-preview-stars">☆☆☆☆☆</div>
                        <div class="pr-rating-preview-label" id="pr-rating-preview-label">No rating selected</div>
                      </div>

                      <div class="pr-step-field">
                        <label for="pr-title">Review title</label>
                        <input id="pr-title" type="text" name="title" placeholder="Give your review a title" maxlength="80">
                        <div class="pr-field-helper">
                          <span>Keep it short and clear</span>
                          <span id="pr-title-count">0 / 80</span>
                        </div>
                        <div class="pr-inline-error" data-error-for="title"></div>
                      </div>

                      <div class="pr-step-field">
                        <label for="pr-message">Review content <span class="pr-required">*</span></label>
                        <textarea id="pr-message" name="message" rows="8" placeholder="Start writing here..." required maxlength="1000"></textarea>
                        <div class="pr-field-helper">
                          <span>Minimum 20 characters recommended</span>
                          <span id="pr-message-count">0 / 1000</span>
                        </div>
                        <div class="pr-inline-error" data-error-for="message"></div>
                      </div>

                      <div class="pr-step-note">
                        We’ll only contact you about your review if necessary. By submitting your review, you agree to our terms and conditions and privacy policy.
                      </div>
                    </div>
                  </section>

                  <section class="pr-review-step" data-step="3" aria-hidden="true">
                    <div class="pr-review-step-inner pr-review-step-about">
                      <h2 class="pr-review-step-title">About you</h2>
                      <p class="pr-review-step-subtitle">Please tell us more about you.</p>

                      <div class="pr-step-field">
                        <label for="pr-customer-email">Email address</label>
                        <input id="pr-customer-email" type="email" name="customerEmail" placeholder="Your email address">
                        <div class="pr-step-field-note">We respect your privacy.</div>
                        <div class="pr-inline-error" data-error-for="customerEmail"></div>
                      </div>

                      <div class="pr-step-field">
                        <label for="pr-customer-name">Display name <span class="pr-required">*</span></label>
                        <input id="pr-customer-name" type="text" name="customerName" placeholder="Display name" required>
                        <div class="pr-inline-error" data-error-for="customerName"></div>
                      </div>

                      <label class="pr-anonymous-toggle" for="pr-post-anonymous">
                        <input id="pr-post-anonymous" type="checkbox" name="postAnonymous">
                        <span>Post review as anonymous</span>
                      </label>
                    </div>
                  </section>

                  <section class="pr-review-step" data-step="4" aria-hidden="true">
                    <div class="pr-review-step-inner pr-review-step-media">
                      <h2 class="pr-review-step-title">Share a picture or video</h2>
                      <p class="pr-review-step-subtitle">Upload a photo or video to support your review.</p>

                      <div class="pr-media-upload-grid">
                        <div class="pr-step-field">
                          <label for="pr-review-images">Upload photos</label>

                          <div id="pr-upload-dropzone" class="pr-upload-dropzone" tabindex="0" role="button" aria-label="Upload review images">
                            <input id="pr-review-images" class="pr-file-input" type="file" name="reviewImages" accept="image/png,image/jpeg,image/jpg" multiple>

                            <div class="pr-upload-icon-wrap">
                              <svg class="pr-upload-icon" viewBox="0 0 64 64" aria-hidden="true">
                                <path d="M32 12v24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
                                <path d="M22 22l10-10 10 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                                <path d="M16 38v8c0 2.2 1.8 4 4 4h24c2.2 0 4-1.8 4-4v-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
                              </svg>
                            </div>

                            <div class="pr-upload-title">Click to upload <span>or drag and drop</span></div>
                            <div class="pr-upload-subtext">Supports: JPG, PNG</div>
                          </div>

                          <div id="pr-image-preview-wrap" class="pr-image-preview-wrap" hidden>
                            <div class="pr-image-preview-label">Selected photos</div>
                            <div id="pr-image-preview" class="pr-image-preview"></div>
                          </div>

                          <div class="pr-inline-error" data-error-for="reviewImages"></div>
                        </div>

                        <div class="pr-step-field">
                          <label for="pr-review-video">Upload video</label>

                          <div id="pr-video-dropzone" class="pr-upload-dropzone" tabindex="0" role="button" aria-label="Upload review video">
                            <input id="pr-review-video" class="pr-file-input" type="file" name="reviewVideo" accept="video/mp4,video/webm,video/quicktime">

                            <div class="pr-upload-icon-wrap">
                              <svg class="pr-upload-icon" viewBox="0 0 64 64" aria-hidden="true">
                                <path d="M24 20h14c3.3 0 6 2.7 6 6v12c0 3.3-2.7 6-6 6H24c-3.3 0-6-2.7-6-6V26c0-3.3 2.7-6 6-6z" fill="none" stroke="currentColor" stroke-width="3"></path>
                                <path d="M29 28l10 6-10 6V28z" fill="currentColor"></path>
                                <path d="M46 28l8-5v22l-8-5V28z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"></path>
                              </svg>
                            </div>

                            <div class="pr-upload-title">Click to upload <span>or drag and drop</span></div>
                            <div class="pr-upload-subtext">Supports: MP4, WEBM, MOV</div>
                          </div>

                          <div id="pr-video-preview-wrap" class="pr-video-preview-wrap" hidden>
                            <div class="pr-image-preview-label">Selected video</div>
                            <div id="pr-video-preview" class="pr-video-preview"></div>
                          </div>

                          <div class="pr-inline-error" data-error-for="reviewVideo"></div>
                        </div>
                      </div>

                      <div class="pr-step-field">
                        <label for="pr-youtube-url">YouTube URL</label>
                        <input id="pr-youtube-url" type="url" name="reviewYoutubeUrl" placeholder="Paste your Youtube URL here">
                        <div class="pr-inline-error" data-error-for="reviewYoutubeUrl"></div>
                      </div>
                    </div>
                  </section>
                </div>

                <div class="pr-review-modal-footer">
                  <button type="button" id="pr-review-modal-back-btn" class="pr-review-modal-back-btn">← Back</button>

                  <div class="pr-review-modal-footer-actions">
                    <button type="button" id="pr-review-modal-next-btn" class="pr-review-modal-next-btn">Next</button>
                    <button type="submit" id="pr-review-modal-submit-btn" class="pr-review-modal-submit-btn" hidden>Submit review</button>
                  </div>
                </div>

                <p id="product-review-message" class="pr-message-box"></p>
              </form>
            </div>

            <div id="pr-review-modal-success" class="pr-review-modal-success" hidden>
              <div class="pr-review-modal-success-inner">
                <h2 class="pr-review-step-title">Thanks for your review!</h2>

                <p class="pr-review-step-subtitle">
                  We are processing it and it will appear on the store soon.
                </p>

                <p class="pr-success-copy">
                  Your review was submitted successfully.
                </p>

                <div class="pr-success-secondary">
                  <h3>Media upload note</h3>
                  <p>If you added photos or video, they are being attached after review submission.</p>
                </div>

                <div id="pr-upload-status-wrap" class="pr-upload-status-wrap" hidden>
                  <div class="pr-upload-status-head">
                    <strong id="pr-upload-status-title">Uploading media...</strong>
                    <span id="pr-upload-status-percent">0%</span>
                  </div>

                  <div class="pr-upload-progress">
                    <span id="pr-upload-progress-fill"></span>
                  </div>

                  <div id="pr-upload-status-text" class="pr-upload-status-text">
                    Preparing upload...
                  </div>
                </div>

                <div class="pr-store-feedback-stars" id="pr-store-feedback-stars">
                  <button type="button" class="pr-store-feedback-star" data-store-rating="1" aria-label="1 star">★</button>
                  <button type="button" class="pr-store-feedback-star" data-store-rating="2" aria-label="2 stars">★</button>
                  <button type="button" class="pr-store-feedback-star" data-store-rating="3" aria-label="3 stars">★</button>
                  <button type="button" class="pr-store-feedback-star" data-store-rating="4" aria-label="4 stars">★</button>
                  <button type="button" class="pr-store-feedback-star" data-store-rating="5" aria-label="5 stars">★</button>
                </div>

                <div class="pr-rating-scale pr-rating-scale--success">
                  <span>Poor</span>
                  <span>Great</span>
                </div>

                <div class="pr-review-modal-success-actions">
                  <button type="button" id="pr-review-modal-success-close" class="pr-review-modal-success-close">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="pr-review-detail-modal" class="pr-review-detail-modal" hidden>
        <div class="pr-review-detail-overlay" data-close-review-detail="true"></div>

        <div class="pr-review-detail-dialog" role="dialog" aria-modal="true" aria-label="Review details">
          <button type="button" id="pr-review-detail-close" class="pr-review-detail-close" aria-label="Close review details">
            ×
          </button>

          <div class="pr-review-detail-shell">
            <div class="pr-review-detail-media-pane">
              <button type="button" id="pr-review-detail-prev" class="pr-review-detail-nav pr-review-detail-prev" aria-label="Previous media">
                ‹
              </button>

              <div class="pr-review-detail-stage" id="pr-review-detail-stage"></div>

              <button type="button" id="pr-review-detail-next" class="pr-review-detail-nav pr-review-detail-next" aria-label="Next media">
                ›
              </button>

              <div class="pr-review-detail-thumbs-wrap">
                <div id="pr-review-detail-thumbs" class="pr-review-detail-thumbs"></div>
              </div>
            </div>

            <div class="pr-review-detail-content-pane">
              <div id="pr-review-detail-content" class="pr-review-detail-content"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="pr-toast" class="pr-toast" hidden></div>
    `;
  }

  function copyPortalTheme(root, portalHost) {
    const computed = window.getComputedStyle(root);
    const vars = [
      "--pr-text",
      "--pr-text-soft",
      "--pr-text-muted",
      "--pr-border",
      "--pr-border-strong",
      "--pr-bg",
      "--pr-bg-soft",
      "--pr-bg-panel",
      "--pr-accent",
      "--pr-accent-dark",
      "--pr-accent-soft",
      "--pr-star-empty",
      "--pr-overlay",
      "--pr-overlay-strong",
      "--pr-shadow-sm",
      "--pr-shadow-md",
      "--pr-shadow-lg",
      "--pr-radius-sm",
      "--pr-radius-md",
      "--pr-radius-lg",
      "--pr-radius-xl",
    ];

    vars.forEach((name) => {
      const value = computed.getPropertyValue(name);
      if (value) portalHost.style.setProperty(name, value.trim());
    });

    portalHost.style.fontFamily = computed.fontFamily || '"Open Sans", sans-serif';
    portalHost.style.color = computed.color || "#1d1d1f";
  }

  function initAll(scope = document) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));
    roots.forEach(initRoot);
  }

  function initRoot(root) {
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";

    const reviewType = (root.dataset.reviewType || "product").trim().toLowerCase();
    const targetId = root.dataset.targetId || "";
    const targetHandle = root.dataset.targetHandle || "";
    const targetTitle = root.dataset.targetTitle || "";
    const productId = root.dataset.productId || "";
    const productTitle = root.dataset.productTitle || "";
    const shop = root.dataset.shop || "";
    const endpoint = root.dataset.endpoint || "";
    const contextLabel = root.dataset.contextLabel || "";
    const contextSubheading = root.dataset.contextSubheading || "";
    const reviewSubject = root.dataset.reviewSubject || "product";
    const contextImage = root.dataset.contextImage || "";
    const cloudinaryCloudName = root.dataset.cloudinaryCloudName || "";
    const cloudinaryUploadPreset = root.dataset.cloudinaryUploadPreset || "";

    const config = {
      reviewType,
      targetId,
      targetHandle,
      targetTitle,
      productId,
      productTitle,
      contextLabel,
      contextSubheading,
      reviewSubject,
      contextImage,
    };

    root.innerHTML = getWidgetMarkup(config);

    const oldPortalId = root.dataset.portalId;
    if (oldPortalId) {
      const oldPortal = document.getElementById(oldPortalId);
      if (oldPortal) oldPortal.remove();
    }

    const portalHost = document.createElement("div");
    const portalId = `pr-portal-${Math.random().toString(36).slice(2, 11)}`;
    portalHost.id = portalId;
    portalHost.className = "pr-portal-root";
    copyPortalTheme(root, portalHost);
    portalHost.innerHTML = getPortalMarkup(config);
    document.body.appendChild(portalHost);
    root.dataset.portalId = portalId;

    const summaryEl = root.querySelector(".pr-average");
    const listEl = root.querySelector(".pr-list");
    const loadMoreBtn = root.querySelector("#pr-load-more-btn");
    const resultsMetaEl = root.querySelector("#pr-results-meta");

    const searchInput = root.querySelector("#pr-search-input");
    const filterChipsWrap = root.querySelector("#pr-filter-chips");
    const filterChips = Array.from(root.querySelectorAll(".pr-filter-chip"));
    const sortSegment = root.querySelector("#pr-sort-segment");
    const sortButtons = Array.from(root.querySelectorAll(".pr-sort-btn"));

    const toolbarPanel = root.querySelector("#pr-toolbar-panel");
    const toggleFilterPanelBtn = root.querySelector("#pr-toggle-filter-panel-btn");
    const toggleSortPanelBtn = root.querySelector("#pr-toggle-sort-panel-btn");

    const mediaStripTrack = root.querySelector("#pr-media-strip-track");
    const mediaStripMeta = root.querySelector("#pr-media-strip-meta");
    const mediaStripPrev = root.querySelector("#pr-media-strip-prev");
    const mediaStripNext = root.querySelector("#pr-media-strip-next");

    const openReviewModalBtn = root.querySelector("#pr-open-review-modal-btn");

    const toastEl = portalHost.querySelector("#pr-toast");

    const reviewModal = portalHost.querySelector("#pr-review-modal");
    const reviewModalClose = portalHost.querySelector("#pr-review-modal-close");
    const reviewModalFormShell = portalHost.querySelector("#pr-review-modal-form-shell");
    const reviewModalSuccess = portalHost.querySelector("#pr-review-modal-success");
    const reviewModalSuccessClose = portalHost.querySelector("#pr-review-modal-success-close");

    const uploadStatusWrap = portalHost.querySelector("#pr-upload-status-wrap");
    const uploadStatusTitle = portalHost.querySelector("#pr-upload-status-title");
    const uploadStatusPercent = portalHost.querySelector("#pr-upload-status-percent");
    const uploadProgressFill = portalHost.querySelector("#pr-upload-progress-fill");
    const uploadStatusText = portalHost.querySelector("#pr-upload-status-text");

    const form = portalHost.querySelector("#product-review-form");
    const messageEl = portalHost.querySelector("#product-review-message");
    const submitBtn = portalHost.querySelector("#pr-review-modal-submit-btn");
    const backBtn = portalHost.querySelector("#pr-review-modal-back-btn");
    const nextBtn = portalHost.querySelector("#pr-review-modal-next-btn");
    const progressFill = portalHost.querySelector("#pr-review-modal-progress-fill");
    const stepDots = Array.from(portalHost.querySelectorAll("[data-step-dot]"));
    const steps = Array.from(portalHost.querySelectorAll(".pr-review-step"));

    const ratingInput = portalHost.querySelector("#pr-rating");
    const ratingLiveText = portalHost.querySelector("#pr-rating-live-text");
    const ratingPreviewStars = portalHost.querySelector("#pr-rating-preview-stars");
    const ratingPreviewLabel = portalHost.querySelector("#pr-rating-preview-label");
    const starButtons = Array.from(portalHost.querySelectorAll(".pr-star-btn"));

    const titleInput = portalHost.querySelector("#pr-title");
    const titleCount = portalHost.querySelector("#pr-title-count");
    const messageInput = portalHost.querySelector("#pr-message");
    const messageCount = portalHost.querySelector("#pr-message-count");

    const nameInput = portalHost.querySelector("#pr-customer-name");
    const emailInput = portalHost.querySelector("#pr-customer-email");
    const anonymousInput = portalHost.querySelector("#pr-post-anonymous");

    const imageInput = portalHost.querySelector("#pr-review-images");
    const imagePreview = portalHost.querySelector("#pr-image-preview");
    const imagePreviewWrap = portalHost.querySelector("#pr-image-preview-wrap");
    const uploadDropzone = portalHost.querySelector("#pr-upload-dropzone");

    const youtubeInput = portalHost.querySelector("#pr-youtube-url");
    const videoInput = portalHost.querySelector("#pr-review-video");
    const videoDropzone = portalHost.querySelector("#pr-video-dropzone");
    const videoPreview = portalHost.querySelector("#pr-video-preview");
    const videoPreviewWrap = portalHost.querySelector("#pr-video-preview-wrap");

    const successStars = Array.from(portalHost.querySelectorAll(".pr-store-feedback-star"));

    const reviewDetailModal = portalHost.querySelector("#pr-review-detail-modal");
    const reviewDetailClose = portalHost.querySelector("#pr-review-detail-close");
    const reviewDetailPrev = portalHost.querySelector("#pr-review-detail-prev");
    const reviewDetailNext = portalHost.querySelector("#pr-review-detail-next");
    const reviewDetailStage = portalHost.querySelector("#pr-review-detail-stage");
    const reviewDetailThumbs = portalHost.querySelector("#pr-review-detail-thumbs");
    const reviewDetailContent = portalHost.querySelector("#pr-review-detail-content");
    const reviewDetailContentPane = portalHost.querySelector(".pr-review-detail-content-pane");

    let allReviews = [];
    let serverTotalReviews = 0;
    let serverAverageRating = 0;
    let currentFilter = "all";
    let currentSort = "newest";
    let currentSearch = "";
    let visibleCount = DEFAULT_VISIBLE_COUNT;
    let selectedImages = [];
    let selectedVideoFile = null;
    let activeRating = 0;
    let currentStep = 1;
    let currentAnimating = false;
    let currentPage = 1;
    let hasMorePages = false;
    let isFetchingReviews = false;
    let isUploadingMedia = false;

    let reviewMediaEntries = [];
    let detailReview = null;
    let detailMediaList = [];
    let detailMediaIndex = 0;

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
        month: "2-digit",
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

    function getUploadJobId(reviewId) {
      return `${shop}__${reviewId}`;
    }

    function setUploadProgressUI({
      hidden = false,
      title = "Uploading media...",
      percent = 0,
      text = "Preparing upload...",
    } = {}) {
      if (!uploadStatusWrap) return;

      uploadStatusWrap.hidden = hidden;

      const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));

      if (uploadStatusTitle) uploadStatusTitle.textContent = title;
      if (uploadStatusPercent) uploadStatusPercent.textContent = `${safePercent}%`;
      if (uploadProgressFill) uploadProgressFill.style.width = `${safePercent}%`;
      if (uploadStatusText) uploadStatusText.textContent = text;
    }

    function openUploadProgressScreen() {
      if (!reviewModal) return;
      reviewModal.hidden = false;
      if (reviewModalFormShell) reviewModalFormShell.hidden = true;
      if (reviewModalSuccess) reviewModalSuccess.hidden = false;
      setBodyLock(true);
    }

    async function updateServerUploadStatus(reviewId, status, progress = 0, errorMessage = null) {
      try {
        await fetch(endpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            action: "updateMediaUploadStatus",
            reviewId,
            status,
            progress,
            errorMessage,
          }),
        });
      } catch (error) {
        console.error("Failed to sync upload status:", error);
      }
    }

    async function saveUploadJob(job) {
      const payload = {
        ...job,
        id: getUploadJobId(job.reviewId),
        shop,
        endpoint,
        reviewType,
        targetId,
        targetHandle,
        createdAt: job.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await idbPut(payload);
      return payload;
    }

    function getTotalUploadBytes(job) {
      const imageBytes = Array.isArray(job.imageFiles)
        ? job.imageFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0)
        : 0;

      const videoBytes = job.videoFile ? Number(job.videoFile.size || 0) : 0;
      return imageBytes + videoBytes;
    }

    function getCompletedUploadBytes(job) {
      let completed = 0;

      const uploadedImageCount = Array.isArray(job.uploadedImageUrls)
        ? job.uploadedImageUrls.length
        : 0;

      if (Array.isArray(job.imageFiles) && uploadedImageCount > 0) {
        for (let i = 0; i < uploadedImageCount; i += 1) {
          completed += Number(job.imageFiles[i]?.size || 0);
        }
      }

      if (job.uploadedVideoUrl && job.videoFile) {
        completed += Number(job.videoFile.size || 0);
      }

      return completed;
    }

    function uploadToCloudinaryWithProgress(file, resourceType, folder, onProgress) {
      return new Promise((resolve, reject) => {
        if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
          reject(new Error("Cloudinary is not configured."));
          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", cloudinaryUploadPreset);
        formData.append("folder", folder);

        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/${resourceType}/upload`
        );

        xhr.upload.onprogress = function (event) {
          if (event.lengthComputable && typeof onProgress === "function") {
            onProgress(event.loaded, event.total);
          }
        };

        xhr.onerror = function () {
          reject(new Error(`${resourceType} upload failed`));
        };

        xhr.onabort = function () {
          reject(new Error(`${resourceType} upload aborted`));
        };

        xhr.onload = function () {
          try {
            const result = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) {
              resolve(result.secure_url);
              return;
            }
            reject(new Error(result?.error?.message || `${resourceType} upload failed`));
          } catch {
            reject(new Error(`${resourceType} upload failed`));
          }
        };

        xhr.send(formData);
      });
    }

    async function attachUploadedMediaToReview(reviewId, reviewImages, reviewVideoUrl) {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "attachMedia",
          reviewId,
          reviewImages,
          reviewVideoUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to attach uploaded media");
      }

      return result;
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
        if (value) localStorage.setItem(getHelpfulStorageKey(reviewId), "1");
        else localStorage.removeItem(getHelpfulStorageKey(reviewId));
      } catch {}
    }

    function getErrorEl(fieldName) {
      return portalHost.querySelector(`[data-error-for="${fieldName}"]`);
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

    function getReviewMediaItems(review) {
      const items = [];
      const images = normalizeImages(review);

      images.forEach((img, imageIndex) => {
        items.push({
          type: "image",
          src: img,
          thumbSrc: getCloudinaryThumb(img, 220, 220),
          title: review.title || "",
          reviewId: String(review.id || ""),
          mediaKey: `${review.id || "review"}_image_${imageIndex}`,
        });
      });

      const reviewVideoUrl = safeText(review.reviewVideoUrl).trim();
      if (reviewVideoUrl) {
        items.push({
          type: "video",
          src: reviewVideoUrl,
          thumbSrc: reviewVideoUrl,
          title: review.title || "",
          reviewId: String(review.id || ""),
          mediaKey: `${review.id || "review"}_video_0`,
        });
      }

      const normalizedYoutube = normalizeYoutubeEmbedUrl(review.reviewYoutubeUrl);
      if (normalizedYoutube) {
        items.push({
          type: "youtube",
          src: normalizedYoutube,
          thumbSrc: getYoutubeThumbnailUrl(normalizedYoutube),
          title: review.title || "",
          reviewId: String(review.id || ""),
          mediaKey: `${review.id || "review"}_youtube_0`,
        });
      }

      return items;
    }

    function renderSummary(averageRating, totalReviews) {
      const avg = Number(averageRating) || 0;
      const total = Number(totalReviews) || 0;
      const label =
        avg >= 4.5 ? "Excellent" :
        avg >= 4 ? "Very Good" :
        avg >= 3 ? "Good" :
        avg >= 2 ? "Fair" : "Poor";

      return `
        <div class="pr-summary-box">
          <div class="pr-summary-top">
            <div class="pr-summary-rating">${avg.toFixed(1)}</div>
            <div class="pr-summary-stars">${renderStars(Math.round(avg))}</div>
            <div class="pr-summary-count">${total} review${total !== 1 ? "s" : ""}</div>
            <div class="pr-summary-label">${label}</div>
          </div>
        </div>
      `;
    }

    function renderLoadingState() {
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="pr-skeleton-summary">
            <div class="pr-skeleton-line lg"></div>
          </div>
        `;
      }

      if (listEl) {
        listEl.innerHTML = `
          <div class="pr-skeleton-card"></div>
          <div class="pr-skeleton-card"></div>
        `;
      }

      if (mediaStripTrack) {
        mediaStripTrack.innerHTML = `
          <div class="pr-media-tile pr-skeleton-card" style="width:86px;height:86px;min-width:86px;"></div>
          <div class="pr-media-tile pr-skeleton-card" style="width:86px;height:86px;min-width:86px;"></div>
          <div class="pr-media-tile pr-skeleton-card" style="width:86px;height:86px;min-width:86px;"></div>
        `;
      }

      if (mediaStripMeta) mediaStripMeta.textContent = "Loading...";
      if (loadMoreBtn) {
        loadMoreBtn.hidden = true;
        loadMoreBtn.disabled = true;
      }
      if (resultsMetaEl) resultsMetaEl.textContent = "";
    }

    function renderErrorState(message = "Failed to load reviews") {
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="pr-summary-box">
            <div class="pr-summary-top">
              <div class="pr-summary-rating">0.0</div>
              <div class="pr-summary-stars">☆☆☆☆☆</div>
              <div class="pr-summary-count">Reviews unavailable</div>
            </div>
          </div>
        `;
      }

      if (listEl) {
        listEl.innerHTML = `<div class="pr-error-box">${escapeHtml(message)}</div>`;
      }

      if (mediaStripTrack) mediaStripTrack.innerHTML = "";
      if (mediaStripMeta) mediaStripMeta.textContent = "Unable to load media";
      if (loadMoreBtn) {
        loadMoreBtn.hidden = true;
        loadMoreBtn.disabled = false;
      }
      if (resultsMetaEl) resultsMetaEl.textContent = "";
    }

    function renderEmptyState() {
      if (!listEl) return;

      let emptyText = "Be the first to share your experience.";
      if (reviewType === "collection") emptyText = "Be the first to share your experience with this collection.";
      else if (reviewType === "store") emptyText = "Be the first to share your experience with this store.";
      else emptyText = "Be the first to share your experience with this product.";

      listEl.innerHTML = `
        <div class="pr-empty">
          <div class="pr-empty-icon-wrap">
            <div class="pr-empty-icon">⭐</div>
            <div class="pr-empty-icon">💬</div>
          </div>
          <h4 class="pr-empty-title">No reviews yet</h4>
          <p>${emptyText}</p>
          <div class="pr-empty-action">
            <button type="button" class="pr-empty-btn" id="pr-empty-review-btn">Write a review</button>
          </div>
        </div>
      `;

      const emptyBtn = root.querySelector("#pr-empty-review-btn");
      emptyBtn?.addEventListener("click", openReviewModal);
    }

    function getFilteredSortedReviews() {
      let reviews = [...allReviews];

      if (currentFilter === "pinned") {
        reviews = reviews.filter((review) => Boolean(review.isPinned));
      } else if (currentFilter !== "all") {
        reviews = reviews.filter((review) => Number(review.rating) === Number(currentFilter));
      }

      if (currentSearch.trim()) {
        const keyword = currentSearch.trim().toLowerCase();
        reviews = reviews.filter((review) => {
          const name = safeText(review.customerName).toLowerCase();
          const title = safeText(review.title).toLowerCase();
          const message = safeText(review.message).toLowerCase();
          return name.includes(keyword) || title.includes(keyword) || message.includes(keyword);
        });
      }

      const pinnedFirst = (a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);

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

    function getReviewBadges(review, index) {
      const badges = [{ className: "pr-badge--verified", label: "Verified" }];

      if (Boolean(review.isPinned)) badges.unshift({ className: "pr-badge--pinned", label: "Pinned" });
      if (index === 0 && Number(review.rating) >= 4) badges.push({ className: "pr-badge--top", label: "Top review" });
      if (isRecentReview(review.createdAt)) badges.push({ className: "pr-badge--recent", label: "Recent" });

      return badges.slice(0, 3);
    }

    function renderMediaPreviewTile(item, reviewId, mediaIndex, extraClass = "") {
      const tileClass =
        item.type === "video"
          ? "pr-media-tile pr-media-tile--video"
          : item.type === "youtube"
          ? "pr-media-tile pr-media-tile--youtube"
          : "pr-media-tile";

      const className = `${tileClass}${extraClass ? ` ${extraClass}` : ""}`.trim();

      if (item.type === "image") {
        return `
          <button
            type="button"
            class="${className}"
            data-detail-review-id="${escapeHtml(reviewId)}"
            data-detail-media-index="${mediaIndex}"
            aria-label="Open review media"
          >
            <img src="${escapeHtml(item.thumbSrc || item.src)}" alt="Review media" loading="lazy">
          </button>
        `;
      }

      if (item.type === "youtube") {
        return `
          <button
            type="button"
            class="${className}"
            data-detail-review-id="${escapeHtml(reviewId)}"
            data-detail-media-index="${mediaIndex}"
            aria-label="Open review media"
          >
            <img src="${escapeHtml(item.thumbSrc)}" alt="Review video thumbnail" loading="lazy">
          </button>
        `;
      }

      return `
        <button
          type="button"
          class="${className}"
          data-detail-review-id="${escapeHtml(reviewId)}"
          data-detail-media-index="${mediaIndex}"
          aria-label="Open review media"
        >
          <video src="${escapeHtml(item.src)}" muted playsinline preload="metadata"></video>
        </button>
      `;
    }

    function renderReviewCard(review, index) {
      const customerName = escapeHtml(review.customerName || "Anonymous");
      const title = escapeHtml(review.title || "");
      const message = escapeHtml(review.message || "");
      const rating = Number(review.rating) || 0;
      const createdAt = formatRelativeDate(review.createdAt);
      const avatarInitial = escapeHtml(getInitial(review.customerName || "A"));
      const reviewId = String(review.id || index);
      const helpfulCount = Number(review.helpfulCount || 0);
      const isHelpfulMarked = review.id ? hasMarkedHelpful(review.id) : false;
      const prosTags = extractProsTags(review);
      const badges = getReviewBadges(review, index);
      const mediaItems = getReviewMediaItems(review);

      const badgesHtml = badges
        .map((badge) => `<span class="pr-badge ${badge.className}">${escapeHtml(badge.label)}</span>`)
        .join("");

      const tagsHtml = prosTags.length
        ? `<div class="pr-tag-list">${prosTags.map((tag) => `<span class="pr-tag">${escapeHtml(tag)}</span>`).join("")}</div>`
        : "";

      const mediaGalleryHtml = mediaItems.length
        ? `<div class="pr-review-gallery">
            ${mediaItems.map((item, mediaIndex) => renderMediaPreviewTile(item, reviewId, mediaIndex, "pr-review-gallery-item")).join("")}
           </div>`
        : "";

      const needsClamp = safeText(review.message).length > 180;
      const messageId = `pr-message-${index}-${safeText(review.id || "item")}`;

      return `
        <div class="pr-item">
          <div class="pr-item-top">
            <div class="pr-user-meta">
              <div class="pr-avatar">${avatarInitial}</div>

              <div class="pr-user-block">
                <div class="pr-user-line">
                  <div class="pr-user-name">${customerName}</div>
                  <div class="pr-badge-list">${badgesHtml}</div>
                </div>
              </div>
            </div>

            <div class="pr-item-side">
              <div class="pr-item-stars">${renderStars(rating)}</div>
              <div class="pr-date-chip">${escapeHtml(createdAt)}</div>
            </div>
          </div>

          ${title ? `<div class="pr-item-title">${title}</div>` : ""}
          ${tagsHtml}
          ${message ? `<div id="${messageId}" class="pr-item-message ${needsClamp ? "is-clamped" : ""}">${message}</div>` : ""}
          ${needsClamp ? `<button type="button" class="pr-read-more-btn" data-target="${messageId}" data-expanded="false">More</button>` : ""}
          ${mediaGalleryHtml}

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

    function isClientFilteredView() {
      return currentFilter !== "all" || currentSearch.trim() !== "" || currentSort !== "newest";
    }

    function updateResultsMeta(totalMatched, totalVisible) {
      if (!resultsMetaEl) return;

      if (!totalMatched) {
        resultsMetaEl.textContent = "No reviews found";
        return;
      }

      if (isClientFilteredView() && hasMorePages) {
        resultsMetaEl.textContent = `Showing ${totalVisible} loaded reviews`;
        return;
      }

      const referenceTotal = Number(serverTotalReviews || totalMatched || 0);
      resultsMetaEl.textContent = `Showing ${totalVisible} of ${referenceTotal} reviews`;
    }

    function updateLoadMoreButton(totalMatched, totalVisible) {
      if (!loadMoreBtn) return;

      if (isFetchingReviews) {
        loadMoreBtn.hidden = false;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";
        return;
      }

      if (totalVisible < totalMatched) {
        const remainingLocal = totalMatched - totalVisible;
        const nextCount = Math.min(LOAD_MORE_STEP, remainingLocal);
        loadMoreBtn.hidden = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = `Load ${nextCount} more review${nextCount > 1 ? "s" : ""}`;
        return;
      }

      if (hasMorePages) {
        loadMoreBtn.hidden = false;
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = "Load more reviews";
        return;
      }

      loadMoreBtn.hidden = true;
      loadMoreBtn.disabled = false;
    }

    function renderVisibleReviews() {
      if (!listEl) return;

      const filteredSorted = getFilteredSortedReviews();
      const totalVisible = Math.min(visibleCount, filteredSorted.length);
      const reviewsToRender = filteredSorted.slice(0, totalVisible);

      updateResultsMeta(filteredSorted.length, totalVisible);

      if (!allReviews.length && !serverTotalReviews) {
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
            <p>Try changing the filter, search, or sort option.</p>
          </div>
        `;
        if (loadMoreBtn) loadMoreBtn.hidden = !hasMorePages;
        updateLoadMoreButton(filteredSorted.length, totalVisible);
        return;
      }

      listEl.innerHTML = reviewsToRender.map((review, index) => renderReviewCard(review, index)).join("");
      updateLoadMoreButton(filteredSorted.length, totalVisible);
      bindReviewInteractions();
    }

    function renderMediaStrip() {
      if (!mediaStripTrack || !mediaStripMeta) return;

      reviewMediaEntries = [];

      allReviews.forEach((review) => {
        const reviewId = String(review.id || "");
        const mediaItems = getReviewMediaItems(review);

        mediaItems.forEach((item, mediaIndex) => {
          reviewMediaEntries.push({ reviewId, mediaIndex, item });
        });
      });

      const totalReviews = Number(serverTotalReviews || allReviews.length || 0);
      const averageRating = Number(serverAverageRating || 0);

      mediaStripMeta.textContent = reviewMediaEntries.length
        ? `${renderStars(Math.round(averageRating || 0))} ${(averageRating || 0).toFixed(1)} • ${totalReviews} review${totalReviews !== 1 ? "s" : ""}`
        : "No photo or video reviews yet";

      if (!reviewMediaEntries.length) {
        mediaStripTrack.innerHTML = "";
        return;
      }

      mediaStripTrack.innerHTML = reviewMediaEntries
        .map(({ reviewId, mediaIndex, item }) => renderMediaPreviewTile(item, reviewId, mediaIndex))
        .join("");
    }

    function renderReviewsState() {
      if (summaryEl) {
        summaryEl.innerHTML = renderSummary(serverAverageRating, serverTotalReviews);
      }
      renderMediaStrip();
      renderVisibleReviews();
    }

    function setActiveFilter(nextFilter) {
      currentFilter = nextFilter;
      visibleCount = DEFAULT_VISIBLE_COUNT;
      filterChips.forEach((chip) => chip.classList.toggle("is-active", chip.dataset.rating === nextFilter));
      renderVisibleReviews();
    }

    function setActiveSort(nextSort) {
      currentSort = nextSort;
      visibleCount = DEFAULT_VISIBLE_COUNT;
      sortButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.sort === nextSort));
      renderVisibleReviews();
    }

    function updateRatingPreview() {
      const numericValue = Number(ratingInput?.value || 0);
      if (ratingPreviewStars) ratingPreviewStars.textContent = renderStars(numericValue);
      if (ratingPreviewLabel) {
        ratingPreviewLabel.textContent = numericValue
          ? `${RATING_LABELS[numericValue]} • ${numericValue}/5`
          : "No rating selected";
      }
    }

    function updateStarUI(value) {
      const numericValue = Number(value) || 0;
      activeRating = numericValue;

      if (ratingInput) ratingInput.value = numericValue ? String(numericValue) : "";
      if (ratingLiveText) ratingLiveText.textContent = numericValue ? RATING_LABELS[numericValue] : "Select rating";

      starButtons.forEach((btn) => {
        const starValue = Number(btn.dataset.value);
        btn.classList.toggle("is-selected", starValue <= numericValue);
      });

      clearFieldError("rating");
      updateRatingPreview();
    }

    function bindStarSelector() {
      starButtons.forEach((btn) => {
        btn.addEventListener("mouseenter", () => {
          const hoverValue = Number(btn.dataset.value);
          starButtons.forEach((starBtn) => {
            starBtn.classList.toggle("is-active", Number(starBtn.dataset.value) <= hoverValue);
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

      const selector = portalHost.querySelector(".pr-star-selector");
      selector?.addEventListener("mouseleave", () => {
        starButtons.forEach((starBtn) => starBtn.classList.remove("is-active"));
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
            <button type="button" class="pr-image-preview-remove" data-remove-index="${index}" aria-label="Remove image">×</button>
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
        setFieldError("reviewImages", "Only JPG and PNG images are allowed.", uploadDropzone);
        uploadDropzone?.classList.add("pr-invalid");
        showToast("Only JPG and PNG images are allowed.", "error");
        return;
      }

      const oversizedImage = validFiles.find(
        (file) => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024
      );

      if (oversizedImage) {
        setFieldError(
          "reviewImages",
          `Each image should be ${MAX_IMAGE_SIZE_MB}MB or less.`,
          uploadDropzone
        );
        uploadDropzone?.classList.add("pr-invalid");
        showToast(`Each image should be ${MAX_IMAGE_SIZE_MB}MB or less.`, "error");
        return;
      }

      const existingMap = new Map(selectedImages.map((file) => [getFileUniqueKey(file), file]));

      validFiles.forEach((file) => {
        const key = getFileUniqueKey(file);
        if (!existingMap.has(key)) existingMap.set(key, file);
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

      if (imageInput) imageInput.value = "";
    }

    function handleSelectedVideo(file) {
      if (!file) return;

      const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
      const maxVideoSize = MAX_VIDEO_SIZE_MB * 1024 * 1024;

      if (!allowedTypes.includes(file.type)) {
        setFieldError("reviewVideo", "Only MP4, WEBM, and MOV videos are allowed.", videoDropzone);
        videoDropzone?.classList.add("pr-invalid");
        showToast("Only MP4, WEBM, and MOV videos are allowed.", "error");
        return;
      }

      if (file.size > maxVideoSize) {
        setFieldError("reviewVideo", `Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`, videoDropzone);
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
      imageInput?.addEventListener("change", (e) => handleSelectedFiles(e.target.files));

      uploadDropzone?.addEventListener("click", () => imageInput?.click());
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
        if (files?.length) handleSelectedFiles(files);
      });
    }

    function bindVideoUploader() {
      videoInput?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) handleSelectedVideo(file);
      });

      videoDropzone?.addEventListener("click", () => videoInput?.click());
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
        if (file) handleSelectedVideo(file);
      });
    }

    function loadImageElement(blobUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = blobUrl;
      });
    }

    async function compressImage(file, maxWidth = 1600, quality = 0.8) {
      let imageSource;
      let objectUrl = null;

      try {
        if ("createImageBitmap" in window) {
          imageSource = await createImageBitmap(file);
        } else {
          objectUrl = URL.createObjectURL(file);
          imageSource = await loadImageElement(objectUrl);
        }

        let width = imageSource.width;
        let height = imageSource.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported");
        ctx.drawImage(imageSource, 0, 0, width, height);

        return await new Promise((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image."));
                return;
              }

              resolve(
                new File(
                  [blob],
                  file.name.replace(/\.(png|jpg|jpeg)$/i, ".jpg"),
                  { type: "image/jpeg" }
                )
              );
            },
            "image/jpeg",
            quality
          );
        });
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    }

    async function runUploadJob(job) {
      if (!job?.reviewId) return;
      if (ACTIVE_UPLOAD_JOBS.has(job.id)) return;

      ACTIVE_UPLOAD_JOBS.add(job.id);
      isUploadingMedia = true;

      try {
        job.status = "uploading";
        await saveUploadJob(job);
        await updateServerUploadStatus(job.reviewId, "uploading", job.progress || 0, null);

        const totalBytes = Math.max(1, getTotalUploadBytes(job));
        let completedBytes = getCompletedUploadBytes(job);

        const imageFiles = Array.isArray(job.imageFiles) ? job.imageFiles : [];
        const uploadedImageUrls = Array.isArray(job.uploadedImageUrls) ? job.uploadedImageUrls : [];
        job.uploadedImageUrls = uploadedImageUrls;

        for (let i = uploadedImageUrls.length; i < imageFiles.length; i += 1) {
          const originalFile = imageFiles[i];
          const compressedFile = await compressImage(originalFile);

          const uploadedUrl = await uploadToCloudinaryWithProgress(
            compressedFile,
            "image",
            `shopify-review-images/${shop}/${reviewType}/${targetId || targetHandle || "store"}`,
            (loaded, total) => {
              const currentLoaded = total ? Math.min(loaded, total) : loaded;
              const percent = Math.round(((completedBytes + currentLoaded) / totalBytes) * 100);

              setUploadProgressUI({
                hidden: false,
                title: "Uploading media...",
                percent,
                text: `Uploading photo ${i + 1} of ${imageFiles.length}${job.videoFile ? " + 1 video" : ""}`,
              });
            }
          );

          job.uploadedImageUrls.push(uploadedUrl);
          completedBytes += Number(originalFile.size || 0);
          job.progress = Math.round((completedBytes / totalBytes) * 100);

          await saveUploadJob(job);
          await updateServerUploadStatus(job.reviewId, "uploading", job.progress, null);
        }

        if (job.videoFile && !job.uploadedVideoUrl) {
          const videoFileLocal = job.videoFile;

          const uploadedVideoUrl = await uploadToCloudinaryWithProgress(
            videoFileLocal,
            "video",
            `shopify-review-videos/${shop}/${reviewType}/${targetId || targetHandle || "store"}`,
            (loaded, total) => {
              const currentLoaded = total ? Math.min(loaded, total) : loaded;
              const percent = Math.round(((completedBytes + currentLoaded) / totalBytes) * 100);

              setUploadProgressUI({
                hidden: false,
                title: "Uploading media...",
                percent,
                text: "Uploading video",
              });
            }
          );

          job.uploadedVideoUrl = uploadedVideoUrl;
          completedBytes += Number(videoFileLocal.size || 0);
          job.progress = Math.round((completedBytes / totalBytes) * 100);

          await saveUploadJob(job);
          await updateServerUploadStatus(job.reviewId, "uploading", job.progress, null);
        }

        setUploadProgressUI({
          hidden: false,
          title: "Finalizing upload...",
          percent: 100,
          text: "Attaching media to the review",
        });

        await attachUploadedMediaToReview(
          job.reviewId,
          job.uploadedImageUrls || [],
          job.uploadedVideoUrl || null
        );

        await updateServerUploadStatus(job.reviewId, "completed", 100, null);
        await idbDelete(job.id);

        setUploadProgressUI({
          hidden: false,
          title: "Upload complete",
          percent: 100,
          text: "Photos and video attached successfully",
        });

        showToast("Media uploaded successfully.", "success");
        await loadReviews({ page: 1, append: false });

        setTimeout(() => {
          setUploadProgressUI({ hidden: true });
        }, 1600);
      } catch (error) {
        const errorMessage = error?.message || "Media upload failed";

        job.status = "failed";
        job.errorMessage = errorMessage;
        job.progress = Math.max(0, Math.min(100, Number(job.progress || 0)));

        await saveUploadJob(job);
        await updateServerUploadStatus(
          job.reviewId,
          "failed",
          Number(job.progress || 0),
          errorMessage
        );

        setUploadProgressUI({
          hidden: false,
          title: "Upload failed",
          percent: Number(job.progress || 0),
          text: `${errorMessage}. Page reopen/refresh par retry ho jayega.`,
        });

        showToast(errorMessage, "error");
      } finally {
        ACTIVE_UPLOAD_JOBS.delete(job.id);
        isUploadingMedia = ACTIVE_UPLOAD_JOBS.size > 0;
      }
    }

    async function resumePendingUploads() {
      try {
        const jobs = await idbGetAll();
        const scopedJobs = jobs.filter(
          (job) => job.shop === shop && job.endpoint === endpoint
        );

        if (scopedJobs.length) {
          openUploadProgressScreen();
          setUploadProgressUI({
            hidden: false,
            title: "Resuming upload...",
            percent: 0,
            text: "Pending media upload found. Resuming now...",
          });
          showToast("Pending media upload resumed.", "success");
        }

        for (const job of scopedJobs) {
          if (!job?.reviewId) continue;
          await runUploadJob(job);
        }
      } catch (error) {
        console.error("Failed to resume uploads:", error);
      }
    }

    function validateCommonTargets(showErrors = true) {
      let isValid = true;

      if (reviewType === "product" && !targetId && !productId) {
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

    function validateStep(step, showErrors = true) {
      if (!form) return false;

      const formData = new FormData(form);
      const rating = Number(ratingInput?.value || 0);
      const title = formData.get("title")?.toString().trim() || "";
      const message = formData.get("message")?.toString().trim() || "";
      const customerName = formData.get("customerName")?.toString().trim() || "";
      const customerEmail = formData.get("customerEmail")?.toString().trim() || "";
      const youtubeUrl = formData.get("reviewYoutubeUrl")?.toString().trim() || "";

      let isValid = validateCommonTargets(showErrors);

      if (step === 1) {
        if (!rating) {
          isValid = false;
          if (showErrors) setFieldError("rating", "Please select a rating.");
        } else {
          clearFieldError("rating");
        }
      }

      if (step === 2) {
        if (title.length > 80) {
          isValid = false;
          if (showErrors) setFieldError("title", "Title should be 80 characters or less.", titleInput);
        } else {
          clearFieldError("title", titleInput);
        }

        if (!message) {
          isValid = false;
          if (showErrors) setFieldError("message", "Review content is required.", messageInput);
        } else if (message.length < 20) {
          isValid = false;
          if (showErrors) {
            setFieldError("message", "Please write at least 20 characters for a better review.", messageInput);
          }
        } else {
          clearFieldError("message", messageInput);
        }
      }

      if (step === 3) {
        if (!customerName && !anonymousInput?.checked) {
          isValid = false;
          if (showErrors) setFieldError("customerName", "Display name is required.", nameInput);
        } else {
          clearFieldError("customerName", nameInput);
        }

        if (customerEmail) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(customerEmail)) {
            isValid = false;
            if (showErrors) setFieldError("customerEmail", "Please enter a valid email.", emailInput);
          } else {
            clearFieldError("customerEmail", emailInput);
          }
        } else {
          clearFieldError("customerEmail", emailInput);
        }
      }

      if (step === 4) {
        if (selectedImages.length > MAX_REVIEW_IMAGES) {
          isValid = false;
          if (showErrors) {
            setFieldError("reviewImages", `You can upload up to ${MAX_REVIEW_IMAGES} images only.`, uploadDropzone);
          }
        } else {
          clearFieldError("reviewImages", uploadDropzone);
        }

        const hasOversizedImage = selectedImages.some(
          (file) => file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024
        );

        if (hasOversizedImage) {
          isValid = false;
          if (showErrors) {
            setFieldError("reviewImages", `Each image should be ${MAX_IMAGE_SIZE_MB}MB or less.`, uploadDropzone);
          }
        }

        if (selectedVideoFile && selectedVideoFile.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
          isValid = false;
          if (showErrors) {
            setFieldError("reviewVideo", `Video size should be ${MAX_VIDEO_SIZE_MB}MB or less.`, videoDropzone);
          }
        } else {
          clearFieldError("reviewVideo", videoDropzone);
        }

        if (youtubeUrl) {
          const normalizedYoutube = normalizeYoutubeEmbedUrl(youtubeUrl);
          if (!normalizedYoutube) {
            isValid = false;
            if (showErrors) {
              setFieldError("reviewYoutubeUrl", "Please enter a valid YouTube link.", youtubeInput);
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

    function updateStepDots() {
      stepDots.forEach((dot) => {
        const dotStep = Number(dot.getAttribute("data-step-dot"));
        dot.classList.toggle("is-active", dotStep === currentStep);
      });
    }

    function updateProgress() {
      if (progressFill) progressFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
    }

    function updateModalFooter() {
      if (backBtn) backBtn.hidden = currentStep === 1;
      if (nextBtn) nextBtn.hidden = currentStep === TOTAL_STEPS;
      if (submitBtn) submitBtn.hidden = currentStep !== TOTAL_STEPS;
    }

    function getStepEl(stepNumber) {
      return steps.find((step) => Number(step.dataset.step) === Number(stepNumber)) || null;
    }

    function syncStepUI() {
      updateStepDots();
      updateProgress();
      updateModalFooter();
    }

    function setBodyLock(locked) {
      document.body.style.overflow = locked ? "hidden" : "";
    }

    function goToStep(nextStep, direction = "forward", immediate = false) {
      if (currentAnimating && !immediate) return;
      if (nextStep < 1 || nextStep > TOTAL_STEPS) return;

      const currentEl = getStepEl(currentStep);
      const nextEl = getStepEl(nextStep);

      if (!nextEl) return;
      if (currentStep === nextStep && !immediate) return;

      currentStep = nextStep;
      syncStepUI();

      if (immediate || !currentEl || currentEl === nextEl) {
        steps.forEach((step) => {
          const isTarget = step === nextEl;
          step.classList.toggle("is-active", isTarget);
          step.classList.remove("is-leaving-left", "is-leaving-right");
          step.setAttribute("aria-hidden", isTarget ? "false" : "true");
        });
        return;
      }

      currentAnimating = true;
      const leaveClass = direction === "forward" ? "is-leaving-left" : "is-leaving-right";
      currentEl.classList.add(leaveClass);

      setTimeout(() => {
        currentEl.classList.remove("is-active", "is-leaving-left", "is-leaving-right");
        currentEl.setAttribute("aria-hidden", "true");

        nextEl.classList.add("is-active");
        nextEl.setAttribute("aria-hidden", "false");

        setTimeout(() => {
          currentAnimating = false;
        }, 340);
      }, 180);
    }

    function resetStepFlow() {
      currentStep = 1;
      steps.forEach((step) => {
        const isFirst = Number(step.dataset.step) === 1;
        step.classList.toggle("is-active", isFirst);
        step.classList.remove("is-leaving-left", "is-leaving-right");
        step.setAttribute("aria-hidden", isFirst ? "false" : "true");
      });
      syncStepUI();
    }

    function openReviewModal() {
      if (!reviewModal) return;

      if (messageEl) {
        messageEl.className = "pr-message-box";
        messageEl.textContent = "";
      }

      reviewModal.hidden = false;
      reviewModalFormShell.hidden = false;
      reviewModalSuccess.hidden = true;
      setBodyLock(true);
      resetStepFlow();
    }

    function closeReviewModal() {
      if (!reviewModal) return;
      reviewModal.hidden = true;
      setBodyLock(false);

      if (reviewModal.dataset.resetOnClose === "true") {
        delete reviewModal.dataset.resetOnClose;
        resetFormState();
      }
    }

    function showSuccessScreen() {
      if (!reviewModalFormShell || !reviewModalSuccess) return;
      reviewModalFormShell.hidden = true;
      reviewModalSuccess.hidden = false;
      reviewModal.dataset.resetOnClose = "true";
    }

    function resetFormState() {
      if (!form) return;

      form.reset();
      selectedImages = [];
      selectedVideoFile = null;
      activeRating = 0;

      updateFileInputFromSelectedImages();
      renderImagePreview([]);
      renderVideoPreview(null);

      if (videoInput) videoInput.value = "";
      if (youtubeInput) youtubeInput.value = "";

      updateStarUI(0);

      if (titleCount) titleCount.textContent = "0 / 80";
      if (messageCount) messageCount.textContent = "0 / 1000";

      clearFieldError("customerName", nameInput);
      clearFieldError("customerEmail", emailInput);
      clearFieldError("title", titleInput);
      clearFieldError("message", messageInput);
      clearFieldError("rating");
      clearFieldError("reviewImages", uploadDropzone);
      clearFieldError("reviewVideo", videoDropzone);
      clearFieldError("reviewYoutubeUrl", youtubeInput);

      uploadDropzone?.classList.remove("pr-invalid");
      videoDropzone?.classList.remove("pr-invalid");

      reviewModalFormShell.hidden = false;
      reviewModalSuccess.hidden = true;
      setUploadProgressUI({ hidden: true });
      resetStepFlow();
      updateRatingPreview();
    }

    function bindReviewModal() {
      openReviewModalBtn?.addEventListener("click", openReviewModal);

      reviewModalClose?.addEventListener("click", closeReviewModal);
      reviewModalSuccessClose?.addEventListener("click", closeReviewModal);

      reviewModal?.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-review-modal='true']")) closeReviewModal();
      });

      backBtn?.addEventListener("click", () => {
        goToStep(currentStep - 1, "backward");
      });

      nextBtn?.addEventListener("click", () => {
        const isStepValid = validateStep(currentStep, true);
        if (!isStepValid) {
          showToast("Please complete this step first.", "error");
          return;
        }
        goToStep(currentStep + 1, "forward");
      });

      stepDots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const targetStep = Number(dot.getAttribute("data-step-dot"));
          if (!targetStep || targetStep === currentStep) return;

          const movingForward = targetStep > currentStep;
          if (movingForward) {
            for (let step = 1; step < targetStep; step += 1) {
              if (!validateStep(step, true)) {
                showToast("Please complete previous steps first.", "error");
                return;
              }
            }
          }

          goToStep(targetStep, movingForward ? "forward" : "backward");
        });
      });
    }

    function openToolbarPanel() {
      if (!toolbarPanel) return;
      toolbarPanel.hidden = false;
      toggleFilterPanelBtn?.setAttribute("aria-expanded", "true");
      toggleSortPanelBtn?.setAttribute("aria-expanded", "true");
    }

    function closeToolbarPanel() {
      if (!toolbarPanel) return;
      toolbarPanel.hidden = true;
      toggleFilterPanelBtn?.setAttribute("aria-expanded", "false");
      toggleSortPanelBtn?.setAttribute("aria-expanded", "false");
    }

    function toggleToolbarPanel() {
      if (!toolbarPanel) return;
      if (toolbarPanel.hidden) openToolbarPanel();
      else closeToolbarPanel();
    }

    function bindToolbarPanel() {
      toggleFilterPanelBtn?.addEventListener("click", toggleToolbarPanel);
      toggleSortPanelBtn?.addEventListener("click", toggleToolbarPanel);

      document.addEventListener("click", (e) => {
        if (!toolbarPanel || toolbarPanel.hidden) return;
        const clickedInsidePanel = toolbarPanel.contains(e.target);
        const clickedToggle =
          toggleFilterPanelBtn?.contains(e.target) || toggleSortPanelBtn?.contains(e.target);

        if (!clickedInsidePanel && !clickedToggle) closeToolbarPanel();
      });
    }

    function updateDetailContent() {
      if (!reviewDetailContent || !detailReview) return;

      const customerName = escapeHtml(detailReview.customerName || "Anonymous");
      const avatarInitial = escapeHtml(getInitial(detailReview.customerName || "A"));
      const title = escapeHtml(detailReview.title || "");
      const message = escapeHtml(detailReview.message || "");
      const rating = Number(detailReview.rating) || 0;
      const helpfulCount = Number(detailReview.helpfulCount || 0);
      const createdAt = formatDate(detailReview.createdAt);
      const tags = extractProsTags(detailReview);

      reviewDetailContent.innerHTML = `
        <div class="pr-review-detail-stars">${renderStars(rating)}</div>

        <div class="pr-review-detail-author-row">
          <div class="pr-review-detail-avatar">${avatarInitial}</div>

          <div class="pr-review-detail-author-meta">
            <div class="pr-review-detail-name">${customerName}</div>
            <div class="pr-review-detail-date">${escapeHtml(createdAt)}</div>
          </div>
        </div>

        ${title ? `<h3 class="pr-review-detail-title">${title}</h3>` : ""}
        <div class="pr-review-detail-message">${message || ""}</div>

        ${
          tags.length
            ? `<div class="pr-review-detail-tags">
                ${tags.map((tag) => `<span class="pr-review-detail-tag">${escapeHtml(tag)}</span>`).join("")}
              </div>`
            : ""
        }

        <div class="pr-review-detail-helpful">${helpfulCount} people found this helpful</div>
      `;
    }

    function getDetailStageMarkup(item) {
      if (!item) return "";

      if (item.type === "image") {
        const imageSrc = getCloudinaryContain(item.src, 1800, 1800) || item.src;
        return `<img src="${escapeHtml(imageSrc)}" alt="Review media">`;
      }

      if (item.type === "video") {
        return `
          <video
            src="${escapeHtml(item.src)}"
            controls
            playsinline
            preload="metadata"
          ></video>
        `;
      }

      const autoplaySrc = item.src.includes("?")
        ? `${item.src}&autoplay=1&rel=0`
        : `${item.src}?autoplay=1&rel=0`;

      return `
        <iframe
          src="${escapeHtml(autoplaySrc)}"
          title="Review video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
        ></iframe>
      `;
    }

    function renderDetailStage() {
      if (!reviewDetailStage || !detailMediaList.length) return;

      const item = detailMediaList[detailMediaIndex];
      if (!item) return;

      reviewDetailStage.innerHTML = getDetailStageMarkup(item);
    }

    function scrollActiveThumbIntoView() {
      if (!reviewDetailThumbs) return;
      const activeThumb = reviewDetailThumbs.querySelector(".pr-review-detail-thumb.is-active");
      if (!activeThumb || typeof activeThumb.scrollIntoView !== "function") return;

      activeThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }

    function renderDetailThumbs() {
      if (!reviewDetailThumbs) return;

      reviewDetailThumbs.innerHTML = detailMediaList
        .map((item, index) => {
          const isActive = index === detailMediaIndex ? "is-active" : "";
          const thumbInner =
            item.type === "image"
              ? `<img src="${escapeHtml(getCloudinaryThumb(item.src, 120, 120))}" alt="Review media thumbnail">`
              : item.type === "youtube"
              ? `<img src="${escapeHtml(item.thumbSrc)}" alt="Review video thumbnail">`
              : `<video src="${escapeHtml(item.src)}" muted playsinline preload="metadata"></video>`;

          return `
            <button
              type="button"
              class="pr-review-detail-thumb ${isActive}"
              data-detail-thumb-index="${index}"
              aria-label="Open media ${index + 1}"
            >
              ${thumbInner}
            </button>
          `;
        })
        .join("");

      Array.from(reviewDetailThumbs.querySelectorAll("[data-detail-thumb-index]")).forEach((btn) => {
        btn.addEventListener("click", () => {
          detailMediaIndex = Number(btn.getAttribute("data-detail-thumb-index")) || 0;
          renderDetailStage();
          renderDetailThumbs();
        });
      });

      requestAnimationFrame(scrollActiveThumbIntoView);
    }

    function renderDetailModal() {
      renderDetailStage();
      renderDetailThumbs();
      updateDetailContent();
    }

    function openReviewDetailById(reviewId, mediaIndex = 0) {
      const matchedReview = allReviews.find((review) => String(review.id) === String(reviewId));
      if (!matchedReview || !reviewDetailModal) return;

      const mediaItems = getReviewMediaItems(matchedReview);
      if (!mediaItems.length) return;

      detailReview = matchedReview;
      detailMediaList = mediaItems;
      detailMediaIndex = Math.max(0, Math.min(Number(mediaIndex) || 0, mediaItems.length - 1));

      renderDetailModal();

      if (reviewDetailContentPane) {
        reviewDetailContentPane.scrollTop = 0;
      }

      reviewDetailModal.hidden = false;
      setBodyLock(true);
    }

    function closeReviewDetailModal() {
      if (!reviewDetailModal) return;

      const mediaEls = reviewDetailStage
        ? Array.from(reviewDetailStage.querySelectorAll("video, iframe"))
        : [];

      mediaEls.forEach((el) => {
        if (el.tagName === "VIDEO" && typeof el.pause === "function") {
          try {
            el.pause();
          } catch {}
        }
      });

      if (reviewDetailStage) reviewDetailStage.innerHTML = "";
      reviewDetailModal.hidden = true;

      if (reviewModal?.hidden !== false) setBodyLock(false);
    }

    function showPrevDetailMedia() {
      if (!detailMediaList.length) return;
      detailMediaIndex = (detailMediaIndex - 1 + detailMediaList.length) % detailMediaList.length;
      renderDetailModal();
    }

    function showNextDetailMedia() {
      if (!detailMediaList.length) return;
      detailMediaIndex = (detailMediaIndex + 1) % detailMediaList.length;
      renderDetailModal();
    }

    function bindDetailModal() {
      reviewDetailClose?.addEventListener("click", closeReviewDetailModal);
      reviewDetailPrev?.addEventListener("click", showPrevDetailMedia);
      reviewDetailNext?.addEventListener("click", showNextDetailMedia);

      reviewDetailModal?.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-review-detail='true']")) closeReviewDetailModal();
      });
    }

    function bindReviewInteractions() {
      Array.from(root.querySelectorAll(".pr-read-more-btn")).forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = btn.getAttribute("data-target");
          if (!targetId) return;

          const target = root.querySelector(`#${CSS.escape(targetId)}`);
          if (!target) return;

          const expanded = btn.getAttribute("data-expanded") === "true";

          if (expanded) {
            target.classList.add("is-clamped");
            btn.textContent = "More";
            btn.setAttribute("data-expanded", "false");
          } else {
            target.classList.remove("is-clamped");
            btn.textContent = "Less";
            btn.setAttribute("data-expanded", "true");
          }
        });
      });

      Array.from(root.querySelectorAll(".pr-helpful-btn")).forEach((btn) => {
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

            if (textEl) textEl.textContent = `${nextCount} people found this helpful`;

            setMarkedHelpful(id, nextMarked);

            const reviewIndex = allReviews.findIndex((review) => String(review.id) === String(id));
            if (reviewIndex !== -1) {
              allReviews[reviewIndex].helpfulCount = nextCount;

              if (detailReview && String(detailReview.id) === String(id)) {
                detailReview.helpfulCount = nextCount;
                updateDetailContent();
              }
            }
          } catch {
            showToast("Failed to update helpful count", "error");
          } finally {
            btn.disabled = false;
          }
        });
      });

      Array.from(root.querySelectorAll("[data-detail-review-id]")).forEach((trigger) => {
        trigger.addEventListener("click", () => {
          const reviewId = trigger.getAttribute("data-detail-review-id") || "";
          const mediaIndex = Number(trigger.getAttribute("data-detail-media-index") || 0);
          openReviewDetailById(reviewId, mediaIndex);
        });
      });
    }

    function bindMediaStripNav() {
      mediaStripPrev?.addEventListener("click", () => {
        mediaStripTrack?.scrollBy({ left: -320, behavior: "smooth" });
      });

      mediaStripNext?.addEventListener("click", () => {
        mediaStripTrack?.scrollBy({ left: 320, behavior: "smooth" });
      });
    }

    function bindRealtimeValidation() {
      nameInput?.addEventListener("input", () => {
        if (nameInput.value.trim()) clearFieldError("customerName", nameInput);
      });

      emailInput?.addEventListener("input", () => {
        const email = emailInput.value.trim();
        if (!email) {
          clearFieldError("customerEmail", emailInput);
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(email)) clearFieldError("customerEmail", emailInput);
      });

      anonymousInput?.addEventListener("change", () => {
        if (anonymousInput.checked) clearFieldError("customerName", nameInput);
      });

      titleInput?.addEventListener("input", () => {
        const count = titleInput.value.length;
        if (titleCount) titleCount.textContent = `${count} / 80`;
        if (count <= 80) clearFieldError("title", titleInput);
      });

      messageInput?.addEventListener("input", () => {
        const count = messageInput.value.length;
        if (messageCount) messageCount.textContent = `${count} / 1000`;
        if (count >= 20) clearFieldError("message", messageInput);
      });

      youtubeInput?.addEventListener("input", () => {
        const value = youtubeInput.value.trim();
        if (!value) {
          clearFieldError("reviewYoutubeUrl", youtubeInput);
          return;
        }
        if (normalizeYoutubeEmbedUrl(value)) clearFieldError("reviewYoutubeUrl", youtubeInput);
      });
    }

    function buildReviewsUrl(page = 1, limit = PAGE_SIZE) {
      const params = new URLSearchParams();
      params.set("shop", shop);
      params.set("approvedOnly", "true");
      params.set("reviewType", reviewType);
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (reviewType === "product") {
        params.set("targetId", targetId || productId);
      } else if (reviewType === "collection") {
        if (targetId) params.set("targetId", targetId);
        if (targetHandle) params.set("targetHandle", targetHandle);
      }

      return `${endpoint}?${params.toString()}`;
    }

    function mergeUniqueReviews(existingReviews, incomingReviews) {
      const map = new Map();

      existingReviews.forEach((review) => {
        map.set(String(review.id), review);
      });

      incomingReviews.forEach((review) => {
        map.set(String(review.id), review);
      });

      return Array.from(map.values());
    }

    async function loadReviews({ page = 1, append = false } = {}) {
      if (isFetchingReviews) return;
      isFetchingReviews = true;

      if (!append) {
        renderLoadingState();
      } else if (loadMoreBtn) {
        loadMoreBtn.hidden = false;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = "Loading...";
      }

      try {
        const response = await fetch(buildReviewsUrl(page, PAGE_SIZE), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          renderErrorState(result.message || "Failed to load reviews");
          return;
        }

        const incomingReviews = Array.isArray(result?.data) ? result.data : [];
        serverTotalReviews = Number(result?.totalReviews || 0);
        serverAverageRating = Number(result?.averageRating || 0);

        if (append) {
          allReviews = mergeUniqueReviews(allReviews, incomingReviews);
        } else {
          allReviews = incomingReviews;
          visibleCount = DEFAULT_VISIBLE_COUNT;
        }

        currentPage = page;
        hasMorePages = allReviews.length < serverTotalReviews;

        renderReviewsState();
      } catch {
        renderErrorState("Failed to load reviews");
      } finally {
        isFetchingReviews = false;
        updateLoadMoreButton(
          getFilteredSortedReviews().length,
          Math.min(visibleCount, getFilteredSortedReviews().length)
        );
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

    loadMoreBtn?.addEventListener("click", async () => {
      const filteredSorted = getFilteredSortedReviews();
      const totalVisible = Math.min(visibleCount, filteredSorted.length);

      if (totalVisible < filteredSorted.length) {
        visibleCount += LOAD_MORE_STEP;
        renderVisibleReviews();
        return;
      }

      if (hasMorePages && !isFetchingReviews) {
        await loadReviews({ page: currentPage + 1, append: true });
        visibleCount += LOAD_MORE_STEP;
        renderVisibleReviews();
      }
    });

    successStars.forEach((star) => {
      star.addEventListener("mouseenter", () => {
        const value = Number(star.getAttribute("data-store-rating") || 0);
        successStars.forEach((btn) => {
          const btnValue = Number(btn.getAttribute("data-store-rating") || 0);
          btn.classList.toggle("is-active", btnValue <= value);
        });
      });

      star.addEventListener("click", () => {
        const value = Number(star.getAttribute("data-store-rating") || 0);
        successStars.forEach((btn) => {
          const btnValue = Number(btn.getAttribute("data-store-rating") || 0);
          btn.classList.toggle("is-active", btnValue <= value);
        });
      });
    });

    portalHost.querySelector(".pr-store-feedback-stars")?.addEventListener("mouseleave", () => {});

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (messageEl) {
          messageEl.className = "pr-message-box";
          messageEl.textContent = "";
        }

        const stepsValid = [1, 2, 3, 4].every((stepNumber) => validateStep(stepNumber, true));

        if (!stepsValid) {
          showToast("Please fix the highlighted fields.", "error");
          for (let stepNumber = 1; stepNumber <= 4; stepNumber += 1) {
            if (!validateStep(stepNumber, false)) {
              goToStep(stepNumber, stepNumber > currentStep ? "forward" : "backward", true);
              break;
            }
          }
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }

        const formData = new FormData(form);
        const youtubeUrl = formData.get("reviewYoutubeUrl")?.toString().trim() || "";
        const normalizedYoutubeUrl = youtubeUrl ? normalizeYoutubeEmbedUrl(youtubeUrl) : "";
        const useAnonymous = Boolean(anonymousInput?.checked);
        const customerName = useAnonymous
          ? "Anonymous"
          : formData.get("customerName")?.toString().trim();

        const imageFilesForUpload = [...selectedImages];
        const videoFileForUpload = selectedVideoFile;
        const hasPendingMedia = imageFilesForUpload.length > 0 || Boolean(videoFileForUpload);

        const payload = {
          shop,
          reviewType,
          targetId: reviewType !== "store" ? (targetId || productId || "") : null,
          targetHandle: reviewType === "collection" ? targetHandle || null : null,
          targetTitle: targetTitle || productTitle || null,
          productId: reviewType === "product" ? (productId || targetId || "") : null,
          productTitle: reviewType === "product" ? (productTitle || targetTitle || null) : null,
          customerName,
          customerEmail: formData.get("customerEmail")?.toString().trim(),
          rating: Number(ratingInput?.value),
          title: formData.get("title")?.toString().trim(),
          message: formData.get("message")?.toString().trim(),
          reviewImages: [],
          reviewVideoUrl: null,
          reviewYoutubeUrl: normalizedYoutubeUrl || null,
          hasPendingMedia,
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
              submitBtn.textContent = "Submit review";
            }
            return;
          }

          const createdReviewId = result?.data?.id;

          showToast("Thanks for sharing your feedback!", "success");
          showSuccessScreen();

          if (createdReviewId && hasPendingMedia) {
            const job = await saveUploadJob({
              reviewId: createdReviewId,
              imageFiles: imageFilesForUpload,
              videoFile: videoFileForUpload,
              uploadedImageUrls: [],
              uploadedVideoUrl: null,
              progress: 0,
              status: "queued",
              errorMessage: null,
            });

            await updateServerUploadStatus(createdReviewId, "queued", 0, null);

            setUploadProgressUI({
              hidden: false,
              title: "Upload queued",
              percent: 0,
              text: "Media upload is starting...",
            });

            runUploadJob(job);
          } else {
            setUploadProgressUI({ hidden: true });
          }
        } catch {
          if (messageEl) {
            messageEl.className = "pr-message-box pr-message-error";
            messageEl.textContent = "Something went wrong while submitting review.";
          }

          showToast("Something went wrong while submitting review.", "error");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit review";
          }
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (reviewDetailModal && !reviewDetailModal.hidden) {
        if (e.key === "Escape") closeReviewDetailModal();
        else if (e.key === "ArrowLeft") showPrevDetailMedia();
        else if (e.key === "ArrowRight") showNextDetailMedia();
        return;
      }

      if (reviewModal && !reviewModal.hidden && e.key === "Escape") {
        closeReviewModal();
      }
    });

    if (!window.__prBeforeUnloadBound) {
      window.__prBeforeUnloadBound = true;

      window.addEventListener("beforeunload", function (e) {
        if (ACTIVE_UPLOAD_JOBS.size <= 0) return;
        e.preventDefault();
        e.returnValue = "";
      });
    }

    bindStarSelector();
    bindImageUploader();
    bindVideoUploader();
    bindRealtimeValidation();
    bindReviewModal();
    bindToolbarPanel();
    bindDetailModal();
    bindMediaStripNav();

    updateStarUI(0);
    updateRatingPreview();
    setUploadProgressUI({ hidden: true });

    if (titleCount) titleCount.textContent = "0 / 80";
    if (messageCount) messageCount.textContent = "0 / 1000";

    loadReviews({ page: 1, append: false });
    resumePendingUploads();
  }

  window.ProductReviewsMain = {
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
