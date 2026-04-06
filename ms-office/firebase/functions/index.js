const { createHash, randomUUID } = require("crypto");
const express = require("express");
const Joi = require("joi");
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const app = express();
const router = express.Router();

admin.initializeApp();
const db = getFirestore();

const PRICE_MAP = {
  "Office Monthly": "$1,500",
  "Office 6 Months": "$7,000",
  "Office Yearly": "$10,000"
};

// These limits are intentionally conservative because this is a public
// checkout form running on a low-cost setup. The goal is to block abuse
// before it creates unnecessary Firestore writes or function invocations.
const RATE_WINDOW_MS = 60 * 1000;
const MAX_SUBMISSIONS_PER_IP_PER_WINDOW = 3;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const STORE_TTL_MS = 15 * 60 * 1000;

// In-memory abuse tracking keeps costs down because it avoids extra reads or
// writes. The tradeoff is that the counters reset on cold starts and do not
// synchronize across multiple instances, which is acceptable for a small site.
const ipRateLimitStore = new Map();
const duplicateSubmissionStore = new Map();

const orderSchema = Joi.object({
  fullName: Joi.string()
    .trim()
    .min(2)
    .required()
    .messages({
      "string.empty": "fullName is required",
      "string.min": "fullName must be at least 2 characters"
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^[0-9+\-\s()]{7,20}$/)
    .required()
    .messages({
      "string.empty": "phone is required",
      "string.pattern.base": "phone must be a valid phone number"
    }),

  email: Joi.string()
    .trim()
    .email()
    .required()
    .messages({
      "string.empty": "email is required",
      "string.email": "email must be valid"
    }),

  address: Joi.string()
    .trim()
    .allow("")
    .max(120)
    .optional(),

  plan: Joi.string()
    .valid("Office Monthly", "Office 6 Months", "Office Yearly")
    .required()
    .messages({
      "any.only": "plan must be a valid Microsoft Office option",
      "string.empty": "plan is required"
    }),

  accountType: Joi.string()
    .valid("Business", "Personal", "Student", "Team")
    .required()
    .messages({
      "any.only": "accountType must be Business, Personal, Student, or Team",
      "string.empty": "accountType is required"
    }),

  paymentMethod: Joi.string()
    .valid("Bank transfer", "MMG", "Cash at office")
    .required()
    .messages({
      "any.only": "paymentMethod must be Bank transfer, MMG, or Cash at office",
      "string.empty": "paymentMethod is required"
    }),

  setupMethod: Joi.string()
    .valid("Remote activation", "Email delivery", "WhatsApp assistance", "In-office setup")
    .required()
    .messages({
      "any.only": "setupMethod must be Remote activation, Email delivery, WhatsApp assistance, or In-office setup",
      "string.empty": "setupMethod is required"
    }),

  notes: Joi.string()
    .trim()
    .allow("")
    .max(500)
    .optional()
});

const apiVersion = "/v1";

// A readable order ID is still useful for customer support, but the random
// suffix now comes from a cryptographically strong UUID instead of Math.random.
function generateOrderId() {
  const compactUuid = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `ORD-${compactUuid}`;
}

// The first IP in X-Forwarded-For is the original client IP when requests
// pass through a proxy or load balancer.
function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0].trim();
  }

  return req.ip || "unknown";
}

function hashValue(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Small cleanup passes keep the in-memory stores bounded over time.
function pruneExpiredEntries(store, now) {
  for (const [key, entry] of store.entries()) {
    if (!entry || now - entry.updatedAt > STORE_TTL_MS) {
      store.delete(key);
    }
  }
}

function trackIpSubmission(ip, now) {
  const existingEntry = ipRateLimitStore.get(ip);
  const attempts = existingEntry
    ? existingEntry.attempts.filter((timestamp) => now - timestamp < RATE_WINDOW_MS)
    : [];

  attempts.push(now);

  ipRateLimitStore.set(ip, {
    attempts,
    updatedAt: now
  });

  return attempts.length;
}

function registerDuplicateSubmission(ip, email, now) {
  const normalizedEmail = normalizeEmail(email);
  const duplicateKey = `${ip}:${hashValue(normalizedEmail)}`;

  duplicateSubmissionStore.set(duplicateKey, {
    updatedAt: now,
    submittedAt: now
  });
}

function hasRecentDuplicateSubmission(ip, email, now) {
  const normalizedEmail = normalizeEmail(email);
  const duplicateKey = `${ip}:${hashValue(normalizedEmail)}`;
  const existingEntry = duplicateSubmissionStore.get(duplicateKey);

  if (!existingEntry) {
    return false;
  }

  if (now - existingEntry.submittedAt > DUPLICATE_WINDOW_MS) {
    duplicateSubmissionStore.delete(duplicateKey);
    return false;
  }

  existingEntry.updatedAt = now;
  return true;
}

// JSON logs are easier to search in Cloud Logging and make alert policies
// simpler to build later.
function logEvent(severity, event, metadata = {}) {
  const safeMetadata = { ...metadata };

  console.log(JSON.stringify({
    severity,
    event,
    ...safeMetadata
  }));
}

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  const requestStartedAt = Date.now();
  const requestId = randomUUID();
  const clientIp = getClientIp(req);

  req.requestId = requestId;
  req.clientIp = clientIp;

  res.set("X-Request-Id", requestId);
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "DENY");
  res.set("Cache-Control", "no-store");

  res.on("finish", () => {
    logEvent("INFO", "request_complete", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - requestStartedAt,
      clientIp
    });
  });

  logEvent("INFO", "request_start", {
    requestId,
    method: req.method,
    path: req.originalUrl,
    clientIp
  });

  next();
});

