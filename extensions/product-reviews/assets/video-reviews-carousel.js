(function () {
  const scriptCache = new Map();

  function loadScriptOnce(src) {
    if (!src) {
      return Promise.reject(new Error("Carousel app script URL missing."));
    }

    if (window.PRVCApp && typeof window.PRVCApp.initRoot === "function") {
      return Promise.resolve(window.PRVCApp);
    }

    if (scriptCache.has(src)) {
      return scriptCache.get(src);
    }

    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts).find(function (script) {
        return script.dataset.prvcAppScript === src;
      });

      const resolveApp = function () {
        if (window.PRVCApp && typeof window.PRVCApp.initRoot === "function") {
          resolve(window.PRVCApp);
        } else {
          reject(new Error("Carousel app loaded but API missing."));
        }
      };

      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolveApp();
          return;
        }

        existing.addEventListener("load", resolveApp, { once: true });
        existing.addEventListener(
          "error",
          function () {
            reject(new Error("Failed to load carousel app script."));
          },
          { once: true }
        );
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset.prvcAppScript = src;

      script.onload = function () {
        script.dataset.loaded = "true";
        resolveApp();
      };

      script.onerror = function () {
        reject(new Error("Failed to load carousel app script."));
      };

      document.head.appendChild(script);
    }).catch(function (error) {
      scriptCache.delete(src);
      throw error;
    });

    scriptCache.set(src, promise);
    return promise;
  }

  function showBootstrapError(root) {
    if (!root) return;

    root.classList.remove("is-loading");

    const mount = root.querySelector("[data-prvc-mount]");
    if (!mount) return;

    mount.innerHTML =
      '<div class="prvc-shell">' +
      '<div class="prvc-empty"><p>Carousel load nahi ho paaya.</p></div>' +
      "</div>";
  }

  function bootRoot(root) {
    if (!root) return;
    if (root.dataset.prvcBooted === "true") return;

    root.dataset.prvcBooted = "true";
    root.classList.add("is-loading");

    loadScriptOnce(root.dataset.appScript || "")
      .then(function (app) {
        app.initRoot(root);
      })
.catch(function (error) {
  root.dataset.prvcBooted = "false";
  console.error("PRVC bootstrap error:", error);
  const mount = root.querySelector("[data-prvc-mount]");
  root.classList.remove("is-loading");
  if (mount) {
    mount.innerHTML =
      '<div class="prvc-shell"><div class="prvc-empty"><p>Carousel load nahi ho paaya. Error: ' +
      (error && error.message ? error.message : "Unknown") +
      "</p></div></div>";
  }
});
  }

  function observeRoot(root) {
    if (!root) return;
    if (root.dataset.prvcObserved === "true") return;

    root.dataset.prvcObserved = "true";

    if (!("IntersectionObserver" in window)) {
      bootRoot(root);
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        observer.disconnect();
        bootRoot(root);
      },
      { rootMargin: "250px 0px" }
    );

    observer.observe(root);
  }

  function initAll(scope) {
    const context = scope || document;
    const roots = context.querySelectorAll(".prvc-root");
    if (!roots.length) return;

    roots.forEach(function (root) {
      observeRoot(root);
    });
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(function () {
    initAll(document);
  });

  document.addEventListener("shopify:section:load", function (event) {
    initAll(event.target || document);
  });

  document.addEventListener("shopify:block:select", function (event) {
    initAll(event.target || document);
  });
})();
