(function () {
  const ROOT_SELECTOR = ".rsn-root";

  function renderLoadError(scope) {
    const roots = Array.from(scope.querySelectorAll(ROOT_SELECTOR));

    roots.forEach((root) => {
      root.innerHTML = `
        <div class="rsn-preview-wrap">
          <div class="rsn-preview-card" style="min-height: 180px; display:flex; align-items:center; justify-content:center; text-align:center;">
            <p style="margin:0; font-size:16px; line-height:1.5;">
              Failed to load review snippets widget.
            </p>
          </div>
        </div>
      `;
    });
  }

  function loadMainScript(src) {
    if (window.ReviewSnippetsMain) {
      return Promise.resolve();
    }

    if (window.__reviewSnippetsMainPromise) {
      return window.__reviewSnippetsMainPromise;
    }

    window.__reviewSnippetsMainPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        `script[data-rsn-main-script="${src}"]`
      );

      if (existingScript) {
        if (existingScript.dataset.loaded === "true") {
          resolve();
          return;
        }

        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.rsnMainScript = src;

      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };

      script.onerror = () => reject(new Error("Failed to load main snippets script"));

      document.head.appendChild(script);
    });

    return window.__reviewSnippetsMainPromise;
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
        if (window.ReviewSnippetsMain?.initAll) {
          window.ReviewSnippetsMain.initAll(scope);
        } else {
          renderLoadError(scope);
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

  document.addEventListener("shopify:block:select", function (event) {
    boot(event.target || document);
  });
})();
