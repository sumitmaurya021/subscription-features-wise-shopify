(function (window, document) {
  if (window.VideoReviewsCarouselApp) return;

  const SWIPER_JS_URL =
    "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";

  let swiperScriptPromise = null;

  function ensureScript(url, id) {
    return new Promise((resolve, reject) => {
      if (window.Swiper) {
        resolve();
        return;
      }

      const existing = document.getElementById(id);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load Swiper")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Swiper"));
      document.head.appendChild(script);
    });
  }

  function ensureSwiperScript() {
    if (window.Swiper) return Promise.resolve();
    if (swiperScriptPromise) return swiperScriptPromise;
    swiperScriptPromise = ensureScript(SWIPER_JS_URL, "prvc-swiper-js");
    return swiperScriptPromise;
  }

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function parseBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  }

  function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderStars(rating) {
    const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
    const rounded = Math.round(safeRating);
    return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
  }

  function getInitial(name) {
    const cleanName = safeText(name).trim();
    return cleanName ? cleanName.charAt(0).toUpperCase() : "V";
  }

  function getYoutubeId(url) {
    const text = safeText(url).trim();
    if (!text) return "";

    try {
      const parsed = new URL(text, window.location.origin);

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "").trim();
      }

      if (parsed.searchParams.get("v")) {
        return parsed.searchParams.get("v") || "";
      }

      if (parsed.pathname.includes("/embed/")) {
        return parsed.pathname.split("/embed/")[1]?.split(/[/?&#]/)[0] || "";
      }

      if (parsed.pathname.includes("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split(/[/?&#]/)[0] || "";
      }
    } catch (error) {
      const match =
        text.match(
          /(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&/]+)/
        ) || text.match(/\/embed\/([^?&/]+)/);

      return match ? match[1] : "";
    }

    return "";
  }

  function getYoutubeThumb(url) {
    const videoId = getYoutubeId(url);
    return videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : "";
  }

  function getYoutubeEmbedUrl(url, autoplay) {
    const videoId = getYoutubeId(url);
    if (!videoId) return "";

    return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&modestbranding=1&mute=1&autoplay=${
      autoplay ? "1" : "0"
    }`;
  }

  function hasVideoMedia(review) {
    return Boolean(review?.reviewVideoUrl || review?.reviewYoutubeUrl);
  }

  function readConfig(root) {
    const configEl = root.querySelector("[data-prvc-config]");
    if (!configEl) return null;

    try {
      return JSON.parse(configEl.textContent || "{}");
    } catch (error) {
      console.error("PRVC config parse error:", error);
      return null;
    }
  }

  function getSettings(root) {
    const config = readConfig(root) || {};

    return {
      shop: safeText(config.shop),
      endpoint: safeText(config.endpoint || "/apps/reviews"),
      productId: safeText(config.productId),
      selectedProductId: safeText(config.selectedProductId),
      showSampleReviews: parseBoolean(config.showSampleReviews, false),
      reviewSelection: safeText(config.reviewSelection || "current_product"),
      starRating: safeText(config.starRating || "all"),
      reviewType: safeText(config.reviewType || "any"),
      maxReviews: clampNumber(config.maxReviews, 9, 3, 30),
      showReviewerName: parseBoolean(config.showReviewerName, true),
      autoplayMedia: parseBoolean(config.autoplayMedia, false),
      transitionSpeed: clampNumber(config.transitionSpeed, 6, 3, 60),
      headerText: safeText(config.headerText || "Real customer stories"),
      showAverageRating: parseBoolean(config.showAverageRating, true),
    };
  }

  function createCarouselController(root) {
    const loadingEl = root.querySelector("[data-prvc-loading]");
    const swiperEl = root.querySelector("[data-prvc-swiper]");
    const wrapperEl = root.querySelector("[data-prvc-wrapper]");
    const headerEl = root.querySelector("[data-prvc-header]");
    const prevButtons = Array.from(root.querySelectorAll("[data-prvc-prev]"));
    const nextButtons = Array.from(root.querySelectorAll("[data-prvc-next]"));

    if (!swiperEl || !wrapperEl || !headerEl) return null;

    const settings = getSettings(root);

    let swiperInstance = null;
    let currentReviews = [];
    let currentActiveIndex = 0;
    let navBound = false;
    let mediaBound = false;
    let resizeBound = false;
    let isAnimating = false;
    let resizeRaf = null;

    const sampleReviews = [
      {
        id: "sample-1",
        customerName: "Barbara S.",
        rating: 5,
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-2",
        customerName: "Haley Nixon",
        rating: 5,
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-3",
        customerName: "Casey Blake",
        rating: 5,
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-4",
        customerName: "Regan Travis",
        rating: 5,
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
    ];

    function getTargetProductId() {
      if (settings.reviewSelection === "custom_product") {
        return settings.selectedProductId || "";
      }

      if (settings.reviewSelection === "all_reviews") {
        return "";
      }

      return settings.productId || "";
    }

    function buildHeader(reviews, averageRatingFromApi) {
      const total = reviews.length;
      const computedAvg =
        total > 0
          ? reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) /
            total
          : 0;

      const avg =
        typeof averageRatingFromApi === "number" && averageRatingFromApi > 0
          ? averageRatingFromApi
          : computedAvg;

      headerEl.innerHTML = `
        <h2 class="prvc-title">${escapeHtml(settings.headerText)}</h2>
        ${
          settings.showAverageRating
            ? `
              <div class="prvc-meta-row">
                <span class="prvc-meta-stars">${renderStars(avg)}</span>
                <span class="prvc-meta-text">${avg.toFixed(2)} ★ (${total})</span>
                <span class="prvc-meta-verified">☑ Verified</span>
              </div>
            `
            : ""
        }
      `;
    }

    function getSlideMediaHtml(review) {
      if (review.reviewVideoUrl) {
        return `
          <div class="prvc-media" data-media-type="video">
            <video
              class="prvc-video"
              playsinline
              muted
              preload="metadata"
              poster=""
              src="${escapeHtml(review.reviewVideoUrl)}"
            ></video>
            <span class="prvc-play-badge">▶</span>
          </div>
        `;
      }

      if (review.reviewYoutubeUrl) {
        const thumb = getYoutubeThumb(review.reviewYoutubeUrl);

        return `
          <div
            class="prvc-media"
            data-media-type="youtube"
            data-youtube-url="${escapeHtml(review.reviewYoutubeUrl)}"
          >
            <div
              class="prvc-youtube-thumb"
              style="background-image:url('${escapeHtml(thumb)}');"
            ></div>
            <span class="prvc-play-badge">▶</span>
          </div>
        `;
      }

      return `
        <div class="prvc-media is-placeholder" data-media-type="placeholder">
          <div class="prvc-placeholder">
            <span class="prvc-placeholder-initial">${escapeHtml(
              getInitial(review.customerName)
            )}</span>
          </div>
        </div>
      `;
    }

    function renderSlide(review, index) {
      return `
        <div class="swiper-slide prvc-slide" data-review-index="${index}">
          <div class="prvc-card">
            ${getSlideMediaHtml(review)}
            <div class="prvc-card-content">
              <div class="prvc-card-footer">
                <div class="prvc-card-stars">${renderStars(
                  Number(review.rating) || 5
                )}</div>
                ${
                  settings.showReviewerName
                    ? `<div class="prvc-card-name">${escapeHtml(
                        review.customerName || "Verified buyer"
                      )}</div>`
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function disableNav(disabled) {
      prevButtons.forEach((btn) => {
        btn.disabled = disabled;
      });

      nextButtons.forEach((btn) => {
        btn.disabled = disabled;
      });
    }

    function destroySwiper() {
      if (swiperInstance) {
        swiperInstance.destroy(true, true);
        swiperInstance = null;
      }
      isAnimating = false;
    }

    function showEmpty(message) {
      destroySwiper();
      currentReviews = [];
      currentActiveIndex = 0;

      if (loadingEl) loadingEl.hidden = true;

      swiperEl.hidden = false;
      swiperEl.classList.add("prvc-single");
      wrapperEl.innerHTML = "";

      swiperEl.innerHTML = `
        <div class="prvc-empty">
          <h3>No video reviews yet</h3>
          <p>${escapeHtml(message)}</p>
        </div>
      `;

      disableNav(true);
    }

    function restoreSwiperMarkupIfNeeded() {
      const existingWrapper = swiperEl.querySelector("[data-prvc-wrapper]");
      if (existingWrapper) return existingWrapper;

      swiperEl.innerHTML = `<div class="swiper-wrapper" data-prvc-wrapper></div>`;
      return swiperEl.querySelector("[data-prvc-wrapper]");
    }

    function buildSlides(reviews) {
      const liveWrapper = restoreSwiperMarkupIfNeeded();
      liveWrapper.innerHTML = reviews
        .map((review, index) => renderSlide(review, index))
        .join("");
      return liveWrapper;
    }

    function getAllSlides() {
      return Array.from(swiperEl.querySelectorAll(".prvc-slide"));
    }

    function getSlideByIndex(index) {
      return swiperEl.querySelector(`.prvc-slide[data-review-index="${index}"]`);
    }

    function mountYoutubeIframe(mediaEl, url) {
      if (!mediaEl || !url) return;
      if (mediaEl.querySelector("iframe")) return;

      const embedUrl = getYoutubeEmbedUrl(url, settings.autoplayMedia);
      mediaEl.innerHTML = `
        <iframe
          src="${escapeHtml(embedUrl)}"
          title="Customer video review"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
          loading="lazy"
        ></iframe>
      `;
    }

    function mountYoutubeThumb(mediaEl, url) {
      if (!mediaEl || !url) return;
      const thumb = getYoutubeThumb(url);

      mediaEl.innerHTML = `
        <div
          class="prvc-youtube-thumb"
          style="background-image:url('${escapeHtml(thumb)}');"
        ></div>
        <span class="prvc-play-badge">▶</span>
      `;
    }

    function updateVideoState(mediaEl, isActive) {
      if (!mediaEl) return;

      const video = mediaEl.querySelector("video");
      const badge = mediaEl.querySelector(".prvc-play-badge");
      if (!video) return;

      if (!video.dataset.prvcBound) {
        video.dataset.prvcBound = "true";

        video.addEventListener("play", () => {
          if (badge) badge.classList.add("is-hidden");
        });

        video.addEventListener("pause", () => {
          if (badge) badge.classList.remove("is-hidden");
        });

        video.addEventListener("ended", () => {
          if (badge) badge.classList.remove("is-hidden");
        });
      }

      if (isActive) {
        if (settings.autoplayMedia) {
          video.muted = true;
          video.play().catch(() => {});
          if (badge) badge.classList.add("is-hidden");
        } else if (badge) {
          badge.classList.remove("is-hidden");
        }
      } else {
        if (!video.paused) video.pause();
        if (badge) badge.classList.remove("is-hidden");
      }
    }

    function updateSlideMedia(index, isActive) {
      const review = currentReviews[index];
      const slide = getSlideByIndex(index);

      if (!review || !slide) return;

      const mediaEl = slide.querySelector(".prvc-media");
      if (!mediaEl) return;

      if (review.reviewYoutubeUrl) {
        if (isActive) {
          mountYoutubeIframe(mediaEl, review.reviewYoutubeUrl);
        } else {
          mountYoutubeThumb(mediaEl, review.reviewYoutubeUrl);
        }
        return;
      }

      if (review.reviewVideoUrl) {
        updateVideoState(mediaEl, isActive);
      }
    }

    function setActiveMedia(newIndex, oldIndex) {
      if (!currentReviews.length) return;

      if (
        typeof oldIndex === "number" &&
        oldIndex >= 0 &&
        oldIndex !== newIndex
      ) {
        updateSlideMedia(oldIndex, false);
      }

      updateSlideMedia(newIndex, true);
      currentActiveIndex = newIndex;
    }

    function initSingleCenteredView(reviews) {
      destroySwiper();
      currentReviews = reviews;
      currentActiveIndex = 0;

      if (loadingEl) loadingEl.hidden = true;

      swiperEl.hidden = false;
      swiperEl.classList.add("prvc-single");

      buildSlides(reviews);

      const firstSlide = swiperEl.querySelector(".swiper-slide");
      if (firstSlide) {
        firstSlide.classList.add("swiper-slide-active");
      }

      setActiveMedia(0, -1);
      disableNav(true);
    }

    function initSwiper(reviews) {
      destroySwiper();
      currentReviews = reviews;
      currentActiveIndex = 0;

      if (loadingEl) loadingEl.hidden = true;

      swiperEl.hidden = false;
      swiperEl.classList.remove("prvc-single");

      if (reviews.length === 1) {
        initSingleCenteredView(reviews);
        return;
      }

      buildSlides(reviews);

      swiperInstance = new window.Swiper(swiperEl, {
        loop: false,
        rewind: true,
        centeredSlides: true,
        centeredSlidesBounds: true,
        centerInsufficientSlides: true,
        watchOverflow: true,
        grabCursor: true,
        speed: 380,
        slidesPerView: "auto",
        spaceBetween: 16,
        preloadImages: false,
        updateOnWindowResize: false,
        resistanceRatio: 0.85,
        autoplay: settings.autoplayMedia
          ? {
              delay: settings.transitionSpeed * 1000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
        breakpoints: {
          576: { spaceBetween: 16 },
          768: { spaceBetween: 18 },
          990: { spaceBetween: 22 },
        },
        on: {
          init(swiper) {
            const active = swiper.activeIndex || 0;
            setActiveMedia(active, -1);
            disableNav(reviews.length <= 1);
          },
          slideChangeTransitionStart() {
            isAnimating = true;
          },
          slideChangeTransitionEnd(swiper) {
            const nextIndex = swiper.activeIndex || 0;
            const prevIndex = currentActiveIndex;
            setActiveMedia(nextIndex, prevIndex);
            isAnimating = false;
          },
        },
      });
    }

    function bindNav() {
      if (navBound) return;
      navBound = true;

      prevButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!swiperInstance || isAnimating) return;
          swiperInstance.slidePrev();
        });
      });

      nextButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!swiperInstance || isAnimating) return;
          swiperInstance.slideNext();
        });
      });
    }

    function bindMediaClicks() {
      if (mediaBound) return;
      mediaBound = true;

      swiperEl.addEventListener("click", (event) => {
        const slide = event.target.closest(".prvc-slide");
        if (!slide) return;

        const reviewIndex = Number(slide.getAttribute("data-review-index"));
        const activeIndex = swiperInstance ? swiperInstance.activeIndex || 0 : 0;

        if (swiperInstance && reviewIndex !== activeIndex) {
          if (isAnimating) return;
          swiperInstance.slideTo(reviewIndex);
          return;
        }

        const media = event.target.closest(".prvc-media");
        if (!media) return;

        const video = media.querySelector("video");
        const badge = media.querySelector(".prvc-play-badge");

        if (video) {
          if (video.paused) {
            video.play().catch(() => {});
            if (badge) badge.classList.add("is-hidden");
          } else {
            video.pause();
            if (badge) badge.classList.remove("is-hidden");
          }
        }
      });
    }

    function bindResize() {
      if (resizeBound) return;
      resizeBound = true;

      window.addEventListener("resize", () => {
        if (!swiperInstance) return;

        if (resizeRaf) {
          window.cancelAnimationFrame(resizeRaf);
        }

        resizeRaf = window.requestAnimationFrame(() => {
          swiperInstance.update();
          resizeRaf = null;
        });
      });
    }

    async function fetchReviews() {
      try {
        if (settings.showSampleReviews) {
          buildHeader(sampleReviews, 5);
          initSwiper(sampleReviews);
          return;
        }

        if (
          settings.reviewSelection === "custom_product" &&
          !settings.selectedProductId
        ) {
          showEmpty(
            "Please select a product in widget settings when Reviews selection is Custom product."
          );
          return;
        }

        const fetchUrl = new URL(settings.endpoint, window.location.origin);

        if (settings.shop) {
          fetchUrl.searchParams.set("shop", settings.shop);
        }

        const targetProductId = getTargetProductId();
        if (targetProductId) {
          fetchUrl.searchParams.set("productId", targetProductId);
        }

        fetchUrl.searchParams.set("approvedOnly", "true");
        fetchUrl.searchParams.set("onlyMedia", "true");
        fetchUrl.searchParams.set("limit", String(settings.maxReviews));

        if (settings.starRating !== "all") {
          fetchUrl.searchParams.set("starRating", settings.starRating);
        }

        if (settings.reviewType !== "any") {
          fetchUrl.searchParams.set("reviewType", settings.reviewType);
        }

        const response = await fetch(fetchUrl.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          showEmpty("Unable to load video reviews right now.");
          return;
        }

        const reviews = Array.isArray(result.data)
          ? result.data.filter(hasVideoMedia)
          : [];

        if (!reviews.length) {
          showEmpty(
            "Approved video reviews yahan show honge. Review me uploaded video ya YouTube link hona chahiye."
          );
          return;
        }

        buildHeader(reviews, Number(result.averageRating || 0));
        initSwiper(reviews);
      } catch (error) {
        console.error("VIDEO CAROUSEL LOAD ERROR:", error);
        showEmpty("Something went wrong while loading the video carousel.");
      }
    }

    async function init() {
      bindNav();
      bindMediaClicks();
      bindResize();

      try {
        await ensureSwiperScript();
      } catch (error) {
        console.error("Swiper load error:", error);
        showEmpty("Failed to load video reviews carousel.");
        return;
      }

      fetchReviews();
    }

    return { init };
  }

  function initRoot(root) {
    if (!root || root.dataset.initialized === "true") return;

    const controller = createCarouselController(root);
    if (!controller) return;

    root.dataset.initialized = "true";
    controller.init();
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".prvc-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      initRoot(root);
    });
  }

  window.VideoReviewsCarouselApp = {
    initRoot,
    initAll,
  };
})(window, document);
