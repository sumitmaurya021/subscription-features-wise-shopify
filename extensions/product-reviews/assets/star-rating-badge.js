(function () {
  const ROOT_SELECTOR =
    ".pr-star-rating-badge-root, .pr-collection-star-rating-badges-root";
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(
        new Error("Star rating badge app script URL missing.")
      );
    }

    if (window.StarRatingBadgeApp) {
      return Promise.resolve(window.StarRatingBadgeApp);
    }

    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll("script")).find(
        (script) => script.dataset.prsbAppScript === src
      );

      if (existing) {
        existing.addEventListener(
          "load",
          () => {
            if (window.StarRatingBadgeApp) {
              resolve(window.StarRatingBadgeApp);
            } else {
              reject(new Error("Star rating badge app loaded but API missing."));
            }
          },
          { once: true }
        );

        existing.addEventListener(
          "error",
          () =>
            reject(new Error("Failed to load star rating badge app script.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.prsbAppScript = src;

      script.onload = () => {
        if (window.StarRatingBadgeApp) {
          resolve(window.StarRatingBadgeApp);
        } else {
          reject(new Error("Star rating badge app loaded but API missing."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load star rating badge app script."));
      };

      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function getAppScript(root) {
    if (root?.dataset?.appScript) return root.dataset.appScript;

    const fallbackRoot = document.querySelector(`${ROOT_SELECTOR}[data-app-script]`);
    return fallbackRoot?.dataset?.appScript || "";
  }

  function bootRoot(root) {
    if (!root || root.dataset.prsbBooted === "true") return;
    root.dataset.prsbBooted = "true";

    const appScript = getAppScript(root);

    const start = () => {
      loadScriptOnce(appScript)
        .then((app) => {
          if (!app || typeof app.initRoot !== "function") {
            throw new Error("StarRatingBadgeApp.initRoot() missing.");
          }
          app.initRoot(root);
        })
        .catch((error) => {
          console.error("Star rating badge bootstrap error:", error);
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
    const roots = Array.from((scope || document).querySelectorAll(ROOT_SELECTOR));
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
