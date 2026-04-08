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
      const existingScript = Array.from(document.scripts).find(
        (script) => script.dataset.prvcAppScript === src
      );

      const resolveApp = () => {
        if (window.VideoReviewsCarouselApp) {
          resolve(window.VideoReviewsCarouselApp);
        } else {
          reject(
            new Error("Video reviews carousel app loaded but API missing.")
          );
        }
      };

      if (existingScript) {
        if (existingScript.dataset.loaded === "true") {
          resolveApp();
          return;
        }

        existingScript.addEventListener("load", resolveApp, { once: true });
        existingScript.addEventListener(
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
        script.dataset.loaded = "true";
        resolveApp();
      };

      script.onerror = () => {
        reject(new Error("Failed to load video reviews carousel app script."));
      };

      document.head.appendChild(script);
    }).catch((error) => {
      loadedScripts.delete(src);
      throw error;
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function startRoot(root) {
    if (!root) return;
    if (root.dataset.prvcBooted === "true") return;

    root.dataset.prvcBooted = "true";

    const appScript = root.dataset.appScript || "";

    loadScriptOnce(appScript)
      .then((app) => {
        if (!app || typeof app.initRoot !== "function") {
          throw new Error("VideoReviewsCarouselApp.initRoot() missing.");
        }
        app.initRoot(root);
      })
      .catch((error) => {
        root.dataset.prvcBooted = "false";
        console.error("Video reviews carousel bootstrap error:", error);
      });
  }

  function observeRoot(root) {
    if (!root || root.dataset.prvcObserved === "true") return;

    root.dataset.prvcObserved = "true";

    if (!("IntersectionObserver" in window)) {
      startRoot(root);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        observer.disconnect();
        startRoot(root);
      },
      { rootMargin: "250px 0px" }
    );

    observer.observe(root);
  }

  function initAll(scope) {
    const context = scope || document;
    const roots = Array.from(context.querySelectorAll(".prvc-root"));
    if (!roots.length) return;

    roots.forEach(observeRoot);
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