app.get("/ready", (req, res) => {
  return res.status(200).json({
    isSuccess: true,
    status: "ready",
    service: "api",
    timestamp: new Date().toISOString()
  });
});

router.get("/test", (req, res) => {
  return res.status(200).json({
    isSuccess: true,
    message: "API is working"
  });
});

router.get("/ready", (req, res) => {
  return res.status(200).json({
    isSuccess: true,
    status: "ready",
    service: "api",
    timestamp: new Date().toISOString()
  });
});

router.post("/orders", async (req, res) => {
  try {
    const now = Date.now();
    const clientIp = req.clientIp || getClientIp(req);

    pruneExpiredEntries(ipRateLimitStore, now);
    pruneExpiredEntries(duplicateSubmissionStore, now);

    const recentAttempts = trackIpSubmission(clientIp, now);

    if (recentAttempts > MAX_SUBMISSIONS_PER_IP_PER_WINDOW) {
      logEvent("WARNING", "rate_limit_blocked", {
        requestId: req.requestId,
        clientIp,
        recentAttempts,
        windowMs: RATE_WINDOW_MS
      });

      return res.status(429).json({
        isSuccess: false,
        error: "Too many submissions from this connection. Please wait a few minutes and try again."
      });
    }

    const { error, value } = orderSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      logEvent("WARNING", "validation_failed", {
        requestId: req.requestId,
        clientIp,
        issues: error.details.map((detail) => detail.path.join(".") || detail.type)
      });

      return res.status(400).json({
        isSuccess: false,
        errors: error.details.map((detail) => detail.message)
      });
    }

    const normalizedEmail = normalizeEmail(value.email);

    if (hasRecentDuplicateSubmission(clientIp, normalizedEmail, now)) {
      logEvent("WARNING", "duplicate_submission_blocked", {
        requestId: req.requestId,
        clientIp,
        emailHash: hashValue(normalizedEmail),
        duplicateWindowMs: DUPLICATE_WINDOW_MS
      });

      return res.status(409).json({
        isSuccess: false,
        error: "A similar submission was already received recently. Please wait a bit before trying again."
      });
    }

    const randomOrderId = generateOrderId();
    const selectedPrice = PRICE_MAP[value.plan];

    const firestorePayload = {
      fullName: value.fullName,
      phone: value.phone,
      email: normalizedEmail,
      address: value.address || "",
      plan: value.plan,
      accountType: value.accountType,
      paymentMethod: value.paymentMethod,
      setupMethod: value.setupMethod,
      notes: value.notes || "",
      price: selectedPrice,
      orderId: randomOrderId,
      source: "royal-technologies-website",
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("orders").add(firestorePayload);
    registerDuplicateSubmission(clientIp, normalizedEmail, now);

    logEvent("INFO", "order_created", {
      requestId: req.requestId,
      clientIp,
      orderId: randomOrderId,
      firestoreDocId: docRef.id,
      emailHash: hashValue(normalizedEmail),
      plan: value.plan
    });

    return res.status(201).json({
      isSuccess: true,
      message: "Order created successfully",
      orderId: randomOrderId,
      price: selectedPrice
    });
  } catch (err) {
    logEvent("ERROR", "order_create_failed", {
      requestId: req.requestId,
      clientIp: req.clientIp || "unknown",
      errorMessage: err.message,
      errorName: err.name
    });

    return res.status(500).json({
      isSuccess: false,
      error: "Internal server error"
    });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const snapshot = await db
      .collection("orders")
      .where("orderId", "==", orderId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        isSuccess: false,
        error: "Order not found"
      });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return res.status(200).json({
      isSuccess: true,
      order: {
        orderId: data.orderId || "",
        fullName: data.fullName || "",
        plan: data.plan || "",
        accountType: data.accountType || "",
        price: data.price || "",
        paymentMethod: data.paymentMethod || "",
        setupMethod: data.setupMethod || "",
        address: data.address || "",
        notes: data.notes || ""
      }
    });
  } catch (err) {
    logEvent("ERROR", "order_fetch_failed", {
      requestId: req.requestId,
      clientIp: req.clientIp || "unknown",
      orderId: req.params.orderId,
      errorMessage: err.message,
      errorName: err.name
    });

    return res.status(500).json({
      isSuccess: false,
      error: "Internal server error"
    });
  }
});

app.use(apiVersion, router);

exports.api = onRequest(
  {
    cors: [
      "http://127.0.0.1:4000",
      "https://taricohenry.github.io",
      "https://taricohenry.github.io/ms-office/"
    ],
    maxInstances: 3,
    concurrency: 10
  },
  app
);
