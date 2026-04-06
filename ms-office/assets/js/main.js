// Read deployment values injected by the layout and fall back to the live API
// so the frontend still works if the config object is unavailable.
const API_URL =
  (window.SITE_CONFIG && window.SITE_CONFIG.orderApiUrl) ||
  "https://us-central1-ms-office-2e691.cloudfunctions.net/api/v1/orders";
//const API_URL = "http://127.0.0.1:5001/macbook-neo/us-central1/api/v1/orders";
const SITE_BASE_URL =
  (window.SITE_CONFIG && window.SITE_CONFIG.siteBaseUrl) || "";

// Cache the key page elements once so the rest of the script can focus on
// behavior instead of repeated DOM queries.
const form = document.getElementById("checkoutForm");
const statusEl = document.getElementById("formStatus");

const planSelect = form ? form.querySelector('[name="plan"]') : null;
const accountTypeSelect = form ? form.querySelector('[name="accountType"]') : null;
const paymentSelect = form ? form.querySelector('[name="paymentMethod"]') : null;
const setupMethodSelect = form ? form.querySelector('[name="setupMethod"]') : null;
const priceInput = form ? form.querySelector('[name="price"]') : null;

const fullNameInput = form ? form.querySelector('[name="fullName"]') : null;
const phoneInput = form ? form.querySelector('[name="phone"]') : null;
const emailInput = form ? form.querySelector('[name="email"]') : null;
const addressInput = form ? form.querySelector('[name="address"]') : null;
const notesInput = form ? form.querySelector('[name="notes"]') : null;

const summaryPlan = document.querySelector("[data-summary-plan]");
const summaryAccountType = document.querySelector("[data-summary-account-type]");
const summaryPrice = document.querySelector("[data-summary-price]");
const summaryPayment = document.querySelector("[data-summary-payment]");
const summarySetup = document.querySelector("[data-summary-setup]");

const PRICE_MAP = {
  "Office Monthly": "$1,500",
  "Office 6 Months": "$7,000",
  "Office Yearly": "$10,000"
};

const ALLOWED_PLANS = [
  "Office Monthly",
  "Office 6 Months",
  "Office Yearly"
];

const ALLOWED_ACCOUNT_TYPES = [
  "Business",
  "Personal",
  "Student",
  "Team"
];

const ALLOWED_PAYMENT_METHODS = [
  "Bank transfer",
  "MMG",
  "Cash at office"
];

const ALLOWED_SETUP_METHODS = [
  "Remote activation",
  "Email delivery",
  "WhatsApp assistance",
  "In-office setup"
];

// Keep the summary card aligned with the current form selections.
function syncSummary() {
  if (!form) return;

  const plan = planSelect && planSelect.value ? planSelect.value : "Office 6 Months";
  const accountType = accountTypeSelect && accountTypeSelect.value ? accountTypeSelect.value : "Business";
  const price = PRICE_MAP[plan] || "$7,000";
  const payment = paymentSelect && paymentSelect.value ? paymentSelect.value : "Choose at checkout";
  const setup = setupMethodSelect && setupMethodSelect.value ? setupMethodSelect.value : "Choose at checkout";

  if (summaryPlan) summaryPlan.textContent = plan;
  if (summaryAccountType) summaryAccountType.textContent = accountType;
  if (summaryPrice) summaryPrice.textContent = price;
  if (summaryPayment) summaryPayment.textContent = payment;
  if (summarySetup) summarySetup.textContent = setup;
  if (priceInput) priceInput.value = price;
}

// Central helper for the inline status message under the form.
function setStatus(message, type = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = type ? `form-status ${type}` : "form-status";
}

