(function () {
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(new Error("Testimonials app script URL missing."));
    }

    if (window.TestimonialsCarouselApp) {
      return Promise.resolve(window.TestimonialsCarouselApp);
    }

    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll("script")).find(
        (script) => script.dataset.tcAppScript === src
      );

      if (existing) {
        if (existing.dataset.tcLoaded === "true" && window.TestimonialsCarouselApp) {
          resolve(window.TestimonialsCarouselApp);
          return;
        }

        const handleLoad = () => {
          existing.removeEventListener("load", handleLoad);
          existing.removeEventListener("error", handleError);

          if (window.TestimonialsCarouselApp) {
            resolve(window.TestimonialsCarouselApp);
          } else {
            reject(new Error("Testimonials app loaded but API missing."));
          }
        };

        const handleError = () => {
          existing.removeEventListener("load", handleLoad);
          existing.removeEventListener("error", handleError);
          reject(new Error("Failed to load Testimonials app script."));
        };

        existing.addEventListener("load", handleLoad);
        existing.addEventListener("error", handleError);
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.tcAppScript = src;

      script.onload = () => {
        script.dataset.tcLoaded = "true";

        if (window.TestimonialsCarouselApp) {
          resolve(window.TestimonialsCarouselApp);
        } else {
          reject(new Error("Testimonials app loaded but API missing."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load Testimonials app script."));
      };

      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function startRoot(root) {
    if (!root || root.dataset.tcBooted === "true") return;
    root.dataset.tcBooted = "true";

    const appScript = root.dataset.appScript || "";

    loadScriptOnce(appScript)
      .then((app) => {
        if (!app || typeof app.initRoot !== "function") {
          throw new Error("TestimonialsCarouselApp.initRoot() missing.");
        }

        app.initRoot(root);
      })
      .catch((error) => {
        console.error("Testimonials Carousel bootstrap error:", error);

        const track = root.querySelector(".tc-track");
        const loading = root.querySelector(".tc-loading");
        const empty = root.querySelector(".tc-empty");

        if (loading) loading.hidden = true;
        if (track) track.innerHTML = "";
        if (empty) empty.hidden = false;
      });
  }

  function observeRoot(root) {
    if (!root || root.dataset.tcObserved === "true") return;
    root.dataset.tcObserved = "true";

    if (!("IntersectionObserver" in window)) {
      startRoot(root);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries && entries[0];
        if (!entry || !entry.isIntersecting) return;

        observer.disconnect();
        startRoot(root);
      },
      { rootMargin: "250px 0px" }
    );

    observer.observe(root);
  }

  function initAll(scope) {
    const context = scope && scope.querySelectorAll ? scope : document;
    const roots = Array.from(context.querySelectorAll(".tc-root"));

    if (!roots.length) return;
    roots.forEach(observeRoot);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        initAll(document);
      },
      { once: true }
    );
  } else {
    initAll(document);
  }

  document.addEventListener("shopify:section:load", function (event) {
    initAll(event && event.target ? event.target : document);
  });

  document.addEventListener("shopify:section:reorder", function (event) {
    initAll(event && event.target ? event.target : document);
  });

  document.addEventListener("shopify:block:select", function (event) {
    initAll(event && event.target ? event.target : document);
  });

  document.addEventListener("shopify:block:deselect", function (event) {
    initAll(event && event.target ? event.target : document);
  });
})();
