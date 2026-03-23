document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("product-wishlist-root");
  if (!root) return;

  const productId = root.dataset.productId || "";
  const productTitle = root.dataset.productTitle || "";
  const productHandle = root.dataset.productHandle || "";
  const productUrl = root.dataset.productUrl || "";
  const productImage = root.dataset.productImage || "";
  const variantId = root.dataset.variantId || "";
  const shop = root.dataset.shop || "";
  const endpoint = root.dataset.endpoint || "";
  const isAvailable = String(root.dataset.available || "") === "true";

  const toggleBtn = root.querySelector("#pw-toggle-btn");
  const countEl = root.querySelector("#pw-count");
  const form = root.querySelector("#pw-back-in-stock-form");
  const messageEl = root.querySelector("#pw-message");

  function getSessionId() {
    const key = `pw_session_${shop}`;
    let existing = localStorage.getItem(key);

    if (!existing) {
      existing = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, existing);
    }

    return existing;
  }

  const sessionId = getSessionId();

  function setMessage(message, type = "success") {
    if (!messageEl) return;
    messageEl.className = `pw-message pw-message--${type}`;
    messageEl.textContent = message;
  }

  function updateWishlistButton(isWishlisted) {
    if (!toggleBtn) return;

    toggleBtn.dataset.active = isWishlisted ? "true" : "false";
    toggleBtn.textContent = isWishlisted ? "♥ Saved in Wishlist" : "♡ Save to Wishlist";
  }

  function updateCount(value) {
    if (!countEl) return;
    const count = Number(value || 0);
    countEl.textContent = `${count} save${count === 1 ? "" : "s"}`;
  }

  async function loadStatus(customerEmail = "") {
    try {
      const params = new URLSearchParams({
        action: "status",
        shop,
        productId,
        variantId,
        sessionId,
      });

      if (customerEmail) {
        params.set("customerEmail", customerEmail);
      }

      const response = await fetch(`${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) return;

      updateWishlistButton(Boolean(result.data?.isWishlisted));
      updateCount(result.data?.wishlistCount || 0);

      if (result.data?.backInStockSubscribed && messageEl && !isAvailable) {
        setMessage("You are already subscribed for stock alerts.", "success");
      }
    } catch (error) {
      console.error("Wishlist status error:", error);
    }
  }

  toggleBtn?.addEventListener("click", async () => {
    toggleBtn.disabled = true;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "toggleWishlist",
          shop,
          productId,
          variantId,
          productTitle,
          productHandle,
          productImage,
          productUrl,
          sessionId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || "Wishlist action failed", "error");
        return;
      }

      const added = result.action === "added";
      updateWishlistButton(added);
      updateCount(result.wishlistCount || 0);
      setMessage(result.message || "Wishlist updated", "success");
    } catch (error) {
      console.error("Toggle wishlist error:", error);
      setMessage("Something went wrong", "error");
    } finally {
      toggleBtn.disabled = false;
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const customerName = formData.get("customerName")?.toString().trim() || "";
    const customerEmail = formData.get("customerEmail")?.toString().trim() || "";

    if (!customerEmail) {
      setMessage("Email is required", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      setMessage("Please enter a valid email", "error");
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "subscribeBackInStock",
          shop,
          productId,
          variantId,
          productTitle,
          productHandle,
          productImage,
          productUrl,
          customerName,
          customerEmail,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setMessage(result.message || "Subscription failed", "error");
        return;
      }

      setMessage(result.message || "Subscribed successfully", "success");
      form.reset();
      await loadStatus(customerEmail);
    } catch (error) {
      console.error("Back in stock subscribe error:", error);
      setMessage("Something went wrong", "error");
    }
  });

  await loadStatus();
});