// Clear previous validation output before validating a fresh submission.
function clearFieldErrors() {
  if (!form) return;

  form.querySelectorAll(".field-error").forEach((el) => el.remove());
  form.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

// Render a field-specific error right next to the form control that failed.
function showFieldError(field, message) {
  if (!field) return;

  field.classList.add("has-error");

  const error = document.createElement("div");
  error.className = "field-error";
  error.textContent = message;

  const label = field.closest("label");
  if (label) {
    label.appendChild(error);
  } else {
    field.insertAdjacentElement("afterend", error);
  }
}

// Frontend validation mirrors backend rules so users get instant feedback.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

function validateForm(data) {
  const errors = {};

  if (!data.fullName || !data.fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  if (!data.phone || !data.phone.trim()) {
    errors.phone = "WhatsApp / phone number is required.";
  } else if (!isValidPhone(data.phone.trim())) {
    errors.phone = "Enter a valid phone number.";
  }

  if (!data.email || !data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!data.plan || !ALLOWED_PLANS.includes(data.plan)) {
    errors.plan = "Please choose a valid subscription plan.";
  }

  if (!data.accountType || !ALLOWED_ACCOUNT_TYPES.includes(data.accountType)) {
    errors.accountType = "Please choose a valid account type.";
  }

  if (!data.paymentMethod || !ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)) {
    errors.paymentMethod = "Please choose a payment method.";
  }

  if (!data.setupMethod || !ALLOWED_SETUP_METHODS.includes(data.setupMethod)) {
    errors.setupMethod = "Please choose a setup method.";
  }

  if (data.address && data.address.length > 120) {
    errors.address = "Address must be 120 characters or less.";
  }

  if (data.notes && data.notes.length > 500) {
    errors.notes = "Notes must be 500 characters or less.";
  }

  return errors;
}

// Checkout-page behavior runs only when the checkout form exists.
if (form) {
  syncSummary();

  // Update the summary whenever the visitor changes a selection field.
  [planSelect, accountTypeSelect, paymentSelect, setupMethodSelect].forEach((element) => {
    if (element) element.addEventListener("change", syncSummary);
  });

  // Pricing cards preselect the matching plan and scroll the visitor to the form.
  document.querySelectorAll(".product-select").forEach((button) => {
    button.addEventListener("click", () => {
      const plan = button.dataset.plan;
      if (planSelect) planSelect.value = plan;
      syncSummary();

      const checkout = document.getElementById("checkout");
      if (checkout) {
        checkout.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Submit the trimmed form payload to the Firebase function after validation.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearFieldErrors();
    syncSummary();

    const rawData = Object.fromEntries(new FormData(form).entries());

    const data = {
      fullName: rawData.fullName ? rawData.fullName.trim() : "",
      phone: rawData.phone ? rawData.phone.trim() : "",
      email: rawData.email ? rawData.email.trim() : "",
      address: rawData.address ? rawData.address.trim() : "",
      plan: rawData.plan ? rawData.plan.trim() : "",
      accountType: rawData.accountType ? rawData.accountType.trim() : "",
      paymentMethod: rawData.paymentMethod ? rawData.paymentMethod.trim() : "",
      setupMethod: rawData.setupMethod ? rawData.setupMethod.trim() : "",
      notes: rawData.notes ? rawData.notes.trim() : ""
    };

    const errors = validateForm(data);

    if (Object.keys(errors).length > 0) {
      if (errors.fullName) showFieldError(fullNameInput, errors.fullName);
      if (errors.phone) showFieldError(phoneInput, errors.phone);
      if (errors.email) showFieldError(emailInput, errors.email);
      if (errors.address) showFieldError(addressInput, errors.address);
      if (errors.plan) showFieldError(planSelect, errors.plan);
      if (errors.accountType) showFieldError(accountTypeSelect, errors.accountType);
      if (errors.paymentMethod) showFieldError(paymentSelect, errors.paymentMethod);
      if (errors.setupMethod) showFieldError(setupMethodSelect, errors.setupMethod);
      if (errors.notes) showFieldError(notesInput, errors.notes);

      setStatus("Please fix the highlighted fields and try again.", "error");
      return;
    }

    setStatus("Submitting subscription request...");

    try {
      // The backend remains the final validator, but the browser only sends the
      // fields the API expects.
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        const message =
          result.error ||
          (Array.isArray(result.errors) ? result.errors.join(" ") : null) ||
          "Submission failed.";
        throw new Error(message);
      }

      setStatus(`Request submitted successfully. Order ID: ${result.orderId}`, "success");

      // Redirect to the thank-you page with the new order ID in the query string.
      setTimeout(() => {
        window.location.href = `${SITE_BASE_URL}/thank-you?id=${encodeURIComponent(result.orderId)}`;
      }, 400);

      form.reset();

      if (planSelect) planSelect.value = "Office 6 Months";
      if (accountTypeSelect) accountTypeSelect.value = "";
      if (paymentSelect) paymentSelect.value = "";
      if (setupMethodSelect) setupMethodSelect.value = "";

      syncSummary();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not submit right now. Please try again.", "error");
    }
  });
}

// Thank-you page behavior fetches order details using the order ID from the URL.
(function () {
  if (!window.location.pathname.includes("thank-you")) return;

  const params = new URLSearchParams(window.location.search);
  const orderIdFromUrl = params.get("id");

  const thankYouStatusEl = document.getElementById("thankYouStatus");
  const orderIdEl = document.getElementById("orderId");
  const summaryFullNameEl = document.getElementById("summaryFullName");
  const summaryPlanEl = document.getElementById("summaryPlan");
  const summaryAccountTypeEl = document.getElementById("summaryAccountType");
  const summaryPriceEl = document.getElementById("summaryPrice");
  const summaryPaymentEl = document.getElementById("summaryPayment");
  const summarySetupMethodEl = document.getElementById("summarySetupMethod");
  const summaryaddressEl = document.getElementById("summaryaddress");
  const summaryNotesEl = document.getElementById("summaryNotes");

  function setThankYouStatus(message, type = "") {
    if (!thankYouStatusEl) return;
    thankYouStatusEl.textContent = message;
    thankYouStatusEl.className = type ? `form-status ${type}` : "form-status";
  }

  // Populate the summary card once the order payload arrives from the API.
  function fillOrder(order) {
    if (orderIdEl) orderIdEl.textContent = order.orderId || "—";
    if (summaryFullNameEl) summaryFullNameEl.textContent = order.fullName || "—";
    if (summaryPlanEl) summaryPlanEl.textContent = order.plan || "—";
    if (summaryAccountTypeEl) summaryAccountTypeEl.textContent = order.accountType || "—";
    if (summaryPriceEl) summaryPriceEl.textContent = order.price || "—";
    if (summaryPaymentEl) summaryPaymentEl.textContent = order.paymentMethod || "—";
    if (summarySetupMethodEl) summarySetupMethodEl.textContent = order.setupMethod || "—";
    if (summaryaddressEl) summaryaddressEl.textContent = order.address || "—";
    if (summaryNotesEl) summaryNotesEl.textContent = order.notes || "—";
  }

  async function loadOrderDetails() {
    if (!orderIdFromUrl) {
      setThankYouStatus("Missing order ID.", "error");
      return;
    }

    if (orderIdEl) orderIdEl.textContent = orderIdFromUrl;
    setThankYouStatus("Loading your order details...");

    try {
      // Reuse the same API base URL and append the order ID for lookup.
      const response = await fetch(`${API_URL}/${encodeURIComponent(orderIdFromUrl)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load order details.");
      }

      fillOrder(result.order);
      setThankYouStatus("");
    } catch (error) {
      console.error(error);
      setThankYouStatus(error.message || "Could not load order details.", "error");
    }
  }

  loadOrderDetails();
})();

// On mobile, move the summary card inside the form so it stays near the submit
// button instead of sitting off to the side.
(function () {
  const checkoutSection = document.getElementById("checkout");
  const orderSummary = document.getElementById("orderSummary");
  const checkoutForm = document.getElementById("checkoutForm");
  const submitButton = checkoutForm
    ? checkoutForm.querySelector('button[type="submit"]')
    : null;

  if (!checkoutSection || !orderSummary || !checkoutForm || !submitButton) return;

  const originalParent = orderSummary.parentNode;
  const originalNextSibling = orderSummary.nextSibling;

  function moveSummaryForViewport() {
    const isMobile = window.innerWidth <= 720;

    if (isMobile) {
      if (submitButton.previousElementSibling !== orderSummary) {
        checkoutForm.insertBefore(orderSummary, submitButton);
        orderSummary.classList.add("summary-in-form");
      }
    } else {
      if (originalNextSibling) {
        originalParent.insertBefore(orderSummary, originalNextSibling);
      } else {
        originalParent.appendChild(orderSummary);
      }
      orderSummary.classList.remove("summary-in-form");
    }
  }

  moveSummaryForViewport();
  window.addEventListener("resize", moveSummaryForViewport);
})();
