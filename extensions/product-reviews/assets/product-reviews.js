(function () {
  const ROOT_SELECTOR = "#product-reviews-root";

  function renderLoadError(scope) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));
    roots.forEach((root) => {
      root.innerHTML = `
        <div class="pr-widget">
          <div class="pr-shell">
            <div class="pr-error-box">Failed to load review widget.</div>
          </div>
        </div>
      `;
    });
  }

  function loadMainScript(src) {
    if (window.ProductReviewsMain) return Promise.resolve();

    if (window.__productReviewsMainPromise) {
      return window.__productReviewsMainPromise;
    }

    window.__productReviewsMainPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return window.__productReviewsMainPromise;
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
      .then(() => {
        if (window.ProductReviewsMain?.initAll) {
          window.ProductReviewsMain.initAll(scope);
        }
      })
      .catch(() => {
        renderLoadError(scope);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot(document);
    });
  } else {
    boot(document);
  }

  document.addEventListener("shopify:section:load", function (event) {
    boot(event.target || document);
  });
})();
