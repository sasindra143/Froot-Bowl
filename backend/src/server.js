import "dotenv/config";
import express from "express";
import {
  createHmac,
  randomInt,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const app = express();
const port = Number(process.env.PORT || 3001);
const storePath = join(import.meta.dirname, "..", "data", "store.json");
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "";
const adminPasswordSalt = process.env.ADMIN_PASSWORD_SALT || randomBytes(16).toString("hex");
const sessionLifetime = 12 * 60 * 60 * 1000;
const markapurCenter = {
  latitude: Number(process.env.MARKAPUR_LATITUDE || 15.7351),
  longitude: Number(process.env.MARKAPUR_LONGITUDE || 79.2695),
};
const deliveryRadiusKm = Number(process.env.MARKAPUR_DELIVERY_RADIUS_KM || 6);
const coverageBoundaryToleranceMeters = 0.05;
const deliveryConfirmRadiusMeters = Number(process.env.DELIVERY_CONFIRM_RADIUS_METERS || 100);
const deliveryOverrideCodeLifetimeMs = 10 * 60 * 1000;
const deliveryPhotoOverrideLifetimeMs = 15 * 60 * 1000;
const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
const whatsappPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const whatsappGraphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v22.0";
const maxCustomerCancellations = 3;
const nominatimCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

app.disable("x-powered-by");
app.use(express.json({ limit: "300kb" }));

const categories = [
  {
    name: "Fruit boxes",
    detail: "Fresh mixed fruit in two handy sizes.",
    image:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "For active days",
    detail: "A colorful fruit break after your workout.",
    image:
      "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Monthly packs",
    detail: "Ask us about a fresh routine that suits you.",
    image:
      "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=700&q=85",
  },
];

const products = [
  {
    id: "small-fruit-box",
    name: "Small mixed fruit box",
    note: "A handy box of freshly cut mixed fruits.",
    category: "Fruit box",
    image:
      "https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=900&q=85",
    tag: "Small box",
    price: 59,
  },
  {
    id: "regular-fruit-box",
    name: "Regular mixed fruit box",
    note: "A generous box filled with colorful mixed fruits.",
    category: "Fruit box",
    image:
      "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=900&q=85",
    tag: "Regular box",
    price: 89,
  },
];

const orderStatuses = [
  "placed",
  "awaiting_confirmation",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];
const statusLabels = {
  placed: "Order received",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Order confirmed",
  preparing: "Being prepared",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const loginAttempts = new Map();

mkdirSync(dirname(storePath), { recursive: true });

function readStore() {
  try {
    const data = JSON.parse(readFileSync(storePath, "utf8"));
    return {
      customers: Array.isArray(data.customers) ? data.customers : [],
      riders: Array.isArray(data.riders) ? data.riders : [],
      orders: Array.isArray(data.orders) ? data.orders : [],
      deliveryCoverageAudit: Array.isArray(data.deliveryCoverageAudit)
        ? data.deliveryCoverageAudit
        : [],
      deliveryCoverage: data.deliveryCoverage || {
        center: markapurCenter,
        radiusKm: deliveryRadiusKm,
        enabled: true,
        referencePoint: "Markapuram, Andhra Pradesh, India",
      },
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        customers: [],
        riders: [],
        orders: [],
        deliveryCoverageAudit: [],
        deliveryCoverage: {
          center: markapurCenter,
          radiusKm: deliveryRadiusKm,
          enabled: true,
          referencePoint: "Markapuram, Andhra Pradesh, India",
        },
      };
    }
    throw error;
  }
}

function writeStore(store) {
  const temporaryPath = `${storePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(store, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, storePath);
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarData: user.avatarData || null,
  };
}

function issueSession(user) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      exp: Date.now() + sessionLifetime,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSession(request) {
  const cookie = request.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("froot_session="))
    ?.slice("froot_session=".length);
  if (!cookie) return null;

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", sessionSecret)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setSessionCookie(response, user) {
  response.cookie("froot_session", issueSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionLifetime,
    path: "/",
  });
}

function requireAuth(request, response, next) {
  const session = readSession(request);
  if (!session) {
    response.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  request.session = session;
  next();
}

function requireAdmin(request, response, next) {
  requireAuth(request, response, () => {
    if (request.session.role !== "admin") {
      response.status(403).json({ error: "Admin access is required." });
      return;
    }
    next();
  });
}

function requireRider(request, response, next) {
  requireAuth(request, response, () => {
    if (request.session.role !== "rider") {
      response.status(403).json({ error: "Rider access is required." });
      return;
    }
    next();
  });
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  if (typeof storedHash !== "string") return false;
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return (
    expectedBuffer.length === actualHash.length &&
    timingSafeEqual(actualHash, expectedBuffer)
  );
}

const adminPasswordHash = adminPassword
  ? hashPassword(adminPassword, adminPasswordSalt)
  : "";

function rateLimitAuth(request, response, next) {
  const now = Date.now();
  const key = request.ip;
  const attempts = (loginAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < 60_000,
  );
  if (attempts.length >= 10) {
    response.status(429).json({ error: "Too many attempts. Please wait a minute and try again." });
    return;
  }
  attempts.push(now);
  loginAttempts.set(key, attempts);
  next();
}

function validateText(value, maxLength, minLength = 1) {
  return (
    typeof value === "string" &&
    value.trim().length >= minLength &&
    value.trim().length <= maxLength
  );
}

function distanceInKm(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(second.latitude - first.latitude);
  const longitudeDifference = radians(second.longitude - first.longitude);
  const value =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(first.latitude)) *
      Math.cos(radians(second.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function currentDeliveryCoverage() {
  return readStore().deliveryCoverage;
}

function checkDeliveryLocation(location) {
  const coverage = currentDeliveryCoverage();
  const validCoordinates =
    Number.isFinite(location?.latitude) &&
    Number.isFinite(location?.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180;
  if (!validCoordinates) {
    return {
      serviceable: false,
      distanceMeters: null,
      coverage,
      message: "Enter a valid map location before checking delivery availability.",
    };
  }
  const distanceMeters = distanceInKm(coverage.center, location) * 1000;
  const serviceable =
    coverage.enabled &&
    Number.isFinite(distanceMeters) &&
    distanceMeters <= coverage.radiusKm * 1000 + coverageBoundaryToleranceMeters;
  return {
    serviceable,
    distanceMeters: Math.round(distanceMeters),
    coverage,
    message: !coverage.enabled
      ? "Delivery coverage is temporarily unavailable."
      : serviceable
        ? "Delivery available at this location."
        : `Sorry, this location is outside our current delivery area. Please select an address within ${coverage.radiusKm} km of Markapur.`,
  };
}

function validateSavedAddress(address, location) {
  return Boolean(
    address &&
      (address.line1 === undefined || address.line1 === "" || validateText(address.line1, 160, 2)) &&
      validateText(address.area, 100, 2) &&
      validateText(address.city, 80) &&
      address.city.trim().toLowerCase() === "markapur" &&
      (!address.pincode || /^\d{6}$/.test(String(address.pincode))) &&
      (address.landmark === undefined || address.landmark === "" || validateText(address.landmark, 120, 2)) &&
      Number.isFinite(location?.latitude) &&
      Number.isFinite(location?.longitude) &&
      Math.abs(location.latitude) <= 90 &&
      Math.abs(location.longitude) <= 180,
  );
}

function requestNominatim(url, cacheKey) {
  if (nominatimCache.has(cacheKey)) return Promise.resolve(nominatimCache.get(cacheKey));
  const request = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, 1100 - (Date.now() - lastNominatimRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "FrootBowlMarkapur/1.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(`OpenStreetMap address lookup failed (${response.status}).`);
    }
    const result = await response.json();
    nominatimCache.set(cacheKey, result);
    if (nominatimCache.size > 500) {
      nominatimCache.delete(nominatimCache.keys().next().value);
    }
    return result;
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

function publicOsmPlace(place) {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    displayName: place.display_name || "",
    name: place.name || place.namedetails?.name || "",
    address: place.address || {},
    latitude,
    longitude,
    placeId: place.place_id || null,
    osmType: place.osm_type || null,
    osmId: place.osm_id || null,
    type: place.type || null,
    source: "OpenStreetMap / Nominatim",
  };
}

function isFreshLocation(location, maxAgeMs = 120_000) {
  if (!location?.updatedAt) return false;
  const age = Date.now() - Date.parse(location.updatedAt);
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
}

function hashDeliveryOverrideCode(orderId, code) {
  return createHmac("sha256", sessionSecret)
    .update(`${orderId}:${code}`)
    .digest("hex");
}

async function sendWhatsAppText(phone, message) {
  if (!whatsappAccessToken || !whatsappPhoneNumberId) {
    return {
      ok: false,
      status: 503,
      error: "Automatic WhatsApp delivery is not configured. Add the WhatsApp Business credentials to the backend environment and restart the server.",
    };
  }
  let result;
  try {
    const apiResponse = await fetch(
      `https://graph.facebook.com/${whatsappGraphApiVersion}/${whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    try {
      result = await apiResponse.json();
    } catch {
      return {
        ok: false,
        status: 502,
        error: "WhatsApp returned an unreadable response. Check the provider configuration and try again.",
      };
    }
    if (!apiResponse.ok) {
      return {
        ok: false,
        status: 502,
        error: result.error?.message || "WhatsApp could not send the code. Check the WhatsApp Business API setup and try again.",
      };
    }
    if (!Array.isArray(result.messages) || result.messages.length === 0) {
      return {
        ok: false,
        status: 502,
        error: "WhatsApp did not confirm delivery of the code. Check the sender setup and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Could not reach the WhatsApp Business API. Check the server connection and try again.",
    };
  }
  return { ok: true };
}

