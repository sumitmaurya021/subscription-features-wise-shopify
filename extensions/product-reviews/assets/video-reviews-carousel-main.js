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
      const match = text.match(/\/embed\/([^?&/]+)/);
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

    return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&mute=1&autoplay=${
      autoplay ? "1" : "0"
    }`;
  }

  function hasVideoMedia(review) {
    return Boolean(review?.reviewVideoUrl || review?.reviewYoutubeUrl);
  }

  function getSettings(root) {
    return {
      shop: root.dataset.shop || "",
      endpoint: root.dataset.endpoint || "/apps/reviews",
      productId: root.dataset.productId || "",
      selectedProductId: root.dataset.selectedProductId || "",
      showSampleReviews: parseBoolean(root.dataset.showSample),
      reviewSelection: root.dataset.reviewSelection || "current_product",
      starRating: root.dataset.starRating || "all",
      reviewType: root.dataset.reviewType || "any",
      maxReviews: clampNumber(root.dataset.maxReviews, 9, 3, 30),
      showReviewerName: parseBoolean(root.dataset.showReviewerName),
      autoplayMedia: parseBoolean(root.dataset.autoplayMedia),
      transitionSpeed: clampNumber(root.dataset.transitionSpeed, 6, 3, 60),
      headerText: root.dataset.headerText || "Real customer stories",
      showAverageRating: parseBoolean(root.dataset.showAverageRating),
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
    let resizeBound = false;
    let navBound = false;
    let mediaBound = false;

    const sampleReviews = [
      {
        id: "sample-1",
        customerName: "Barbara S.",
        rating: 5,
        title: "Looks amazing in real life",
        message: "Really loved the quality and overall experience.",
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-2",
        customerName: "Haley Nixon",
        rating: 5,
        title: "Beautiful finish and quality",
        message: "Nice finish and value for money.",
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-3",
        customerName: "Casey Blake",
        rating: 5,
        title: "Exactly what I wanted",
        message: "Premium feel and super easy to use.",
        reviewVideoUrl: "",
        reviewYoutubeUrl: "",
      },
      {
        id: "sample-4",
        customerName: "Regan Travis",
        rating: 5,
        title: "Would definitely recommend",
        message: "Looks premium and feels really good.",
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
          ? reviews.reduce(
              (sum, item) => sum + (Number(item.rating) || 0),
              0
            ) / total
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
                <span class="prvc-meta-stars">${renderStars(
                  Math.round(avg || 0)
                )}</span>
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
              src="${escapeHtml(review.reviewVideoUrl)}"
            ></video>
            <span class="prvc-play-badge">▶</span>
          </div>
        `;
      }

      if (review.reviewYoutubeUrl) {
        const thumb = getYoutubeThumb(review.reviewYoutubeUrl);

        return `
          <div class="prvc-media" data-media-type="youtube">
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
    }

    function showEmpty(message) {
      destroySwiper();
      currentReviews = [];

      if (loadingEl) {
        loadingEl.hidden = true;
      }

      if (swiperEl) {
        swiperEl.hidden = false;
        swiperEl.classList.add("prvc-single");
        swiperEl.innerHTML = `
          <div class="prvc-empty">
            <h3>No video reviews yet</h3>
            <p>${escapeHtml(message)}</p>
          </div>
        `;
      }

      disableNav(true);
    }

    function buildSlides(reviews) {
      wrapperEl.innerHTML = reviews
        .map((review, index) => renderSlide(review, index))
        .join("");
    }

    function refreshActiveMedia(activeIndex) {
      if (!swiperEl || !currentReviews.length) return;

      const allSlides = Array.from(
        swiperEl.querySelectorAll(".swiper-slide.prvc-slide")
      );

      allSlides.forEach((slide) => {
        const reviewIndex = Number(slide.getAttribute("data-review-index"));
        const review = currentReviews[reviewIndex];

        if (!review) return;

        const mediaContainer = slide.querySelector(".prvc-media");
        if (!mediaContainer) return;

        const isActive = reviewIndex === activeIndex;

        if (review.reviewYoutubeUrl) {
          if (isActive) {
            const embedUrl = getYoutubeEmbedUrl(
              review.reviewYoutubeUrl,
              settings.autoplayMedia
            );

            mediaContainer.innerHTML = `
              <iframe
                src="${escapeHtml(embedUrl)}"
                title="Customer video review"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowfullscreen
                loading="lazy"
              ></iframe>
            `;
          } else {
            const thumb = getYoutubeThumb(review.reviewYoutubeUrl);

            mediaContainer.innerHTML = `
              <div
                class="prvc-youtube-thumb"
                style="background-image:url('${escapeHtml(thumb)}');"
              ></div>
              <span class="prvc-play-badge">▶</span>
            `;
          }
        }

        if (review.reviewVideoUrl) {
          const video = mediaContainer.querySelector("video");
          const badge = mediaContainer.querySelector(".prvc-play-badge");

          if (!video) return;

          video.controls = false;
          video.removeAttribute("controls");

          video.onplay = () => {
            if (badge) badge.classList.add("is-hidden");
          };

          video.onpause = () => {
            if (badge) badge.classList.remove("is-hidden");
          };

          video.onended = () => {
            if (badge) badge.classList.remove("is-hidden");
          };

          if (isActive && settings.autoplayMedia) {
            video.muted = true;
            video.play().catch(() => {});
            if (badge) badge.classList.add("is-hidden");
          } else {
            video.pause();
            video.currentTime = 0;
            if (badge) badge.classList.remove("is-hidden");
          }
        }
      });
    }

    function initSingleCenteredView(reviews) {
      destroySwiper();
      currentReviews = reviews;

      if (loadingEl) {
        loadingEl.hidden = true;
      }

      swiperEl.hidden = false;
      swiperEl.classList.add("prvc-single");

      buildSlides(reviews);

      const firstSlide = swiperEl.querySelector(".swiper-slide");
      if (firstSlide) {
        firstSlide.classList.add("swiper-slide-active");
      }

      refreshActiveMedia(0);
      disableNav(true);
    }

    function initSwiper(reviews) {
      destroySwiper();
      currentReviews = reviews;

      if (loadingEl) {
        loadingEl.hidden = true;
      }

      swiperEl.hidden = false;
      swiperEl.classList.remove("prvc-single");

      if (reviews.length === 1) {
        initSingleCenteredView(reviews);
        return;
      }

      buildSlides(reviews);

      swiperInstance = new window.Swiper(swiperEl, {
        loop: reviews.length > 5,
        centeredSlides: true,
        centeredSlidesBounds: true,
        centerInsufficientSlides: true,
        watchOverflow: true,
        watchSlidesProgress: true,
        grabCursor: true,
        speed: 500,
        initialSlide: reviews.length > 1 ? 1 : 0,
        slidesPerView: "auto",
        spaceBetween: 16,
        autoplay: settings.autoplayMedia
          ? {
              delay: settings.transitionSpeed * 1000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
        breakpoints: {
          576: {
            spaceBetween: 16,
          },
          768: {
            spaceBetween: 18,
          },
          990: {
            spaceBetween: 22,
          },
        },
        on: {
          init(swiper) {
            refreshActiveMedia(swiper.realIndex || 0);
          },
          slideChangeTransitionEnd(swiper) {
            refreshActiveMedia(swiper.realIndex || 0);
          },
        },
      });

      disableNav(reviews.length <= 1);
    }

    function bindNav() {
      if (navBound) return;
      navBound = true;

      prevButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!swiperInstance) return;
          swiperInstance.slidePrev();
        });
      });

      nextButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!swiperInstance) return;
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
        const activeIndex = swiperInstance ? swiperInstance.realIndex || 0 : 0;

        if (swiperInstance && reviewIndex !== activeIndex) {
          if (swiperInstance.params.loop) {
            swiperInstance.slideToLoop(reviewIndex);
          } else {
            swiperInstance.slideTo(reviewIndex);
          }
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
        if (swiperInstance) {
          swiperInstance.update();
          refreshActiveMedia(swiperInstance.realIndex || 0);
        }
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
            "Please select a product in widget settings when Reviews Selection is Custom product."
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
          headers: {
            Accept: "application/json",
          },
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
