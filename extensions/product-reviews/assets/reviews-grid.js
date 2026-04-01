(function () {
  const ROOT_SELECTOR = ".rg-root";

  function renderLoadError(scope) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));

    roots.forEach((root) => {
      root.innerHTML = `
        <div class="rg-shell">
          <div class="rg-error-box">
            Failed to load reviews grid widget.
          </div>
        </div>
      `;
    });
  }

  function loadMainScript(src) {
    if (window.ReviewsGridMain) {
      return Promise.resolve(window.ReviewsGridMain);
    }

    if (window.__reviewsGridMainPromise) {
      return window.__reviewsGridMainPromise;
    }

    window.__reviewsGridMainPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[data-reviews-grid-main="true"]'
      );

      if (existingScript) {
        if (window.ReviewsGridMain) {
          resolve(window.ReviewsGridMain);
          return;
        }

        existingScript.addEventListener("load", function handleLoad() {
          existingScript.removeEventListener("load", handleLoad);
          if (window.ReviewsGridMain) {
            resolve(window.ReviewsGridMain);
          } else {
            reject(new Error("Reviews grid main script loaded but module not found."));
          }
        });

        existingScript.addEventListener("error", function handleError() {
          existingScript.removeEventListener("error", handleError);
          reject(new Error("Failed to load reviews grid main script."));
        });

        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.reviewsGridMain = "true";

      script.onload = () => {
        if (window.ReviewsGridMain) {
          resolve(window.ReviewsGridMain);
        } else {
          reject(new Error("Reviews grid main script loaded but module not found."));
        }
      };

      script.onerror = () => {
        reject(new Error("Failed to load reviews grid main script."));
      };

      document.head.appendChild(script);
    });

    return window.__reviewsGridMainPromise;
  }

  function boot(scope) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));
    if (!roots.length) return;

    const firstRoot = roots[0];
    const mainScript = firstRoot.dataset.mainScript || "";

    if (!mainScript) {
      renderLoadError(scope);
      return;
    }

    loadMainScript(mainScript)
      .then((module) => {
        if (module && typeof module.initAll === "function") {
          module.initAll(scope);
        } else if (
          window.ReviewsGridMain &&
          typeof window.ReviewsGridMain.initAll === "function"
        ) {
          window.ReviewsGridMain.initAll(scope);
        } else {
          renderLoadError(scope);
        }
      })
      .catch(() => {
        renderLoadError(scope);
      });
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(() => {
    boot(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    boot(event.target || document);
  });

  document.addEventListener("shopify:block:select", function (event) {
    boot(event.target || document);
  });

  document.addEventListener("shopify:section:reorder", function () {
    boot(document);
  });
})();
