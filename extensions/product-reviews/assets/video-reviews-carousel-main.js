(function (window, document) {
  if (window.PRVCApp) return;

  const JQ_URL = "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js";
  const SLICK_JS_URL =
    "https://cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.min.js";
  const SLICK_CSS_URL =
    "https://cdn.jsdelivr.net/npm/slick-carousel@1.8.1/slick/slick.css";

  let jqPromise = null;
  let slickPromise = null;

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

  function parseBoolean(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value;
    return String(value).toLowerCase() === "true";
  }

  function clampNumber(value, fallback, min, max) {
    const num = Number(value);
    if (Number.isNaN(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function ensureStyle(href, id) {
    if (!href) return;
    if (document.getElementById(id)) return;

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(url, id, checkFn) {
    return new Promise((resolve, reject) => {
      if (checkFn && checkFn()) {
        resolve();
        return;
      }

      const existing = document.getElementById(id);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load script: " + url)),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load script: " + url));
      document.head.appendChild(script);
    });
  }

  function ensureJquery() {
    if (window.jQuery) return Promise.resolve(window.jQuery);
    if (jqPromise) return jqPromise;

    jqPromise = ensureScript(JQ_URL, "prvc-jquery-js", function () {
      return !!window.jQuery;
    }).then(function () {
      return window.jQuery;
    });

    return jqPromise;
  }

  function ensureSlick() {
    if (slickPromise) return slickPromise;

    slickPromise = ensureJquery().then(function ($) {
      ensureStyle(SLICK_CSS_URL, "prvc-slick-css");

      if ($ && $.fn && $.fn.slick) return $;

      return ensureScript(SLICK_JS_URL, "prvc-slick-js", function () {
        return !!(window.jQuery && window.jQuery.fn && window.jQuery.fn.slick);
      }).then(function () {
        return window.jQuery;
      });
    });

    return slickPromise;
  }

  function readConfig(root) {
    const el = root.querySelector("[data-prvc-config]");
    if (!el) return {};

    try {
      return JSON.parse(el.textContent || "{}");
    } catch (error) {
      console.error("PRVC config parse error:", error);
      return {};
    }
  }

  function getSettings(root) {
    const config = readConfig(root);

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
      autoplayMedia: parseBoolean(config.autoplayMedia, true),
      transitionSpeed: clampNumber(config.transitionSpeed, 5, 3, 60),
      headerText: safeText(config.headerText || "Customers are saying"),
      showAverageRating: parseBoolean(config.showAverageRating, true),
    };
  }

  function getTargetProductId(settings) {
    if (settings.reviewSelection === "custom_product") {
      return settings.selectedProductId || "";
    }

    if (settings.reviewSelection === "all_reviews") {
      return "";
    }

    return settings.productId || "";
  }

  function hasVideoMedia(review) {
    return Boolean(review && (review.reviewVideoUrl || review.reviewYoutubeUrl));
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
        return parsed.pathname.split("/embed/")[1].split(/[/?&#]/)[0] || "";
      }

      if (parsed.pathname.includes("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1].split(/[/?&#]/)[0] || "";
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
    const id = getYoutubeId(url);
    return id ? "https://img.youtube.com/vi/" + id + "/hqdefault.jpg" : "";
  }

  function getYoutubeEmbedUrl(url) {
    const id = getYoutubeId(url);
    if (!id) return "";
    return (
      "https://www.youtube.com/embed/" +
      id +
      "?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1"
    );
  }

  function normalizeRating(value) {
    const num = Number(value) || 0;
    return Math.max(0, Math.min(5, num));
  }

  function starSvg() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 2.9l2.78 5.63 6.22.9-4.5 4.39 1.06 6.19L12 17.1l-5.56 2.91 1.06-6.19L3 9.43l6.22-.9L12 2.9z"></path>' +
      "</svg>"
    );
  }

  function renderStars(rating) {
    const rounded = Math.round(normalizeRating(rating));
    let html = "";

    for (let i = 0; i < 5; i += 1) {
      html +=
        '<span class="prvc-star' + (i < rounded ? " is-filled" : "") + '">' +
        starSvg() +
        "</span>";
    }

    return html;
  }

  function verifiedIcon() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2.5l2.35 1.6 2.83-.14 1.6 2.35 2.54 1.26-.14 2.83L22.5 12l-1.6 2.35.14 2.83-2.35 1.6-1.26 2.54-2.83-.14L12 21.5l-2.35-1.6-2.83.14-1.6-2.35-2.54-1.26.14-2.83L1.5 12l1.6-2.35-.14-2.83 2.35-1.6 1.26-2.54 2.83.14L12 2.5zm-1.07 12.88l5.66-5.66-1.06-1.06-4.6 4.6-2.12-2.12-1.06 1.06 3.18 3.18z"></path>' +
      "</svg>"
    );
  }

  function arrowIcon(dir) {
    return dir === "prev"
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a1 1 0 010 1.4L10.41 12l4.3 4.3a1 1 0 11-1.42 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.41 0z"></path></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 17.7a1 1 0 010-1.4l4.29-4.3-4.3-4.3a1 1 0 111.42-1.4l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.41 0z"></path></svg>';
  }

  function getInitial(name) {
    const clean = safeText(name).trim();
    return clean ? clean.charAt(0).toUpperCase() : "V";
  }

  function getMediaHtml(review) {
    if (review.reviewVideoUrl) {
      return (
        '<div class="prvc-media" data-media-type="video">' +
        '<video class="prvc-video" playsinline muted preload="metadata" src="' +
        escapeHtml(review.reviewVideoUrl) +
        '"></video>' +
        '<button type="button" class="prvc-play" aria-label="Play video">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5v11l9-5.5-9-5.5z"></path></svg>' +
        "</button>" +
        "</div>"
      );
    }

    if (review.reviewYoutubeUrl) {
      return (
        '<div class="prvc-media" data-media-type="youtube" data-youtube-url="' +
        escapeHtml(review.reviewYoutubeUrl) +
        '">' +
        '<div class="prvc-youtube-thumb" style="background-image:url(\'' +
        escapeHtml(getYoutubeThumb(review.reviewYoutubeUrl)) +
        "')\"></div>" +
        '<button type="button" class="prvc-play" aria-label="Play video">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5v11l9-5.5-9-5.5z"></path></svg>' +
        "</button>" +
        "</div>"
      );
    }

    return (
      '<div class="prvc-media is-placeholder" data-media-type="placeholder">' +
      '<div class="prvc-placeholder">' +
      '<span class="prvc-placeholder-initial">' +
      escapeHtml(getInitial(review.customerName)) +
      "</span>" +
      "</div>" +
      "</div>"
    );
  }

  function renderSlide(review, index, settings) {
    return (
      '<div class="prvc-slide" data-review-index="' +
      index +
      '">' +
      '<div class="prvc-card">' +
      getMediaHtml(review) +
      '<div class="prvc-card-overlay"></div>' +
      '<div class="prvc-card-footer">' +
      '<div class="prvc-card-stars">' +
      renderStars(Number(review.rating) || 5) +
      "</div>" +
      (settings.showReviewerName
        ? '<div class="prvc-card-name">' +
          escapeHtml(review.customerName || "Verified buyer") +
          "</div>"
        : "") +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderShell(settings, reviews, avg) {
    return (
      '<div class="prvc-shell">' +
      '<div class="prvc-head">' +
      '<h2 class="prvc-title">' +
      escapeHtml(settings.headerText) +
      "</h2>" +
      (settings.showAverageRating
        ? '<div class="prvc-rating-pill">' +
          '<div class="prvc-rating-stars">' +
          renderStars(avg) +
          "</div>" +
          '<div class="prvc-rating-text">' +
          avg.toFixed(2) +
          " <span>(" +
          reviews.length +
          ')</span></div>' +
          '<div class="prvc-rating-verified">' +
          verifiedIcon() +
          "</div>" +
          "</div>"
        : "") +
      '<div class="prvc-slider-area">' +
      '<div class="prvc-track" data-prvc-track>' +
      reviews
        .map(function (review, index) {
          return renderSlide(review, index, settings);
        })
        .join("") +
      "</div>" +
      '<div class="prvc-controls">' +
      '<button type="button" class="prvc-nav-btn prvc-nav-prev" data-prvc-prev aria-label="Previous">' +
      arrowIcon("prev") +
      "</button>" +
      '<button type="button" class="prvc-nav-btn prvc-nav-next" data-prvc-next aria-label="Next">' +
      arrowIcon("next") +
      "</button>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function renderLoader() {
    return (
      '<div class="prvc-loader-shell">' +
      '<div class="prvc-spinner" aria-label="Loading" role="status"></div>' +
      "</div>"
    );
  }

  function showLoader(mount) {
    mount.innerHTML = renderLoader();
  }

  function showEmpty(mount, message) {
    mount.innerHTML =
      '<div class="prvc-shell">' +
      '<div class="prvc-empty">' +
      "<p>" +
      escapeHtml(message) +
      "</p>" +
      "</div>" +
      "</div>";
  }

  function computeAverage(reviews, averageRatingFromApi) {
    const apiAvg = Number(averageRatingFromApi);
    if (apiAvg > 0) return Math.min(5, apiAvg);

    if (!reviews.length) return 0;

    const total = reviews.reduce(function (sum, item) {
      return sum + (Number(item.rating) || 0);
    }, 0);

    return Math.min(5, total / reviews.length);
  }

  function mountYoutubeIframe(mediaEl, youtubeUrl) {
    if (!mediaEl || !youtubeUrl) return;

    const embedUrl = getYoutubeEmbedUrl(youtubeUrl);
    if (!embedUrl) return;

    const currentFrame = mediaEl.querySelector("iframe");
    if (currentFrame && currentFrame.src === embedUrl) return;

    mediaEl.innerHTML =
      '<iframe src="' +
      escapeHtml(embedUrl) +
      '" title="Customer review video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
  }

  function mountYoutubeThumb(mediaEl, youtubeUrl) {
    if (!mediaEl || !youtubeUrl) return;

    mediaEl.innerHTML =
      '<div class="prvc-youtube-thumb" style="background-image:url(\'' +
      escapeHtml(getYoutubeThumb(youtubeUrl)) +
      "')\"></div>" +
      '<button type="button" class="prvc-play" aria-label="Play video">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.5v11l9-5.5-9-5.5z"></path></svg>' +
      "</button>";
  }

  function setActiveMedia($track) {
    $track.find(".prvc-slide").each(function () {
      const slide = this;
      const media = slide.querySelector(".prvc-media");
      if (!media) return;

      const isCenter = slide.classList.contains("slick-center");
      const video = media.querySelector("video");
      const youtubeUrl = media.getAttribute("data-youtube-url");

      if (video) {
        const playBtn = media.querySelector(".prvc-play");

        if (isCenter) {
          video.muted = true;
          video.playsInline = true;
          if (playBtn) playBtn.classList.add("is-hidden");
          video.play().catch(function () {});
        } else {
          video.pause();
          try {
            video.currentTime = 0;
          } catch (error) {}
          if (playBtn) playBtn.classList.remove("is-hidden");
        }
        return;
      }

      if (youtubeUrl) {
        if (isCenter) {
          mountYoutubeIframe(media, youtubeUrl);
        } else {
          mountYoutubeThumb(media, youtubeUrl);
        }
      }
    });
  }

  function bindSlideInteractions($, $track) {
    $track.on("click", ".prvc-slide", function (event) {
      const $slide = $(this);

      if (!$slide.hasClass("slick-center")) {
        const targetIndex = Number($slide.attr("data-review-index"));
        if (!Number.isNaN(targetIndex)) {
          $track.slick("slickGoTo", targetIndex);
        }
        return;
      }

      const media = event.target.closest(".prvc-media");
      if (!media) return;

      const video = media.querySelector("video");
      const playBtn = media.querySelector(".prvc-play");

      if (video) {
        if (video.paused) {
          video.play().catch(function () {});
          if (playBtn) playBtn.classList.add("is-hidden");
        } else {
          video.pause();
          if (playBtn) playBtn.classList.remove("is-hidden");
        }
      }
    });
  }

  function initSingleView(mount, settings, reviews, averageRating) {
    mount.innerHTML = renderShell(settings, reviews, averageRating);

    const track = mount.querySelector("[data-prvc-track]");
    const slide = track ? track.querySelector(".prvc-slide") : null;

    if (slide) {
      slide.classList.add("slick-center", "is-single");
      setActiveMedia(window.jQuery(track));
    }

    const prev = mount.querySelector("[data-prvc-prev]");
    const next = mount.querySelector("[data-prvc-next]");

    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
  }

  function initSlickCarousel(root, mount, settings, reviews, averageRating) {
    ensureSlick()
      .then(function ($) {
        if (!$ || !$.fn || !$.fn.slick) {
          throw new Error("Slick not available.");
        }

        if (!reviews.length) {
          showEmpty(mount, "No video reviews yet.");
          return;
        }

        if (reviews.length === 1) {
          initSingleView(mount, settings, reviews, averageRating);
          return;
        }

        mount.innerHTML = renderShell(settings, reviews, averageRating);

        const $mount = $(mount);
        const $track = $mount.find("[data-prvc-track]");
        const $prev = $mount.find("[data-prvc-prev]");
        const $next = $mount.find("[data-prvc-next]");

        $track.on("init", function () {
          setTimeout(function () {
            setActiveMedia($track);
          }, 60);
        });

        $track.on("afterChange", function () {
          setActiveMedia($track);
        });

        $track.slick({
          infinite: true,
          arrows: false,
          dots: false,
          centerMode: true,
          centerPadding: "0px",
          slidesToShow: 5,
          slidesToScroll: 1,
          speed: 420,
          autoplay: reviews.length > 1,
          autoplaySpeed: settings.transitionSpeed * 1000,
          pauseOnHover: true,
          pauseOnFocus: true,
          swipeToSlide: true,
          draggable: true,
          touchThreshold: 12,
          adaptiveHeight: false,
          mobileFirst: false,
          responsive: [
            {
              breakpoint: 991,
              settings: {
                slidesToShow: 3,
              },
            },
            {
              breakpoint: 767,
              settings: {
                slidesToShow: 1,
                centerMode: true,
              },
            },
          ],
        });

        $prev.on("click", function () {
          $track.slick("slickPrev");
        });

        $next.on("click", function () {
          $track.slick("slickNext");
        });

        bindSlideInteractions($, $track);

        root.__prvcDestroy = function () {
          try {
            if ($track.hasClass("slick-initialized")) {
              $track.slick("unslick");
            }
          } catch (error) {}
        };
      })
      .catch(function (error) {
        console.error("PRVC slick init error:", error);
        showEmpty(mount, "Carousel load nahi ho paaya.");
      });
  }

  async function fetchReviews(settings) {
    if (settings.showSampleReviews) {
      return {
        success: true,
        averageRating: 4.88,
        data: [
          {
            id: "sample-1",
            customerName: "app-development-sumit",
            rating: 5,
            reviewYoutubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
          {
            id: "sample-2",
            customerName: "Barbara S.",
            rating: 5,
            reviewYoutubeUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
          },
          {
            id: "sample-3",
            customerName: "Haley Nixon",
            rating: 5,
            reviewYoutubeUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
          },
          {
            id: "sample-4",
            customerName: "Casey Blake",
            rating: 4,
            reviewYoutubeUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          },
        ],
      };
    }

    if (
      settings.reviewSelection === "custom_product" &&
      !settings.selectedProductId
    ) {
      return {
        success: false,
        message: "Custom product select karo.",
        data: [],
      };
    }

    const fetchUrl = new URL(settings.endpoint, window.location.origin);

    if (settings.shop) {
      fetchUrl.searchParams.set("shop", settings.shop);
    }

    const targetProductId = getTargetProductId(settings);
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
      return {
        success: false,
        message: "Reviews fetch nahi hui.",
        data: [],
      };
    }

    return result;
  }

  function createController(root) {
    const mount = root.querySelector("[data-prvc-mount]");
    if (!mount) return null;

    const settings = getSettings(root);

    async function init() {
      if (root.__prvcDestroy) {
        try {
          root.__prvcDestroy();
        } catch (error) {}
      }

      showLoader(mount);

      try {
        const result = await fetchReviews(settings);
        const reviews = Array.isArray(result.data)
          ? result.data.filter(hasVideoMedia)
          : [];

        if (!result.success || !reviews.length) {
          showEmpty(
            mount,
            result.message ||
              "Approved video reviews yahan show hongi jab media review available hoga."
          );
          return;
        }

        const averageRating = computeAverage(
          reviews,
          Number(result.averageRating || 0)
        );

        initSlickCarousel(root, mount, settings, reviews, averageRating);
      } catch (error) {
        console.error("PRVC fetch error:", error);
        showEmpty(mount, "Something went wrong while loading reviews.");
      }
    }

    return { init: init };
  }

  function initRoot(root) {
    if (!root) return;
    if (root.dataset.prvcInitialized === "true") return;

    const controller = createController(root);
    if (!controller) return;

    root.dataset.prvcInitialized = "true";
    controller.init();
  }

  function initAll(scope) {
    const roots = (scope || document).querySelectorAll(".prvc-root");
    if (!roots.length) return;
    roots.forEach(initRoot);
  }

  window.PRVCApp = {
    initRoot: initRoot,
    initAll: initAll,
  };
})(window, document);
