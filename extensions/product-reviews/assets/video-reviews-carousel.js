(function () {
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(
        new Error("Video reviews carousel app script URL missing.")
      );
    }

    if (window.VideoReviewsCarouselApp) {
      return Promise.resolve(window.VideoReviewsCarouselApp);
    }

    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll("script")).find(
        (script) => script.dataset.prvcAppScript === src
      );

      if (existing) {
        existing.addEventListener(
          "load",
          () => {
            if (window.VideoReviewsCarouselApp) {
              resolve(window.VideoReviewsCarouselApp);
            } else {
              reject(
                new Error("Video reviews carousel app loaded but API missing.")
              );
            }
          },
          { once: true }
        );

        existing.addEventListener(
          "error",
          () =>
            reject(
              new Error("Failed to load video reviews carousel app script.")
            ),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.prvcAppScript = src;

      script.onload = () => {
        if (window.VideoReviewsCarouselApp) {
          resolve(window.VideoReviewsCarouselApp);
        } else {
          reject(
            new Error("Video reviews carousel app loaded but API missing.")
          );
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load video reviews carousel app script."));
      };

      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function bootRoot(root) {
    if (!root || root.dataset.prvcBooted === "true") return;
    root.dataset.prvcBooted = "true";

    const appScript = root.dataset.appScript || "";

    const start = () => {
      loadScriptOnce(appScript)
        .then((app) => {
          if (!app || typeof app.initRoot !== "function") {
            throw new Error("VideoReviewsCarouselApp.initRoot() missing.");
          }
          app.initRoot(root);
        })
        .catch((error) => {
          console.error("Video reviews carousel bootstrap error:", error);
        });
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.isIntersecting) return;
          observer.disconnect();
          start();
        },
        { rootMargin: "250px 0px" }
      );

      observer.observe(root);
      return;
    }

    start();
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".prvc-root"));
    if (!roots.length) return;
    roots.forEach(bootRoot);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initAll(document);
      },
      { once: true }
    );
  } else {
    initAll(document);
  }

  document.addEventListener("shopify:section:load", (event) => {
    initAll(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    initAll(event.target || document);
  });
})();
