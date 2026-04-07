(function () {
  const ROOT_SELECTOR = ".rsn-root";

  function getRoots(scope) {
    if (!scope || !scope.querySelectorAll) return [];
    return Array.from(scope.querySelectorAll(ROOT_SELECTOR));
  }

  function renderLoadError(scope) {
    getRoots(scope).forEach((root) => {
      root.innerHTML = `
        <div class="rsn-shell">
          <div class="rsn-slider">
            <div class="rsn-card-wrap">
              <div class="rsn-card rsn-card--empty">
                <div class="rsn-card-inner" style="text-align:center;align-items:center;">
                  <p class="rsn-empty-text">Failed to load review snippets widget.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });
  }

  function loadMainScript(src) {
    if (!src) {
      return Promise.reject(new Error("Missing main script source"));
    }

    if (window.ReviewSnippetsMain && typeof window.ReviewSnippetsMain.initAll === "function") {
      return Promise.resolve();
    }

    window.__reviewSnippetsScriptPromises = window.__reviewSnippetsScriptPromises || {};

    if (window.__reviewSnippetsScriptPromises[src]) {
      return window.__reviewSnippetsScriptPromises[src];
    }

    window.__reviewSnippetsScriptPromises[src] = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-rsn-main-script="${src}"]`);

      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }

        const onLoad = () => {
          existing.dataset.loaded = "true";
          cleanup();
          resolve();
        };

        const onError = () => {
          cleanup();
          reject(new Error("Failed to load main snippets script"));
        };

        const cleanup = () => {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
        };

        existing.addEventListener("load", onLoad);
        existing.addEventListener("error", onError);
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

      script.onerror = () => {
        reject(new Error("Failed to load main snippets script"));
      };

      document.head.appendChild(script);
    }).catch((error) => {
      delete window.__reviewSnippetsScriptPromises[src];
      throw error;
    });

    return window.__reviewSnippetsScriptPromises[src];
  }

  function boot(scope) {
    const roots = getRoots(scope);
    if (!roots.length) return;

    const firstRootWithScript = roots.find((root) => root.dataset.mainScript);
    const mainScript = firstRootWithScript ? firstRootWithScript.dataset.mainScript : "";

    if (!mainScript) {
      renderLoadError(scope);
      return;
    }

    loadMainScript(mainScript)
      .then(() => {
        if (window.ReviewSnippetsMain && typeof window.ReviewSnippetsMain.initAll === "function") {
          window.ReviewSnippetsMain.initAll(scope || document);
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

  document.addEventListener("shopify:section:load", (event) => {
    boot(event.target || document);
  });

  document.addEventListener("shopify:section:reorder", (event) => {
    boot(event.target || document);
  });

  document.addEventListener("shopify:block:select", (event) => {
    boot(event.target || document);
  });

  document.addEventListener("shopify:block:deselect", (event) => {
    boot(event.target || document);
  });
})();