function publicOrder(order, includePhotoOverride = false, riderPhone = "") {
  const photoOverride = order.deliveryPhotoOverride;
  return {
    id: order.id,
    customer: order.customer,
    items: order.items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    address: order.address,
    paymentMethod: order.paymentMethod,
    status: order.status,
    statusHistory: order.statusHistory,
    assignedRider: order.assignedRider
      ? {
          ...order.assignedRider,
          ...(riderPhone && order.status === "out_for_delivery" ? { phone: riderPhone } : {}),
        }
      : null,
    trackingLocation:
      order.status === "out_for_delivery" ? order.trackingLocation || null : null,
    deliveryProofCount: Array.isArray(order.deliveryProofs) ? order.deliveryProofs.filter(Boolean).length : 0,
    deliveryProofSlots: Array.isArray(order.deliveryProofs) ? order.deliveryProofs.map(Boolean) : [false, false, false],
    deliveryPhotoOverrideActive: includePhotoOverride &&
      photoOverride?.riderId === order.assignedRider?.id &&
      photoOverride.remaining > 0 &&
      Date.parse(photoOverride.expiresAt) > Date.now(),
    customerConfirmedAt: order.customerConfirmedAt || null,
    deliveryLocationMismatch: order.deliveryLocationMismatch || false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function createOrderId(existingOrders) {
  let id;
  do {
    id = `FB-${randomUUID().toUpperCase()}`;
  } while (existingOrders.some((order) => order.id === id));
  return id;
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "froot-bowl-backend" });
});

app.get("/api/config", (_request, response) => {
  const coverage = currentDeliveryCoverage();
  response.json({
    deliveryConfirmRadiusMeters,
    deliveryRadiusKm: coverage.radiusKm,
    markapurCenter: coverage.center,
    deliveryCoverageEnabled: coverage.enabled,
  });
});

app.get("/api/geocode/search", async (request, response) => {
  const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (query.length < 2 || query.length > 160) {
    response.status(400).json({ error: "Enter a search term between 2 and 160 characters." });
    return;
  }
  const coverage = currentDeliveryCoverage();
  const offset = 0.12;
  const params = new URLSearchParams({
    q: `${query}, Markapur, Andhra Pradesh, India`,
    format: "jsonv2",
    limit: "8",
    addressdetails: "1",
    namedetails: "1",
    countrycodes: "in",
    bounded: "1",
    viewbox: [
      coverage.center.longitude - offset,
      coverage.center.latitude + offset,
      coverage.center.longitude + offset,
      coverage.center.latitude - offset,
    ].join(","),
  });
  try {
    const result = await requestNominatim(
      `https://nominatim.openstreetmap.org/search?${params}`,
      `search:${query.toLocaleLowerCase()}:${coverage.center.latitude}:${coverage.center.longitude}`,
    );
    response.set("Cache-Control", "public, max-age=300");
    response.json({ results: result.map(publicOsmPlace).filter(Boolean) });
  } catch (error) {
    console.error("OpenStreetMap search failed:", error);
    response.status(502).json({ error: "OpenStreetMap search is temporarily unavailable. Try again or place the pin manually." });
  }
});

