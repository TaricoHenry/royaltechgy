// ==========================================
// API ENDPOINT
// ==========================================
// Change this when you deploy to production.
// Local Firebase emulator example:
const API_URL =
  (window.SITE_CONFIG && window.SITE_CONFIG.orderApiUrl) ||
  "https://us-central1-macbook-neo.cloudfunctions.net:443/api/v1/orders";

// ==========================================
// FORM ELEMENTS
// ==========================================
const form = document.getElementById("checkoutForm");
const statusEl = document.getElementById("formStatus");

const modelSelect = form ? form.querySelector('[name="model"]') : null;
const colourSelect = form ? form.querySelector('[name="colour"]') : null;
const paymentSelect = form ? form.querySelector('[name="paymentMethod"]') : null;
const fulfillmentSelect = form ? form.querySelector('[name="fulfillment"]') : null;
const priceInput = form ? form.querySelector('[name="price"]') : null;

const fullNameInput = form ? form.querySelector('[name="fullName"]') : null;
const phoneInput = form ? form.querySelector('[name="phone"]') : null;
const emailInput = form ? form.querySelector('[name="email"]') : null;
const locationInput = form ? form.querySelector('[name="location"]') : null;
const notesInput = form ? form.querySelector('[name="notes"]') : null;

const summaryModel = document.querySelector('[data-summary-model]');
const summaryColour = document.querySelector('[data-summary-colour]');
const summaryPrice = document.querySelector('[data-summary-price]');
const summaryPayment = document.querySelector('[data-summary-payment]');
const summaryFulfillment = document.querySelector('[data-summary-fulfillment]');

// ==========================================
// PRICE MAP
// ==========================================
const PRICE_MAP = {
  "MacBook Neo 256GB": "$145,000",
  "MacBook Neo 512GB": "$165,000",
  "MacBook Neo 512GB + Setup": "$175,000"
};

// ==========================================
// ALLOWED VALUES
// ==========================================
const ALLOWED_MODELS = [
  "MacBook Neo 256GB",
  "MacBook Neo 512GB",
  "MacBook Neo 512GB + Setup"
];

const ALLOWED_COLOURS = [
  "Silver",
  "Blush",
  "Citrus",
  "Indigo"
];

const ALLOWED_PAYMENT_METHODS = [
  "Cash on pickup",
  "Cash on delivery",
  "Bank transfer",
  "MMG"
];

const ALLOWED_FULFILLMENT = [
  "Pickup",
  "Delivery"
];

// ==========================================
// SUMMARY SYNC
// ==========================================
function syncSummary() {
  if (!form) return;

  const model = modelSelect && modelSelect.value ? modelSelect.value : "MacBook Neo 256GB";
  const colour = colourSelect && colourSelect.value ? colourSelect.value : "Indigo";
  const price = PRICE_MAP[model] || "$145,000";
  const payment = paymentSelect && paymentSelect.value ? paymentSelect.value : "Choose at checkout";
  const fulfillment = fulfillmentSelect && fulfillmentSelect.value ? fulfillmentSelect.value : "Pickup or delivery";

  if (summaryModel) summaryModel.textContent = model;
  if (summaryColour) summaryColour.textContent = colour;
  if (summaryPrice) summaryPrice.textContent = price;
  if (summaryPayment) summaryPayment.textContent = payment;
  if (summaryFulfillment) summaryFulfillment.textContent = fulfillment;
  if (priceInput) priceInput.value = price;
}

// ==========================================
// STATUS HELPERS
// ==========================================
function setStatus(message, type = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = type ? `form-status ${type}` : "form-status";
}

// ==========================================
// ERROR HELPERS
// ==========================================
function clearFieldErrors() {
  if (!form) return;

  form.querySelectorAll(".field-error").forEach((el) => el.remove());
  form.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

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

// ==========================================
// VALIDATION
// ==========================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[0-9+\-\s()]{7,20}$/.test(phone);
}

