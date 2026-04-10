(function () {
  const ROOT_SELECTOR =
    ".pr-star-rating-badge-root, .pr-collection-star-rating-badges-root";
  const loadedScripts = new Map();
  let mutationObserver = null;
  let initTimer = null;

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
      const existing = Array.from(document.scripts).find(
        (script) => script.dataset.prsbAppScript === src
      );

      if (existing) {
        const resolveExisting = () => {
          if (window.StarRatingBadgeApp) {
            resolve(window.StarRatingBadgeApp);
          } else {
            reject(new Error("Star rating badge app loaded but API missing."));
          }
        };

        if (existing.dataset.loaded === "true" && window.StarRatingBadgeApp) {
          resolveExisting();
          return;
        }

        existing.addEventListener("load", resolveExisting, { once: true });
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
        script.dataset.loaded = "true";
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

    const fallbackRoot = document.querySelector(
      `${ROOT_SELECTOR}[data-app-script]`
    );
    if (fallbackRoot?.dataset?.appScript) return fallbackRoot.dataset.appScript;

    const extensionAsset = document.querySelector(
      'script[src*="star-rating-badge-main.js"]'
    );
    return extensionAsset?.src || "";
  }

  function startRoot(root) {
    const appScript = getAppScript(root);

    loadScriptOnce(appScript)
      .then((app) => {
        if (!app || typeof app.initRoot !== "function") {
          throw new Error("StarRatingBadgeApp.initRoot() missing.");
        }
        return app.initRoot(root);
      })
      .catch((error) => {
        console.error("Star rating badge bootstrap error:", error);
        root.dataset.prsbBooted = "error";
      });
  }

  function bootRoot(root) {
    if (!root || root.dataset.prsbBooted === "true") return;
    root.dataset.prsbBooted = "true";

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry || !entry.isIntersecting) return;
          observer.disconnect();
          startRoot(root);
        },
        { rootMargin: "300px 0px" }
      );

      observer.observe(root);
      return;
    }

    startRoot(root);
  }

  function initAll(scope = document) {
    const container = scope || document;
    const roots = Array.from(container.querySelectorAll(ROOT_SELECTOR));
    if (!roots.length) return;
    roots.forEach(bootRoot);
  }

  function scheduleInit(scope = document) {
    window.clearTimeout(initTimer);
    initTimer = window.setTimeout(() => {
      initAll(scope);
      if (
        window.StarRatingBadgeApp &&
        typeof window.StarRatingBadgeApp.initAll === "function"
      ) {
        window.StarRatingBadgeApp.initAll(scope).catch?.(() => {});
      }
    }, 80);
  }

  function watchDomChanges() {
    if (mutationObserver || !("MutationObserver" in window)) return;

    mutationObserver = new MutationObserver((mutations) => {
      let shouldInit = false;

      for (const mutation of mutations) {
        if (mutation.type !== "childList" || !mutation.addedNodes.length) {
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;

          if (
            node.matches?.(ROOT_SELECTOR) ||
            node.querySelector?.(ROOT_SELECTOR) ||
            node.querySelector?.('a[href*="/products/"]')
          ) {
            shouldInit = true;
            break;
          }
        }

        if (shouldInit) break;
      }

      if (shouldInit) {
        scheduleInit(document);
      }
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        initAll(document);
        watchDomChanges();
      },
      { once: true }
    );
  } else {
    initAll(document);
    watchDomChanges();
  }

  document.addEventListener("shopify:section:load", (event) => {
    scheduleInit(event.target || document);
  });

  document.addEventListener("shopify:section:reorder", (event) => {
    scheduleInit(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    scheduleInit(event.target || document);
  });

  document.addEventListener("shopify:block:deselect", (event) => {
    scheduleInit(event.target || document);
  });
})();