app.get("/api/geocode/reverse", async (request, response) => {
  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    response.status(400).json({ error: "Enter valid map coordinates for reverse geocoding." });
    return;
  }
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude.toFixed(6),
    lon: longitude.toFixed(6),
    zoom: "18",
    addressdetails: "1",
    namedetails: "1",
  });
  try {
    const result = await requestNominatim(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      `reverse:${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
    );
    const place = publicOsmPlace(result);
    response.set("Cache-Control", "public, max-age=300");
    response.json({ place });
  } catch (error) {
    console.error("OpenStreetMap reverse geocoding failed:", error);
    response.status(502).json({ error: "OpenStreetMap address lookup is temporarily unavailable. Enter the street or landmark manually." });
  }
});

app.post("/api/coverage/check", (request, response) => {
  const result = checkDeliveryLocation(request.body?.location);
  response.json({
    serviceable: result.serviceable,
    distanceMeters: result.distanceMeters,
    radiusMeters: result.coverage.radiusKm * 1000,
    enabled: result.coverage.enabled,
    message: result.message,
  });
});

app.get("/api/admin/coverage", requireAdmin, (_request, response) => {
  response.json({ coverage: currentDeliveryCoverage() });
});

app.put("/api/admin/coverage", requireAdmin, (request, response) => {
  const { center, radiusKm, enabled, referencePoint } = request.body || {};
  if (
    !Number.isFinite(center?.latitude) ||
    !Number.isFinite(center?.longitude) ||
    Math.abs(center.latitude) > 90 ||
    Math.abs(center.longitude) > 180 ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    radiusKm > 100 ||
    typeof enabled !== "boolean" ||
    !validateText(referencePoint, 160, 3)
  ) {
    response.status(400).json({
      error: "Enter a valid service center, a radius greater than 0 and no more than 100 km, a reference address, and an enabled/disabled choice.",
    });
    return;
  }
  const store = readStore();
  const previousCoverage = store.deliveryCoverage;
  store.deliveryCoverage = {
    center: { latitude: center.latitude, longitude: center.longitude },
    radiusKm,
    enabled,
    referencePoint: referencePoint.trim(),
    verifiedAt: new Date().toISOString(),
  };
  store.deliveryCoverageAudit.push({
    adminId: request.session.sub,
    changedAt: store.deliveryCoverage.verifiedAt,
    previous: previousCoverage,
    next: store.deliveryCoverage,
  });
  store.deliveryCoverageAudit = store.deliveryCoverageAudit.slice(-100);
  writeStore(store);
  response.json({ coverage: store.deliveryCoverage });
});

app.get("/api/menu", (_request, response) => {
  response.set("Cache-Control", "no-store");
  response.json({
    status: "ready",
    message: "Fresh fruit boxes; free home delivery in Markapur.",
    categories,
    products,
  });
});

app.get("/api/plans", (_request, response) => {
  response.json({
    plans: [
      {
        id: "monthly-fruit-pack",
        name: "Monthly fruit pack",
        description:
          "A recurring fresh fruit option. Choose the schedule and box quantity with us.",
        price: null,
        requiresEnquiry: true,
      },
    ],
  });
});

app.post("/api/auth/register", rateLimitAuth, (request, response) => {
  const { name, email, phone, password } = request.body || {};
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    !validateText(name, 80) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof phone !== "string" ||
    !/^[0-9+() -]{7,20}$/.test(phone.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    response.status(400).json({
      error: "Enter your name, a valid email and phone number, and a password of at least 8 characters.",
    });
    return;
  }

  const store = readStore();
  if (
    normalizedEmail === adminEmail ||
    store.customers.some((customer) => customer.email === normalizedEmail) ||
    store.riders.some((rider) => rider.email === normalizedEmail)
  ) {
    response.status(409).json({ error: "An account with this email already exists. Please sign in." });
    return;
  }

  const customer = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    passwordHash: hashPassword(password),
    role: "customer",
    createdAt: new Date().toISOString(),
  };
  store.customers.push(customer);
  writeStore(store);
  setSessionCookie(response, customer);
  response.status(201).json({ user: safeUser(customer) });
});

app.post("/api/auth/login", rateLimitAuth, (request, response) => {
  const { email, password, adminOnly = false, riderOnly = false } = request.body || {};
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    typeof adminOnly !== "boolean" ||
    typeof riderOnly !== "boolean" ||
    (adminOnly && riderOnly)
  ) {
    response.status(400).json({ error: "Enter your email and password." });
    return;
  }

  const validAdminCredentials =
    adminEmail &&
    adminPassword &&
    normalizedEmail === adminEmail &&
    passwordMatches(password, adminPasswordHash);
  if (adminOnly) {
    if (!validAdminCredentials) {
      response.status(401).json({ error: "Admin email or password is incorrect." });
      return;
    }
    const admin = {
      id: "admin",
      name: "Froot Bowl Admin",
      email: adminEmail,
      role: "admin",
    };
    setSessionCookie(response, admin);
    response.json({ user: safeUser(admin) });
    return;
  }

  if (riderOnly) {
    const rider = readStore().riders.find(
      (account) => account.email === normalizedEmail && account.active !== false,
    );
    if (!rider || !passwordMatches(password, rider.passwordHash)) {
      response.status(401).json({ error: "Rider email or password is incorrect." });
      return;
    }
    setSessionCookie(response, rider);
    response.json({ user: safeUser(rider) });
    return;
  }

  if (validAdminCredentials) {
    response.status(401).json({ error: "Admin access is available only through the private admin portal." });
    return;
  }

  const store = readStore();
  if (store.riders.some((account) => account.email === normalizedEmail)) {
    response.status(401).json({ error: "Rider accounts must sign in through the rider portal." });
    return;
  }
  const customer = store.customers.find(
    (account) => account.email === normalizedEmail,
  );
  if (!customer || !passwordMatches(password, customer.passwordHash)) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  if (customer.blocked) {
    response.status(403).json({
      error: "This account is blocked after repeated order cancellations. Contact Froot Bowl on WhatsApp for help.",
    });
    return;
  }

  setSessionCookie(response, customer);
  response.json({ user: safeUser(customer) });
});

app.get("/api/auth/me", (request, response) => {
  const session = readSession(request);
  if (!session) {
    response.status(401).json({ error: "Please sign in." });
    return;
  }
  if (session.role === "admin") {
    response.json({
      user: {
        id: "admin",
        name: "Froot Bowl Admin",
        email: adminEmail,
        role: "admin",
      },
    });
    return;
  }
  const store = readStore();
  const accountList = session.role === "rider" ? store.riders : store.customers;
  const account = accountList.find((entry) => entry.id === session.sub);
  if (!account || account.active === false) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  response.json({ user: safeUser(account) });
});

app.get("/api/admin/riders", requireAdmin, (_request, response) => {
  const riders = readStore().riders.map((rider) => ({
    id: rider.id,
    name: rider.name,
    email: rider.email,
    phone: rider.phone,
    active: rider.active !== false,
  }));
  response.json({ riders });
});

app.post("/api/admin/riders", requireAdmin, (request, response) => {
  const { name, email, phone, password } = request.body || {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (
    !validateText(name, 80) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    typeof phone !== "string" ||
    !/^[0-9+() -]{7,20}$/.test(phone.trim()) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  ) {
    response.status(400).json({
      error: "Enter the rider’s name, valid email and phone, and a password of at least 8 characters.",
    });
    return;
  }

  const store = readStore();
  if (
    normalizedEmail === adminEmail ||
    store.customers.some((customer) => customer.email === normalizedEmail) ||
    store.riders.some((rider) => rider.email === normalizedEmail)
  ) {
    response.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const rider = {
    id: randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    passwordHash: hashPassword(password),
    role: "rider",
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.riders.push(rider);
  writeStore(store);
  response.status(201).json({
    rider: {
      id: rider.id,
      name: rider.name,
      email: rider.email,
      phone: rider.phone,
      active: rider.active,
    },
  });
});

app.put("/api/profile/avatar", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts can update a profile photo." });
    return;
  }
  const { avatarData } = request.body || {};
  const match =
    typeof avatarData === "string" &&
    avatarData.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    response.status(400).json({ error: "Choose a JPEG, PNG, or WebP profile image." });
    return;
  }

  const image = Buffer.from(match[2], "base64");
  const isJpeg = match[1] === "jpeg" && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng =
    match[1] === "png" &&
    image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    match[1] === "webp" &&
    image.toString("ascii", 0, 4) === "RIFF" &&
    image.toString("ascii", 8, 12) === "WEBP";
  if (image.length > 200_000 || !(isJpeg || isPng || isWebp)) {
    response.status(400).json({ error: "Use a valid image smaller than 200 KB." });
    return;
  }

  const store = readStore();
  const customer = store.customers.find((entry) => entry.id === request.session.sub);
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  customer.avatarData = avatarData;
  writeStore(store);
  response.json({ user: safeUser(customer) });
});

app.delete("/api/profile/avatar", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts can update a profile photo." });
    return;
  }
  const store = readStore();
  const customer = store.customers.find((entry) => entry.id === request.session.sub);
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  delete customer.avatarData;
  writeStore(store);
  response.json({ user: safeUser(customer) });
});

app.post("/api/auth/logout", (_request, response) => {
  response.clearCookie("froot_session", { sameSite: "lax", path: "/" });
  response.status(204).end();
});

app.get("/api/profile/addresses", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts have saved addresses." });
    return;
  }
  const customer = readStore().customers.find((entry) => entry.id === request.session.sub);
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  response.json({
    addresses: Array.isArray(customer.addresses) ? customer.addresses : [],
    selectedAddressId: customer.selectedAddressId || null,
  });
});

app.post("/api/profile/addresses", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts can save delivery addresses." });
    return;
  }
  const { address, location, setDefault = true } = request.body || {};
  if (
    !validateSavedAddress(address, location) ||
    !validateText(address.recipientName, 80) ||
    typeof address.phone !== "string" ||
    !/^[0-9+() -]{7,20}$/.test(address.phone.trim()) ||
    (setDefault !== true && setDefault !== false)
  ) {
    response.status(400).json({
      error: "Enter the recipient’s name, a valid phone, street, area, Markapur city, PIN code, landmark, and a valid map location.",
    });
    return;
  }
  const serviceability = checkDeliveryLocation(location);
  if (!serviceability.serviceable) {
    response.status(400).json({ error: serviceability.message || "This location is outside the delivery area." });
    return;
  }
  const store = readStore();
  const customer = store.customers.find((entry) => entry.id === request.session.sub);
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  customer.addresses = Array.isArray(customer.addresses) ? customer.addresses : [];
  if (customer.addresses.length >= 20) {
    response.status(409).json({ error: "You can save up to 20 addresses. Remove one to add another." });
    return;
  }
  const now = new Date().toISOString();
  const savedAddress = {
    id: randomUUID(),
    customerId: customer.id,
    recipientName: address.recipientName.trim(),
    phone: address.phone.trim(),
    line1: typeof address.line1 === "string" ? address.line1.trim() : "",
    area: address.area.trim(),
    city: "Markapur",
    pincode: String(address.pincode || "").trim(),
    landmark: typeof address.landmark === "string" ? address.landmark.trim() : "",
    buildingName: typeof address.buildingName === "string" ? address.buildingName.trim() : "",
    instructions: typeof address.instructions === "string" ? address.instructions.trim().slice(0, 300) : "",
    addressType: ["Home", "Work", "Other"].includes(address.addressType) ? address.addressType : "Home",
    latitude: location.latitude,
    longitude: location.longitude,
    verificationStatus: ["osm-verified", "admin-verified"].includes(address.verificationStatus)
      ? address.verificationStatus
      : "unverified",
    osmDisplayName: typeof address.osmDisplayName === "string" ? address.osmDisplayName.trim().slice(0, 300) : "",
    osmType: typeof address.osmType === "string" ? address.osmType.trim().slice(0, 20) : "",
    osmId: Number.isSafeInteger(address.osmId) ? address.osmId : null,
    formattedAddress: [
      address.line1.trim(),
      address.area.trim(),
      "Markapur",
      String(address.pincode || "").trim(),
    ].filter(Boolean).join(", "),
    isDefault: setDefault || customer.addresses.length === 0,
    createdAt: now,
    updatedAt: now,
  };
  if (savedAddress.isDefault) {
    customer.addresses = customer.addresses.map((entry) => ({ ...entry, isDefault: false }));
    customer.selectedAddressId = savedAddress.id;
  }
  customer.addresses.push(savedAddress);
  writeStore(store);
  response.status(201).json({
    address: savedAddress,
    addresses: customer.addresses,
    selectedAddressId: customer.selectedAddressId || savedAddress.id,
  });
});

app.put("/api/profile/addresses/:id/default", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts can select saved addresses." });
    return;
  }
  const store = readStore();
  const customer = store.customers.find((entry) => entry.id === request.session.sub);
  const address = customer?.addresses?.find((entry) => entry.id === request.params.id);
  if (!customer || !address) {
    response.status(404).json({ error: "Saved address not found." });
    return;
  }
  customer.addresses = customer.addresses.map((entry) => ({
    ...entry,
    isDefault: entry.id === address.id,
  }));
  customer.selectedAddressId = address.id;
  writeStore(store);
  response.json({ addresses: customer.addresses, selectedAddressId: address.id });
});

app.delete("/api/profile/addresses/:id", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only customer accounts can delete saved addresses." });
    return;
  }
  const store = readStore();
  const customer = store.customers.find((entry) => entry.id === request.session.sub);
  if (!customer || !Array.isArray(customer.addresses)) {
    response.status(404).json({ error: "Saved address not found." });
    return;
  }
  const address = customer.addresses.find((entry) => entry.id === request.params.id);
  if (!address) {
    response.status(404).json({ error: "Saved address not found." });
    return;
  }
  customer.addresses = customer.addresses.filter((entry) => entry.id !== address.id);
  if (customer.selectedAddressId === address.id) {
    customer.selectedAddressId = customer.addresses.find((entry) => entry.isDefault)?.id || null;
    if (customer.selectedAddressId) {
      customer.addresses = customer.addresses.map((entry) => ({
        ...entry,
        isDefault: entry.id === customer.selectedAddressId,
      }));
    }
  }
  writeStore(store);
  response.json({
    addresses: customer.addresses,
    selectedAddressId: customer.selectedAddressId || null,
  });
});

app.post("/api/orders", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Use a customer account to place an order." });
    return;
  }

  const { items, address, location, paymentMethod } = request.body || {};
  const idempotencyKey = request.get("Idempotency-Key") || "";
  const serviceability = checkDeliveryLocation(location);
  const validCoordinates = Number.isFinite(serviceability.distanceMeters);
  if (!serviceability.serviceable) {
    response.status(400).json({ error: serviceability.message || "This location is outside the delivery area." });
    return;
  }
  if (
    !Array.isArray(items) ||
    items.length < 1 ||
    items.length > 20 ||
    !address ||
    (address.line1 !== undefined && address.line1 !== "" && !validateText(address.line1, 160, 2)) ||
    !validateText(address.area, 100, 2) ||
    !validateText(address.city, 80) ||
    address.city.trim().toLowerCase() !== "markapur" ||
    (address.pincode && !/^\d{6}$/.test(String(address.pincode))) ||
    (address.landmark !== undefined && address.landmark !== "" && !validateText(address.landmark, 120, 2)) ||
    (address.instructions !== undefined && typeof address.instructions !== "string") ||
    !validCoordinates ||
    !["cod", "whatsapp"].includes(paymentMethod) ||
    (idempotencyKey && !/^[\w-]{16,80}$/.test(idempotencyKey))
  ) {
    response.status(400).json({
      error: "Enter a Markapur area, a valid optional PIN code, and a delivery pin. Add a nearby landmark or delivery instructions if the exact street or house number is unavailable.",
    });
    return;
  }

  const normalizedItems = [];
  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      response.status(400).json({ error: "The bag contains an unavailable item or quantity." });
      return;
    }
    normalizedItems.push({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity: item.quantity,
      lineTotal: product.price * item.quantity,
    });
  }

  const store = readStore();
  if (idempotencyKey) {
    const previousOrder = store.orders.find(
      (entry) =>
        entry.customer.id === request.session.sub &&
        entry.idempotencyKey === idempotencyKey,
    );
    if (previousOrder) {
      response.status(200).json({ order: publicOrder(previousOrder) });
      return;
    }
  }
  const customer = store.customers.find(
    (account) => account.id === request.session.sub,
  );
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }
  if (customer.blocked) {
    response.status(403).json({
      error: "This account is blocked after repeated order cancellations. Contact Froot Bowl on WhatsApp for help.",
    });
    return;
  }

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const now = new Date().toISOString();
  const order = {
    id: createOrderId(store.orders),
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    },
    items: normalizedItems,
    subtotal,
    deliveryFee: 0,
    total: subtotal,
    address: {
      line1: typeof address.line1 === "string" ? address.line1.trim() : "",
      area: address.area.trim(),
      city: address.city.trim(),
      pincode: String(address.pincode || "").trim(),
      landmark: typeof address.landmark === "string" ? address.landmark.trim() : "",
      recipientName: typeof address.recipientName === "string" ? address.recipientName.trim() : customer.name,
      phone: typeof address.phone === "string" ? address.phone.trim() : customer.phone,
      buildingName: typeof address.buildingName === "string" ? address.buildingName.trim().slice(0, 120) : "",
      instructions: typeof address.instructions === "string" ? address.instructions.trim().slice(0, 300) : "",
      addressType: ["Home", "Work", "Other"].includes(address.addressType) ? address.addressType : "Home",
      latitude: location.latitude,
      longitude: location.longitude,
      verificationStatus: ["osm-verified", "admin-verified"].includes(address.verificationStatus)
        ? address.verificationStatus
        : "unverified",
      osmDisplayName: typeof address.osmDisplayName === "string" ? address.osmDisplayName.trim().slice(0, 300) : "",
      osmType: typeof address.osmType === "string" ? address.osmType.trim().slice(0, 20) : "",
      osmId: Number.isSafeInteger(address.osmId) ? address.osmId : null,
    },
    paymentMethod,
    idempotencyKey,
    status: paymentMethod === "cod" ? "placed" : "awaiting_confirmation",
    statusHistory: [
      {
        status: paymentMethod === "cod" ? "placed" : "awaiting_confirmation",
        label:
          paymentMethod === "cod"
            ? statusLabels.placed
            : statusLabels.awaiting_confirmation,
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  store.orders.unshift(order);
  writeStore(store);
  response.status(201).json({ order: publicOrder(order) });
});

app.post("/api/orders/:id/cancel", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only the ordering customer can cancel an order." });
    return;
  }

  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.customer.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (!["placed", "awaiting_confirmation", "confirmed"].includes(order.status)) {
    response.status(409).json({
      error: "This order can no longer be cancelled because preparation or delivery has started.",
    });
    return;
  }

  const customer = store.customers.find(
    (account) => account.id === request.session.sub,
  );
  if (!customer) {
    response.status(401).json({ error: "Please sign in again." });
    return;
  }

  customer.cancellations = (customer.cancellations || 0) + 1;
  customer.blocked = customer.cancellations > maxCustomerCancellations;
  const now = new Date().toISOString();
  order.status = "cancelled";
  order.updatedAt = now;
  order.statusHistory.push({ status: "cancelled", label: statusLabels.cancelled, at: now });
  writeStore(store);
  response.json({
    order: publicOrder(order),
    cancellations: customer.cancellations,
    accountBlocked: customer.blocked,
  });
});

app.get("/api/orders", requireAuth, (request, response) => {
  const store = readStore();
  const orders = request.session.role === "admin"
    ? store.orders
    : request.session.role === "rider"
      ? store.orders.filter((order) => order.assignedRider?.id === request.session.sub)
      : store.orders.filter((order) => order.customer.id === request.session.sub);
  response.json({
    orders: orders.map((order) =>
      publicOrder(
        order,
        request.session.role === "rider" && order.assignedRider?.id === request.session.sub,
        request.session.role === "customer" && order.status === "out_for_delivery"
          ? store.riders.find((rider) => rider.id === order.assignedRider?.id)?.phone || ""
          : "",
      ),
    ),
    statusLabels,
  });
});

app.patch("/api/admin/orders/:id/rider", requireAdmin, (request, response) => {
  const { riderId } = request.body || {};
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === request.params.id);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (["delivered", "cancelled", "out_for_delivery"].includes(order.status)) {
    response.status(409).json({ error: "Change the order status before changing its rider." });
    return;
  }
  if (riderId === null) {
    delete order.assignedRider;
    writeStore(store);
    response.json({ order: publicOrder(order) });
    return;
  }
  const rider = store.riders.find((entry) => entry.id === riderId && entry.active !== false);
  if (!rider) {
    response.status(404).json({ error: "Choose an active rider account." });
    return;
  }
  order.assignedRider = { id: rider.id, name: rider.name };
  delete order.trackingLocation;
  delete order.deliveryProofs;
  delete order.customerConfirmedAt;
  delete order.deliveryOverrideCode;
  delete order.deliveryPhotoOverride;
  order.deliveryLocationMismatch = false;
  writeStore(store);
  response.json({ order: publicOrder(order) });
});

app.patch("/api/rider/orders/:id/customer-details", requireRider, (request, response) => {
  const { customer, address } = request.body || {};
  if (
    !customer ||
    !validateText(customer.name, 80) ||
    typeof customer.phone !== "string" ||
    !/^[0-9+() -]{7,20}$/.test(customer.phone.trim()) ||
    !address ||
    !validateText(address.line1, 160, 8) ||
    !validateText(address.area, 100, 2) ||
    !validateText(address.city, 80) ||
    address.city.trim().toLowerCase() !== "markapur" ||
    !/^\d{6}$/.test(String(address.pincode || "")) ||
    !validateText(address.landmark, 120, 3)
  ) {
    response.status(400).json({
      error: "Enter a customer name, valid phone, Markapur street, area, PIN code, and landmark.",
    });
    return;
  }

  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.assignedRider?.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "This order is not assigned to your rider account." });
    return;
  }
  if (["delivered", "cancelled"].includes(order.status)) {
    response.status(409).json({ error: "Customer details can no longer be changed for a completed order." });
    return;
  }

  const nextAddress = {
    line1: address.line1.trim(),
    area: address.area.trim(),
    city: "Markapur",
    pincode: String(address.pincode).trim(),
    landmark: address.landmark.trim(),
  };
  const addressChanged = ["line1", "area", "city", "pincode", "landmark"].some(
    (field) => order.address[field] !== nextAddress[field],
  );
  order.customer.name = customer.name.trim();
  order.customer.phone = customer.phone.trim();
  order.address = {
    ...order.address,
    ...nextAddress,
  };
  if (addressChanged) {
    delete order.trackingLocation;
    delete order.deliveryProofs;
    delete order.customerConfirmedAt;
    delete order.deliveryOverrideCode;
    delete order.deliveryPhotoOverride;
    order.deliveryLocationMismatch = false;
  }
  order.updatedAt = new Date().toISOString();
  writeStore(store);
  response.json({
    order: publicOrder(order),
    addressChanged,
    message: addressChanged
      ? "Customer details updated. Share fresh GPS and retake delivery photos for the updated address."
      : "Customer details updated for this order.",
  });
});

app.post("/api/rider/orders/:id/location", requireRider, (request, response) => {
  const { latitude, longitude, accuracy, heading } = request.body || {};
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > deliveryConfirmRadiusMeters ||
    (heading !== null && heading !== undefined && (!Number.isFinite(heading) || heading < 0 || heading > 360))
  ) {
    response.status(400).json({ error: "A valid, accurate GPS location is required." });
    return;
  }
  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.assignedRider?.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "This order is not assigned to your rider account." });
    return;
  }
  if (order.status !== "out_for_delivery") {
    response.status(409).json({ error: "Location sharing is available only during an active delivery." });
    return;
  }
  order.trackingLocation = {
    latitude,
    longitude,
    accuracy,
    heading: heading ?? null,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  response.json({ updatedAt: order.trackingLocation.updatedAt });
});

async function prepareLocationApprovalCode(request, response, requireRiderLocation) {
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === request.params.id);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (
    requireRiderLocation &&
    order.assignedRider?.id !== request.session.sub
  ) {
    response.status(404).json({ error: "This order is not assigned to your rider account." });
    return;
  }
  if (order.status !== "out_for_delivery" || !order.assignedRider) {
    response.status(409).json({ error: "Assign a rider and mark the order out for delivery before requesting customer approval." });
    return;
  }
  if (requireRiderLocation) {
    if (!isFreshLocation(order.trackingLocation)) {
      response.status(409).json({ error: "Start live location sharing and wait for a fresh GPS update before requesting customer approval." });
      return;
    }
    const distanceMeters = distanceInKm(order.address, order.trackingLocation) * 1000;
    if (distanceMeters <= deliveryConfirmRadiusMeters) {
      response.status(409).json({ error: "You are within the customer location radius; take photos directly without an approval code." });
      return;
    }
  }
  if ((order.deliveryProofs || []).filter(Boolean).length >= 3) {
    response.status(409).json({ error: "All delivery photos have already been uploaded." });
    return;
  }
  const digits = order.customer.phone?.replace(/\D/g, "") || "";
  if (digits.length < 10 || digits.length > 15) {
    response.status(409).json({ error: "This order has no valid customer WhatsApp phone number." });
    return;
  }

  const whatsappNumber =
    digits.length === 10
      ? `91${digits}`
      : digits.length === 11 && digits.startsWith("0")
        ? `91${digits.slice(1)}`
        : digits;
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + deliveryOverrideCodeLifetimeMs).toISOString();
  const message =
    `Froot Bowl Markapur: The rider is outside the saved delivery pin radius for order ${order.id}. ` +
    `If you approve photo capture, share this one-time code with the rider: ${code}. ` +
    `It expires in 10 minutes and does not mark the order delivered.`;
  const sent = await sendWhatsAppText(whatsappNumber, message);
  if (!sent.ok) {
    response.status(sent.status).json({ error: sent.error });
    return;
  }
  order.deliveryOverrideCode = {
    hash: hashDeliveryOverrideCode(order.id, code),
    expiresAt,
    attempts: 0,
  };
  delete order.deliveryPhotoOverride;
  writeStore(store);
  response.json({
    sent: true,
    expiresAt,
    message: "The one-time approval code was sent to the customer on WhatsApp. Ask them to share it with you.",
  });
}

app.post("/api/admin/orders/:id/location-override-code", requireAdmin, async (request, response) => {
  await prepareLocationApprovalCode(request, response, false);
});

app.post("/api/rider/orders/:id/location-override-code", requireRider, async (request, response) => {
  await prepareLocationApprovalCode(request, response, true);
});

app.post("/api/rider/orders/:id/location-override", requireRider, (request, response) => {
  const code = typeof request.body?.code === "string" ? request.body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    response.status(400).json({ error: "Enter the six-digit customer approval code." });
    return;
  }
  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.assignedRider?.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "This order is not assigned to your rider account." });
    return;
  }
  if (order.status !== "out_for_delivery") {
    response.status(409).json({ error: "Customer approval codes are available only during an active delivery." });
    return;
  }
  if ((order.deliveryProofs || []).filter(Boolean).length >= 3) {
    response.status(409).json({ error: "All delivery photos have already been uploaded." });
    return;
  }
  if (!isFreshLocation(order.trackingLocation)) {
    response.status(409).json({ error: "Share a fresh rider GPS location before entering the customer code." });
    return;
  }
  const distanceMeters = distanceInKm(order.address, order.trackingLocation) * 1000;
  if (distanceMeters <= deliveryConfirmRadiusMeters) {
    response.status(409).json({ error: "You are within the delivery area; no override code is needed." });
    return;
  }
  const approval = order.deliveryOverrideCode;
  if (!approval || Date.parse(approval.expiresAt) <= Date.now() || approval.attempts >= 5) {
    delete order.deliveryOverrideCode;
    writeStore(store);
    response.status(409).json({ error: "The customer approval code is missing, expired, or locked. Ask the admin to send a new code." });
    return;
  }
  const expected = Buffer.from(approval.hash, "hex");
  const actual = Buffer.from(hashDeliveryOverrideCode(order.id, code), "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    approval.attempts += 1;
    if (approval.attempts >= 5) delete order.deliveryOverrideCode;
    writeStore(store);
    response.status(400).json({
      error: approval.attempts >= 5
        ? "Too many incorrect attempts. Ask the admin to send a new customer approval code."
        : "That code is incorrect. Check the WhatsApp message and try again.",
    });
    return;
  }

  delete order.deliveryOverrideCode;
  order.deliveryPhotoOverride = {
    riderId: request.session.sub,
    expiresAt: new Date(Date.now() + deliveryPhotoOverrideLifetimeMs).toISOString(),
    remaining: 3 - (order.deliveryProofs || []).filter(Boolean).length,
  };
  writeStore(store);
  response.json({
    deliveryPhotoOverrideActive: true,
    message: "Customer approval verified. You can upload the remaining delivery photos for 15 minutes. The customer must still confirm receipt.",
  });
});

app.put("/api/rider/orders/:id/proofs/:slot", requireRider, (request, response) => {
  const slot = Number(request.params.slot);
  const { imageData } = request.body || {};
  const match =
    typeof imageData === "string" &&
    imageData.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3 || !match) {
    response.status(400).json({ error: "Upload a valid JPEG, PNG, or WebP proof image in one of the three photo slots." });
    return;
  }
  const image = Buffer.from(match[2], "base64");
  const isJpeg = match[1] === "jpeg" && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const isPng =
    match[1] === "png" &&
    image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    match[1] === "webp" &&
    image.toString("ascii", 0, 4) === "RIFF" &&
    image.toString("ascii", 8, 12) === "WEBP";
  if (image.length > 200_000 || !(isJpeg || isPng || isWebp)) {
    response.status(400).json({ error: "Use a valid delivery photo smaller than 200 KB." });
    return;
  }
  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.assignedRider?.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "This order is not assigned to your rider account." });
    return;
  }
  if (order.status !== "out_for_delivery") {
    response.status(409).json({ error: "Delivery photos can be added only during an active delivery." });
    return;
  }
  if (!isFreshLocation(order.trackingLocation)) {
    response.status(409).json({ error: "Share a fresh rider GPS location before taking delivery photos." });
    return;
  }
  const photoDistanceMeters = distanceInKm(order.address, order.trackingLocation) * 1000;
  const photoOverride = order.deliveryPhotoOverride;
  const hasPhotoOverride =
    photoOverride?.riderId === request.session.sub &&
    photoOverride.remaining > 0 &&
    Date.parse(photoOverride.expiresAt) > Date.now();
  const outsideDeliveryArea = photoDistanceMeters > deliveryConfirmRadiusMeters;
  if (outsideDeliveryArea && !hasPhotoOverride) {
    response.status(409).json({
      error: `Delivery photos can be captured only within ${deliveryConfirmRadiusMeters} m of the saved customer location.`,
    });
    return;
  }
  const photos = Array.isArray(order.deliveryProofs) ? order.deliveryProofs : [null, null, null];
  const replacingExistingPhoto = Boolean(photos[slot - 1]);
  if (outsideDeliveryArea && hasPhotoOverride && replacingExistingPhoto) {
    response.status(409).json({ error: "Use an empty photo slot while customer-approved out-of-area capture is active." });
    return;
  }
  photos[slot - 1] = { imageData, uploadedAt: new Date().toISOString() };
  order.deliveryProofs = photos;
  if (outsideDeliveryArea && !replacingExistingPhoto) {
    photoOverride.remaining -= 1;
    if (photoOverride.remaining <= 0) delete order.deliveryPhotoOverride;
  }
  writeStore(store);
  response.json({ deliveryProofCount: photos.filter(Boolean).length });
});

app.get("/api/orders/:id/proofs", requireAuth, (request, response) => {
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === request.params.id);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  const authorized =
    request.session.role === "admin" ||
    order.customer.id === request.session.sub ||
    order.assignedRider?.id === request.session.sub;
  if (!authorized) {
    response.status(403).json({ error: "You are not authorized to view this delivery proof." });
    return;
  }
  response.json({
    photos: (order.deliveryProofs || []).map((proof) => proof?.imageData || null),
  });
});

app.post("/api/orders/:id/confirm-delivery", requireAuth, (request, response) => {
  if (request.session.role !== "customer") {
    response.status(403).json({ error: "Only the customer can confirm receipt of this order." });
    return;
  }
  const store = readStore();
  const order = store.orders.find(
    (entry) =>
      entry.id === request.params.id &&
      entry.customer.id === request.session.sub,
  );
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.status !== "out_for_delivery") {
    response.status(409).json({ error: "This order is not awaiting delivery confirmation." });
    return;
  }
  if ((order.deliveryProofs || []).filter(Boolean).length !== 3) {
    response.status(409).json({ error: "The rider must upload all three delivery photos before you can confirm receipt." });
    return;
  }
  if (!order.trackingLocation?.updatedAt) {
    response.status(409).json({ error: "The rider’s live location is not available yet. Please try again shortly." });
    return;
  }
  if (!isFreshLocation(order.trackingLocation)) {
    response.status(409).json({ error: "The rider’s location is out of date. Please wait for a fresh location update." });
    return;
  }
  const distanceMeters =
    distanceInKm(order.address, order.trackingLocation) * 1000;
  const now = new Date().toISOString();
  order.deliveryLocationMismatch = distanceMeters > deliveryConfirmRadiusMeters;
  order.customerConfirmedAt = now;
  order.deliveryConfirmedAt = now;
  order.status = "delivered";
  order.updatedAt = now;
  order.statusHistory.push({ status: "delivered", label: statusLabels.delivered, at: now });
  writeStore(store);
  response.json({
    order: publicOrder(order),
    locationMismatch: order.deliveryLocationMismatch,
    distanceMeters: Math.round(distanceMeters),
  });
});

app.patch("/api/admin/orders/:id/status", requireAdmin, (request, response) => {
  const { status } = request.body || {};
  if (![...orderStatuses, "cancelled"].includes(status)) {
    response.status(400).json({ error: "Choose a valid order status." });
    return;
  }

  const store = readStore();
  const order = store.orders.find((entry) => entry.id === request.params.id);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    response.status(409).json({ error: "A completed order cannot be changed." });
    return;
  }
  if (status === "out_for_delivery") {
    order.deliveryProofs = [null, null, null];
    delete order.customerConfirmedAt;
    order.deliveryLocationMismatch = false;
    delete order.trackingLocation;
    delete order.deliveryOverrideCode;
    delete order.deliveryPhotoOverride;
  }

  const now = new Date().toISOString();
  order.status = status;
  order.updatedAt = now;
  order.statusHistory.push({ status, label: statusLabels[status], at: now });
  writeStore(store);
  response.json({ order: publicOrder(order) });
});

app.patch("/api/admin/orders/:id/address", requireAdmin, (request, response) => {
  const { address, location, markVerified = false } = request.body || {};
  if (
    !address ||
    (address.line1 !== "" && !validateText(address.line1, 160, 2)) ||
    !validateText(address.area, 100, 2) ||
    (address.pincode && !/^\d{6}$/.test(String(address.pincode))) ||
    (address.landmark !== "" && !validateText(address.landmark, 120, 2)) ||
    (address.instructions !== undefined &&
      (typeof address.instructions !== "string" || address.instructions.length > 300)) ||
    typeof markVerified !== "boolean" ||
    !Number.isFinite(location?.latitude) ||
    !Number.isFinite(location?.longitude) ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(location.longitude) > 180
  ) {
    response.status(400).json({ error: "Enter a valid street or house number, area, optional six-digit PIN, landmark, instructions, and map location." });
    return;
  }
  const serviceability = checkDeliveryLocation(location);
  if (!serviceability.serviceable) {
    response.status(400).json({ error: serviceability.message });
    return;
  }
  const store = readStore();
  const order = store.orders.find((entry) => entry.id === request.params.id);
  if (!order) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  const previous = { ...order.address };
  const now = new Date().toISOString();
  order.address = {
    ...order.address,
    line1: address.line1.trim(),
    area: address.area.trim(),
    city: "Markapur",
    pincode: String(address.pincode || "").trim(),
    landmark: typeof address.landmark === "string" ? address.landmark.trim() : "",
    instructions: typeof address.instructions === "string" ? address.instructions.trim() : "",
    latitude: location.latitude,
    longitude: location.longitude,
    osmDisplayName: "",
    osmType: null,
    osmId: null,
    verificationStatus: markVerified ? "admin-verified" : "unverified",
    ...(markVerified ? { reviewedByAdminAt: now } : { reviewedByAdminAt: null }),
  };
  order.addressReviewHistory = Array.isArray(order.addressReviewHistory)
    ? order.addressReviewHistory
    : [];
  order.addressReviewHistory.push({
    adminId: request.session.sub,
    reviewedAt: now,
    previous,
    next: { ...order.address },
  });
  order.addressReviewHistory = order.addressReviewHistory.slice(-100);
  order.updatedAt = now;
  writeStore(store);
  response.json({ order: publicOrder(order) });
});

app.delete("/api/admin/orders/:id", requireAdmin, (request, response) => {
  const store = readStore();
  const orderIndex = store.orders.findIndex(
    (entry) => entry.id === request.params.id,
  );
  if (orderIndex < 0) {
    response.status(404).json({ error: "Order not found." });
    return;
  }
  if (store.orders[orderIndex].status !== "delivered") {
    response.status(409).json({ error: "Only delivered orders can be deleted." });
    return;
  }
  store.orders.splice(orderIndex, 1);
  writeStore(store);
  response.status(204).end();
});

app.use((error, _request, response, _next) => {
  console.error("Backend request failed:", error);
  response.status(500).json({ error: "The request could not be completed." });
});

if (!adminEmail || !adminPassword) {
  console.warn("Admin login is disabled. Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env.");
}
if (!process.env.SESSION_SECRET) {
  console.warn("SESSION_SECRET is not set. Sign-in sessions will reset when the server restarts.");
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Froot Bowl API listening at http://localhost:${port}`);
});