function validateForm(data) {
  const errors = {};

  // full name
  if (!data.fullName || !data.fullName.trim()) {
    errors.fullName = "Full name is required.";
  } else if (data.fullName.trim().length < 2) {
    errors.fullName = "Full name must be at least 2 characters.";
  }

  // phone
  if (!data.phone || !data.phone.trim()) {
    errors.phone = "WhatsApp / phone number is required.";
  } else if (!isValidPhone(data.phone.trim())) {
    errors.phone = "Enter a valid phone number.";
  }

  // email
  if (!data.email || !data.email.trim()) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  // model
  if (!data.model || !ALLOWED_MODELS.includes(data.model)) {
    errors.model = "Please choose a valid model.";
  }

  // colour
  if (!data.colour || !ALLOWED_COLOURS.includes(data.colour)) {
    errors.colour = "Please choose a valid colour.";
  }

  // payment method
  if (!data.paymentMethod || !ALLOWED_PAYMENT_METHODS.includes(data.paymentMethod)) {
    errors.paymentMethod = "Please choose a payment method.";
  }

  // fulfillment
  if (!data.fulfillment || !ALLOWED_FULFILLMENT.includes(data.fulfillment)) {
    errors.fulfillment = "Please choose pickup or delivery.";
  }

  /*
  // delivery area required if delivery selected
  if (data.fulfillment === "Delivery") {
    if (!data.location || !data.location.trim()) {
      errors.location = "Delivery area is required when delivery is selected.";
    }
  }*/

  // notes optional, but cap length if you want
  if (data.notes && data.notes.length > 500) {
    errors.notes = "Notes must be 500 characters or less.";
  }

  return errors;
}

