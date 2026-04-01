(function (window, document) {
  if (window.ProductLoyaltyApp) return;

  function safeText(value) {
    return value === null || value === undefined ? "" : String(value);
  }

  function escapeHtml(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function createProductLoyaltyController(root) {
    const shop = root.dataset.shop || "";
    const endpoint = root.dataset.endpoint || "";
    const customerId = root.dataset.customerId || "";
    const initialCustomerEmail = root.dataset.customerEmail || "";
    const firstName = root.dataset.customerFirstName || "";
    const lastName = root.dataset.customerLastName || "";

    const authBlock = root.querySelector("#pl-auth-block");
    const dashboard = root.querySelector("#pl-dashboard");
    const joinBtn = root.querySelector("#pl-join-btn");
    const emailInput = root.querySelector("#pl-email");
    const messageEl = root.querySelector("#pl-message");

    const pointsEl = root.querySelector("#pl-points");
    const tierEl = root.querySelector("#pl-tier");
    const referralCodeEl = root.querySelector("#pl-referral-code");
    const referralLinkEl = root.querySelector("#pl-referral-link");
    const copyReferralBtn = root.querySelector("#pl-copy-referral-btn");
    const rewardListEl = root.querySelector("#pl-reward-list");
    const redemptionListEl = root.querySelector("#pl-redemption-list");

    const referralEmailInput = root.querySelector("#pl-referral-email");
    const sendReferralBtn = root.querySelector("#pl-send-referral-btn");

    if (!endpoint || !shop) return null;

    function getSessionId() {
      const key = `pl_session_${shop}`;
      let existing = localStorage.getItem(key);

      if (!existing) {
        existing = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(key, existing);
      }

      return existing;
    }

    const sessionId = getSessionId();

    function getActiveEmail() {
      const typed = emailInput?.value?.trim() || "";
      return typed || initialCustomerEmail || "";
    }

    function getOwnerParams() {
      return {
        shop,
        customerId,
        customerEmail: getActiveEmail(),
        sessionId,
      };
    }

    function setMessage(message, type = "success") {
      if (!messageEl) return;
      messageEl.className = `pl-message pl-message--${type}`;
      messageEl.textContent = message;
    }

    function captureReferralCodeFromUrl() {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");

      if (ref) {
        localStorage.setItem(`pl_ref_${shop}`, ref);
      }
    }

    function getSavedReferralCode() {
      return localStorage.getItem(`pl_ref_${shop}`) || "";
    }

    function injectReferralPropertyToCartForms() {
      const ref = getSavedReferralCode();
      if (!ref) return;

      const forms = Array.from(
        document.querySelectorAll('form[action*="/cart/add"]')
      );

      forms.forEach((form) => {
        let hidden = form.querySelector(
          'input[name="properties[_loyalty_referral_code]"]'
        );

        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "properties[_loyalty_referral_code]";
          form.appendChild(hidden);
        }

        hidden.value = ref;
      });
    }

    async function postJson(payload) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      return { response, result };
    }

    function renderRewards(rewards = [], customer = null) {
      if (!rewardListEl) return;

      if (!rewards.length) {
        rewardListEl.innerHTML =
          `<div class="pl-history-item">No rewards available right now.</div>`;
        return;
      }

      rewardListEl.innerHTML = rewards
        .map((reward) => {
          const title = escapeHtml(reward.title || "");
          const rewardKey = escapeHtml(reward.key || "");
          const pointsCost = Number(reward.pointsCost || 0);
          const canRedeem =
            customer && Number(customer.pointsBalance || 0) >= pointsCost;

          return `
            <div class="pl-reward-item">
              <div class="pl-reward-top">
                <div>
                  <div class="pl-reward-title">${title}</div>
                  <div class="pl-reward-subtitle">${pointsCost} points required</div>
                </div>
                <button
                  type="button"
                  class="pl-primary-btn pl-redeem-btn"
                  data-reward-key="${rewardKey}"
                  ${canRedeem ? "" : "disabled"}
                >
                  Redeem
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      const buttons = Array.from(root.querySelectorAll(".pl-redeem-btn"));

      buttons.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const rewardKey = btn.getAttribute("data-reward-key");
          if (!rewardKey) return;

          btn.disabled = true;

          try {
            const { response, result } = await postJson({
              action: "redeemReward",
              rewardKey,
              ...getOwnerParams(),
            });

            if (!response.ok || !result.success) {
              setMessage(result.message || "Reward redemption failed", "error");
              return;
            }

            const code = result?.data?.redemption?.rewardCode || "";
            setMessage(
              code
                ? `Reward redeemed! Your coupon code is ${code}`
                : "Reward redeemed successfully",
              "success"
            );

            await loadStatus();
          } catch (error) {
            console.error(error);
            setMessage("Something went wrong", "error");
          } finally {
            btn.disabled = false;
          }
        });
      });
    }

    function renderRedemptions(items = []) {
      if (!redemptionListEl) return;

      if (!items.length) {
        redemptionListEl.innerHTML =
          `<div class="pl-history-item">No reward history yet.</div>`;
        return;
      }

      redemptionListEl.innerHTML = items
        .map((item) => {
          const rewardTitle = escapeHtml(item.rewardTitle || "");
          const rewardCode = escapeHtml(item.rewardCode || "-");
          const pointsUsed = escapeHtml(item.pointsUsed || "0");

          return `
            <div class="pl-history-item">
              <strong>${rewardTitle}</strong><br>
              Code: ${rewardCode}<br>
              Points: ${pointsUsed}
            </div>
          `;
        })
        .join("");
    }

    function updateDashboard(data) {
      const customer = data?.customer || null;
      const rewards = data?.rewards || [];
      const redemptions = data?.redemptions || [];

      if (!customer) {
        authBlock?.removeAttribute("hidden");
        dashboard?.setAttribute("hidden", "hidden");
        return;
      }

      authBlock?.setAttribute("hidden", "hidden");
      dashboard?.removeAttribute("hidden");

      if (pointsEl) pointsEl.textContent = String(customer.pointsBalance || 0);
      if (tierEl) tierEl.textContent = String(customer.tier || "bronze");
      if (referralCodeEl) {
        referralCodeEl.textContent = String(customer.referralCode || "-");
      }

      if (referralLinkEl) {
        const code = String(customer.referralCode || "");
        referralLinkEl.value = code
          ? `${window.location.origin}${window.location.pathname}?ref=${code}`
          : "";
      }

      renderRewards(rewards, customer);
      renderRedemptions(redemptions);
    }

    async function loadStatus() {
      try {
        const params = new URLSearchParams({
          action: "status",
          shop,
          customerId,
          customerEmail: getActiveEmail(),
          sessionId,
        });

        const response = await fetch(`${endpoint}?${params.toString()}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setMessage(result.message || "Failed to load loyalty data", "error");
          return;
        }

        updateDashboard(result.data);
      } catch (error) {
        console.error(error);
        setMessage("Failed to load loyalty data", "error");
      }
    }

    function bindEvents() {
      joinBtn?.addEventListener("click", async () => {
        const email = getActiveEmail();

        if (!email) {
          setMessage("Email is required to join loyalty program", "error");
          return;
        }

        if (!isValidEmail(email)) {
          setMessage("Please enter a valid email", "error");
          return;
        }

        try {
          const { response, result } = await postJson({
            action: "join",
            shop,
            customerId,
            customerEmail: email,
            sessionId,
            firstName,
            lastName,
            referredByCode: getSavedReferralCode(),
          });

          if (!response.ok || !result.success) {
            setMessage(result.message || "Failed to join loyalty program", "error");
            return;
          }

          setMessage("You joined the loyalty program successfully", "success");
          await loadStatus();
        } catch (error) {
          console.error(error);
          setMessage("Something went wrong", "error");
        }
      });

      copyReferralBtn?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(referralLinkEl?.value || "");
          setMessage("Referral link copied", "success");
        } catch (error) {
          console.error(error);
          setMessage("Failed to copy referral link", "error");
        }
      });

      sendReferralBtn?.addEventListener("click", async () => {
        const referredEmail = referralEmailInput?.value?.trim() || "";

        if (!referredEmail) {
          setMessage("Friend email is required", "error");
          return;
        }

        if (!isValidEmail(referredEmail)) {
          setMessage("Please enter a valid friend email", "error");
          return;
        }

        try {
          const { response, result } = await postJson({
            action: "createReferralInvite",
            shop,
            customerId,
            customerEmail: getActiveEmail(),
            sessionId,
            referredEmail,
          });

          if (!response.ok || !result.success) {
            setMessage(result.message || "Failed to save referral", "error");
            return;
          }

          setMessage("Referral invite saved successfully", "success");

          if (referralEmailInput) {
            referralEmailInput.value = "";
          }
        } catch (error) {
          console.error(error);
          setMessage("Something went wrong", "error");
        }
      });
    }

    async function init() {
      bindEvents();
      captureReferralCodeFromUrl();
      injectReferralPropertyToCartForms();
      await loadStatus();
    }

    return { init };
  }

  function initRoot(root) {
    if (!root || root.dataset.initialized === "true") return;

    const controller = createProductLoyaltyController(root);
    if (!controller) return;

    root.dataset.initialized = "true";
    controller.init();
  }

  function initAll(scope = document) {
    const roots = Array.from((scope || document).querySelectorAll(".pl-root"));
    if (!roots.length) return;

    roots.forEach((root) => {
      initRoot(root);
    });
  }

  window.ProductLoyaltyApp = {
    initRoot,
    initAll,
  };
})(window, document);
