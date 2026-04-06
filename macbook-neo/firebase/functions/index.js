// ================================
// ORDER ID GENERATOR
// ================================
function generateOrderId() {
  const fiveDigits = Math.floor(10000 + Math.random() * 90000);
  const threeDigits = Math.floor(100 + Math.random() * 900);
  const shortTime = Date.now().toString().slice(-4);

  return `ORD-${fiveDigits}-${threeDigits}-${shortTime}`;
}

// ================================
// EXPRESS APP SETUP
// ================================
const express = require("express");
const app = express();
const router = express.Router();

// ================================
// VALIDATION LIBRARY
// ================================
const Joi = require("joi");

// ================================
// FIREBASE / FIRESTORE SETUP
// ================================
const admin = require("firebase-admin");
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

admin.initializeApp();
const db = getFirestore();

// ================================
// PRICE MAP
// ================================
const PRICE_MAP = {
  "MacBook Neo 256GB": "$145,000",
  "MacBook Neo 512GB": "$165,000",
  "MacBook Neo 512GB + Setup": "$175,000"
};

// ================================
// JOI VALIDATION SCHEMA
// ================================
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

  location: Joi.when("fulfillment", {
    is: Joi.string().trim().valid("Delivery"),
    then: Joi.string().trim().min(2).required().messages({
      "string.empty": "location is required when fulfillment is Delivery",
      "any.required": "location is required when fulfillment is Delivery",
      "string.min": "location must be at least 2 characters"
    }),
    otherwise: Joi.string().trim().allow("").optional()
  }),

  model: Joi.string()
    .valid(
      "MacBook Neo 256GB",
      "MacBook Neo 512GB",
      "MacBook Neo 512GB + Setup"
    )
    .required()
    .messages({
      "any.only": "model must be a valid MacBook Neo option",
      "string.empty": "model is required"
    }),

  colour: Joi.string()
    .valid("Silver", "Blush", "Citrus", "Indigo")
    .required()
    .messages({
      "any.only": "colour must be one of Silver, Blush, Citrus, Indigo",
      "string.empty": "colour is required"
    }),

  paymentMethod: Joi.string()
    .valid("Cash on pickup", "Cash on delivery", "Bank transfer", "MMG")
    .required()
    .messages({
      "any.only": "paymentMethod must be Cash on pickup, Cash on delivery, Bank transfer, or MMG",
      "string.empty": "paymentMethod is required"
    }),

  fulfillment: Joi.string()
    .valid("Pickup", "Delivery")
    .required()
    .messages({
      "any.only": "fulfillment must be Pickup or Delivery",
      "string.empty": "fulfillment is required"
    }),

  notes: Joi.string()
    .trim()
    .allow("")
    .max(500)
    .optional()
});

const apiVersion = "/v1";

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

router.get("/test", (req, res) => {
  return res.status(200).json({
    isSuccess: true,
    message: "API is working"
  });
});

router.post("/orders", async (req, res) => {
  try {
    const { error, value } = orderSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        isSuccess: false,
        errors: error.details.map((detail) => detail.message)
      });
    }

    const randomOrderId = generateOrderId();
    const selectedPrice = PRICE_MAP[value.model];

    const firestorePayload = {
      fullName: value.fullName,
      phone: value.phone,
      email: value.email,

      // ADDED/FIXED:
      // Your form and Joi schema use "location", so save from value.location.
      location: value.location || "",

      Model: value.model,
      colour: value.colour,
      preferedPaymentMethod: value.paymentMethod,
      fullfilmentMethod: value.fulfillment,
      Notes: value.notes || "",
      price: selectedPrice,
      orderId: randomOrderId,
      createdAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("orders").add(firestorePayload);

    return res.status(201).json({
      isSuccess: true,
      message: "Order created successfully",
      firestoreId: docRef.id,
      orderId: randomOrderId,
      price: selectedPrice
    });
  } catch (err) {
    console.error("Error creating order:", err);

    return res.status(500).json({
      isSuccess: false,
      error: "Internal server error"
    });
  }
});

// ADDED:
// This route is for the thank-you page.
// It looks up the order using your public orderId, not the Firestore doc ID.
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

    // ADDED:
    // Return only the fields the thank-you page needs to display.
    return res.status(200).json({
      isSuccess: true,
      order: {
        orderId: data.orderId || "",
        fullName: data.fullName || "",
        model: data.Model || "",
        colour: data.colour || "",
        price: data.price || "",
        paymentMethod: data.preferedPaymentMethod || "",
        fulfillment: data.fullfilmentMethod || "",
        location: data.location || "",
        notes: data.Notes || ""
      }
    });
  } catch (err) {
    console.error("Error fetching order:", err);

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
      "https://taricohenry.github.io/macbook-neo/",
      "https://royaltechgy.com"
    ],
    maxInstances: 3,
    concurrency: 20
  },
  app
);