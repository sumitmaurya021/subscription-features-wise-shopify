(function () {
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(new Error("Popup reviews app script URL missing."));
    }

    if (window.PopupReviewsApp) {
      return Promise.resolve(window.PopupReviewsApp);
    }

    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll("script")).find(
        (script) => script.dataset.prpAppScript === src
      );

      if (existing) {
        existing.addEventListener(
          "load",
          () => {
            if (window.PopupReviewsApp) {
              resolve(window.PopupReviewsApp);
            } else {
              reject(new Error("Popup reviews app loaded but API missing."));
            }
          },
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load popup reviews app script.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.prpAppScript = src;

      script.onload = () => {
        if (window.PopupReviewsApp) {
          resolve(window.PopupReviewsApp);
        } else {
          reject(new Error("Popup reviews app loaded but API missing."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load popup reviews app script."));
      };

      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function initScope(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".prp-root"));
    if (!roots.length) return;

    const scriptUrl =
      roots.find((root) => root.dataset.appScript)?.dataset.appScript || "";

    if (!scriptUrl) {
      console.error("Popup reviews bootstrap error: missing data-app-script.");
      return;
    }

    loadScriptOnce(scriptUrl)
      .then((app) => {
        if (!app || typeof app.initAll !== "function") {
          throw new Error("PopupReviewsApp.initAll() missing.");
        }
        app.initAll(scope || document);
      })
      .catch((error) => {
        console.error("Popup reviews bootstrap error:", error);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initScope(document);
      },
      { once: true }
    );
  } else {
    initScope(document);
  }

  document.addEventListener("shopify:section:load", (event) => {
    initScope(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    initScope(event.target || document);
  });
})();