// ==========================================
// FORM INIT
// ==========================================
if (form) {
  syncSummary();

  [modelSelect, paymentSelect, fulfillmentSelect, colourSelect].forEach((element) => {
    if (element) element.addEventListener("change", syncSummary);
  });

  document.querySelectorAll(".product-select").forEach((button) => {
    button.addEventListener("click", () => {
      const model = button.dataset.model;
      if (modelSelect) modelSelect.value = model;
      syncSummary();

      const checkout = document.getElementById("checkout");
      if (checkout) {
        checkout.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearFieldErrors();
    syncSummary();

    // get raw form data
    const rawData = Object.fromEntries(new FormData(form).entries());

    // normalize before validation / submit
    const data = {
      fullName: rawData.fullName ? rawData.fullName.trim() : "",
      phone: rawData.phone ? rawData.phone.trim() : "",
      email: rawData.email ? rawData.email.trim() : "",
      location: rawData.location ? rawData.location.trim() : "",
      model: rawData.model ? rawData.model.trim() : "",
      colour: rawData.colour ? rawData.colour.trim() : "",
      paymentMethod: rawData.paymentMethod ? rawData.paymentMethod.trim() : "",
      fulfillment: rawData.fulfillment ? rawData.fulfillment.trim() : "",
      notes: rawData.notes ? rawData.notes.trim() : ""
    };

    // client-side validation
    const errors = validateForm(data);

    if (Object.keys(errors).length > 0) {
      if (errors.fullName) showFieldError(fullNameInput, errors.fullName);
      if (errors.phone) showFieldError(phoneInput, errors.phone);
      if (errors.email) showFieldError(emailInput, errors.email);
      if (errors.location) showFieldError(locationInput, errors.location);
      if (errors.model) showFieldError(modelSelect, errors.model);
      if (errors.colour) showFieldError(colourSelect, errors.colour);
      if (errors.paymentMethod) showFieldError(paymentSelect, errors.paymentMethod);
      if (errors.fulfillment) showFieldError(fulfillmentSelect, errors.fulfillment);
      if (errors.notes) showFieldError(notesInput, errors.notes);

      setStatus("Please fix the highlighted fields and try again.", "error");
      return;
    }

    setStatus("Submitting order...", "");

    try {
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

      setStatus(`Order submitted successfully. Order ID: ${result.orderId}`, "success");

      // optional short delay so user sees success message
      setTimeout(() => {
        window.location.href = `/macbook-neo/thank-you?id=${encodeURIComponent(result.orderId)}`;
      }, 400);

      form.reset();

      // reset defaults after form reset
      if (modelSelect) modelSelect.value = "MacBook Neo 256GB";
      if (colourSelect) colourSelect.value = "";
      if (paymentSelect) paymentSelect.value = "";
      if (fulfillmentSelect) fulfillmentSelect.value = "";

      syncSummary();
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not submit right now. Please try again.", "error");
    }
  });
}

// ==========================================
// THANK YOU PAGE LOGIC
// ==========================================
(function () {
  // Only run on thank-you page
  if (!window.location.pathname.includes("thank-you")) return;

  const params = new URLSearchParams(window.location.search);
  const orderIdFromUrl = params.get("id");

  const statusEl = document.getElementById("thankYouStatus");
  const orderIdEl = document.getElementById("orderId");
  const summaryFullNameEl = document.getElementById("summaryFullName");
  const summaryModelEl = document.getElementById("summaryModel");
  const summaryColourEl = document.getElementById("summaryColour");
  const summaryPriceEl = document.getElementById("summaryPrice");
  const summaryPaymentEl = document.getElementById("summaryPayment");
  const summaryFulfillmentEl = document.getElementById("summaryFulfillment");
  const summaryLocationEl = document.getElementById("summaryLocation");
  const summaryNotesEl = document.getElementById("summaryNotes");

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = type ? `form-status ${type}` : "form-status";
  }

  function fillOrder(order) {
    if (orderIdEl) orderIdEl.textContent = order.orderId || "—";
    if (summaryFullNameEl) summaryFullNameEl.textContent = order.fullName || "—";
    if (summaryModelEl) summaryModelEl.textContent = order.model || "—";
    if (summaryColourEl) summaryColourEl.textContent = order.colour || "—";
    if (summaryPriceEl) summaryPriceEl.textContent = order.price || "—";
    if (summaryPaymentEl) summaryPaymentEl.textContent = order.paymentMethod || "—";
    if (summaryFulfillmentEl) summaryFulfillmentEl.textContent = order.fulfillment || "—";
    if (summaryLocationEl) summaryLocationEl.textContent = order.location || "—";
    if (summaryNotesEl) summaryNotesEl.textContent = order.notes || "—";
  }

  async function loadOrderDetails() {
    if (!orderIdFromUrl) {
      setStatus("Missing order ID.", "error");
      return;
    }

    if (orderIdEl) orderIdEl.textContent = orderIdFromUrl;
    setStatus("Loading your order details...");

    try {
      const response = await fetch(`${API_URL}/${encodeURIComponent(orderIdFromUrl)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load order details.");
      }

      fillOrder(result.order);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Could not load order details.", "error");
    }
  }

  loadOrderDetails();
})();

// ==========================================
// CHECKOUT SUMMARY REPOSITIONING
// ==========================================
(function () {
  const checkoutSection = document.getElementById("checkout");
  const orderSummary = document.getElementById("orderSummary");
  const checkoutForm = document.getElementById("checkoutForm");
  const submitButton = checkoutForm
    ? checkoutForm.querySelector('button[type="submit"]')
    : null;

  if (!checkoutSection || !orderSummary || !checkoutForm || !submitButton) return;

  // Save the original desktop parent and position so we can restore it.
  const originalParent = orderSummary.parentNode;
  const originalNextSibling = orderSummary.nextSibling;

  function moveSummaryForViewport() {
    const isMobile = window.innerWidth <= 720;

    if (isMobile) {
      // Move the existing summary card so it appears just above the submit button on mobile.
      if (submitButton.previousElementSibling !== orderSummary) {
        checkoutForm.insertBefore(orderSummary, submitButton);
        orderSummary.classList.add("summary-in-form");
      }
    } else {
      // Move the summary back to its original desktop location.
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