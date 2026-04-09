(function () {
  const loadedScripts = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(
        new Error("Floating reviews tab app script URL missing.")
      );
    }

    if (window.FloatingReviewsTabApp) {
      return Promise.resolve(window.FloatingReviewsTabApp);
    }

    if (loadedScripts.has(src)) {
      return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll("script")).find(
        (script) => script.dataset.frtAppScript === src
      );

      if (existing) {
        if (window.FloatingReviewsTabApp) {
          resolve(window.FloatingReviewsTabApp);
          return;
        }

        existing.addEventListener(
          "load",
          () => {
            if (window.FloatingReviewsTabApp) {
              resolve(window.FloatingReviewsTabApp);
            } else {
              reject(new Error("Floating reviews tab app loaded but API missing."));
            }
          },
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(new Error("Failed to load floating reviews tab app script.")),
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.frtAppScript = src;

      script.onload = () => {
        if (window.FloatingReviewsTabApp) {
          resolve(window.FloatingReviewsTabApp);
        } else {
          reject(new Error("Floating reviews tab app loaded but API missing."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load floating reviews tab app script."));
      };

      document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
  }

  function bootRoot(root) {
    if (!root || root.dataset.frtBooted === "true") return;
    root.dataset.frtBooted = "true";

    const appScript = root.dataset.appScript || "";

    loadScriptOnce(appScript)
      .then((app) => {
        if (!app || typeof app.initRoot !== "function") {
          throw new Error("FloatingReviewsTabApp.initRoot() missing.");
        }
        app.initRoot(root);
      })
      .catch((error) => {
        console.error("Floating reviews tab bootstrap error:", error);
      });
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".frt-root"));
    if (!roots.length) return;
    roots.forEach(bootRoot);
  }

  function observeLateRoots() {
    if (window.__frtObserverStarted) return;
    window.__frtObserverStarted = true;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node.matches && node.matches(".frt-root")) {
            bootRoot(node);
            return;
          }

          if (node.querySelectorAll) {
            initAll(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function start() {
    initAll(document);
    observeLateRoots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.addEventListener("pageshow", () => {
    initAll(document);
  });

  document.addEventListener("shopify:section:load", (event) => {
    initAll(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    initAll(event.target || document);
  });

  document.addEventListener("shopify:section:reorder", () => {
    initAll(document);
  });
})();
