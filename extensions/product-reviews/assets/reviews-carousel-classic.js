(function () {
  const ROOT_SELECTOR = ".rcc-root";
  const GLOBAL_PROMISE_KEY = "__reviewsCarouselClassicMainPromise";
  const GLOBAL_READY_KEY = "ReviewsCarouselClassicMain";

  function getRoots(scope) {
    if (!scope || !scope.querySelectorAll) return [];
    return Array.from(scope.querySelectorAll(ROOT_SELECTOR));
  }

  function renderLoadError(scope) {
    const roots = getRoots(scope);

    roots.forEach((root) => {
      const loadingText = root.dataset.loadingText || "Failed to load reviews";

      root.innerHTML = `
        <div class="rcc-widget rcc-widget--error">
          <div class="rcc-shell" style="width:${escapeAttribute(
            root.dataset.pageWidth || "80"
          )}%;">
            <div class="rcc-error-box" role="alert">
              ${escapeHtml(loadingText === "Loading reviews..." ? "Failed to load reviews" : loadingText)}
            </div>
          </div>
        </div>
      `;
    });
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/"/g, "&quot;");
  }

  function isMainReady() {
    return Boolean(
      window[GLOBAL_READY_KEY] &&
        typeof window[GLOBAL_READY_KEY].initAll === "function"
    );
  }

  function findExistingScript(src) {
    if (!src) return null;

    const scripts = Array.from(document.querySelectorAll("script[src]"));
    return (
      scripts.find((script) => {
        try {
          return script.src === src;
        } catch {
          return false;
        }
      }) || null
    );
  }

  function loadMainScript(src) {
    if (!src) {
      return Promise.reject(new Error("Main script URL is missing."));
    }

    if (isMainReady()) {
      return Promise.resolve();
    }

    if (window[GLOBAL_PROMISE_KEY]) {
      return window[GLOBAL_PROMISE_KEY];
    }

    const existingScript = findExistingScript(src);

    if (existingScript) {
      window[GLOBAL_PROMISE_KEY] = new Promise((resolve, reject) => {
        if (isMainReady()) {
          resolve();
          return;
        }

        existingScript.addEventListener("load", function handleLoad() {
          if (isMainReady()) resolve();
          else reject(new Error("Main script loaded but init API not found."));
        });

        existingScript.addEventListener("error", function handleError() {
          reject(new Error("Failed to load main script."));
        });
      });

      return window[GLOBAL_PROMISE_KEY];
    }

    window[GLOBAL_PROMISE_KEY] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-rcc-main", "true");

      script.onload = function () {
        if (isMainReady()) {
          resolve();
        } else {
          reject(new Error("Main script loaded but init API not found."));
        }
      };

      script.onerror = function () {
        reject(new Error("Failed to load main script."));
      };

      document.head.appendChild(script);
    });

    return window[GLOBAL_PROMISE_KEY];
  }

  function boot(scope) {
    const roots = getRoots(scope);

    if (!roots.length) return;

    const firstRoot = roots[0];
    const mainScript = firstRoot.dataset.mainScript || "";

    if (!mainScript) {
      renderLoadError(scope);
      return;
    }

    loadMainScript(mainScript)
      .then(function () {
        if (
          window[GLOBAL_READY_KEY] &&
          typeof window[GLOBAL_READY_KEY].initAll === "function"
        ) {
          window[GLOBAL_READY_KEY].initAll(scope);
          return;
        }

        renderLoadError(scope);
      })
      .catch(function () {
        renderLoadError(scope);
      });
  }

  function bootDocument() {
    boot(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootDocument);
  } else {
    bootDocument();
  }

  document.addEventListener("shopify:section:load", function (event) {
    boot(event.target || document);
  });

  document.addEventListener("shopify:section:reorder", function (event) {
    boot(event.target || document);
  });

  document.addEventListener("shopify:block:select", function (event) {
    boot(event.target || document);
  });

  document.addEventListener("shopify:block:deselect", function (event) {
    boot(event.target || document);
  });
})();
