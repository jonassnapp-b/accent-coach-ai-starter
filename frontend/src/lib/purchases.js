// frontend/src/lib/purchases.js
import { Capacitor, registerPlugin } from "@capacitor/core";

function isNative() {
  return Capacitor?.isNativePlatform?.() ?? false;
}

// IMPORTANT: plugin name must match the native plugin registration name.
// For CapgoNativePurchases, this is typically "CapgoNativePurchases".
const NativePurchases = registerPlugin("CapgoNativePurchases");

function isObj(x) {
  return x && typeof x === "object";
}

function pickFirst(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return undefined;
}

// --- Public API matching what your Paywall.jsx expects ---

export async function initPurchases({ apiKey } = {}) {
  if (!isNative()) return { ok: false, reason: "not_native" };

  // try common configure shapes
  try {
    if (apiKey) {
      if (typeof NativePurchases.configure === "function") {
        await NativePurchases.configure({ apiKey });
      } else if (typeof NativePurchases.setApiKey === "function") {
        await NativePurchases.setApiKey({ apiKey });
      } else if (typeof NativePurchases.setup === "function") {
        await NativePurchases.setup({ apiKey });
      } else {
        // no configure method found; still ok to continue for now
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "configure_failed", error: String(e?.message || e) };
  }
}

export async function loadProducts() {
  if (!isNative()) return [];

  try {
    // try offerings methods
    if (typeof NativePurchases.getOfferings === "function") {
      const offerings = await NativePurchases.getOfferings();
      // normalize common shapes
      const current =
        pickFirst(offerings, ["current", "currentOffering", "offering"]) || offerings;

      const pkgs =
        pickFirst(current, ["availablePackages", "packages", "available_packages"]) || [];

      // return a list your UI can render
      if (Array.isArray(pkgs)) {
        return pkgs.map((p) => {
          const product =
            pickFirst(p, ["product", "storeProduct", "store_product"]) || p;
          return {
            productIdentifier:
              pickFirst(product, ["productIdentifier", "identifier", "id"]) ||
              pickFirst(p, ["productIdentifier", "identifier", "id"]),
            title: pickFirst(product, ["title", "name"]) || "Pro",
            price:
              pickFirst(product, ["priceString", "price", "price_string"]) || "",
            _raw: p,
          };
        }).filter(x => !!x.productIdentifier);
      }
      return [];
    }

    // fallback: direct products call (some plugins expose this)
    if (typeof NativePurchases.getProducts === "function") {
      const res = await NativePurchases.getProducts();
      if (!Array.isArray(res)) return [];
      return res.map((p) => ({
        productIdentifier: pickFirst(p, ["productIdentifier", "identifier", "id"]),
        title: pickFirst(p, ["title", "name"]) || "Pro",
        price: pickFirst(p, ["priceString", "price"]) || "",
        _raw: p,
      })).filter(x => !!x.productIdentifier);
    }

    return [];
  } catch (e) {
    console.warn("[Purchases] loadProducts failed:", e);
    return [];
  }
}

export async function buyProduct(productId) {
  if (!isNative()) return { ok: false, reason: "not_native" };
  if (!productId) return { ok: false, reason: "missing_product_id" };

  try {
    // try common method names
    if (typeof NativePurchases.purchaseProduct === "function") {
      const res = await NativePurchases.purchaseProduct({ productIdentifier: productId });
      return { ok: true, res };
    }
    if (typeof NativePurchases.purchase === "function") {
      const res = await NativePurchases.purchase({ productIdentifier: productId });
      return { ok: true, res };
    }
    return { ok: false, reason: "missing_method" };
  } catch (e) {
    return { ok: false, reason: "purchase_failed", error: String(e?.message || e) };
  }
}

export async function restorePurchases() {
  if (!isNative()) return { ok: false, reason: "not_native" };

  try {
    if (typeof NativePurchases.restorePurchases === "function") {
      const res = await NativePurchases.restorePurchases();
      return { ok: true, res };
    }
    if (typeof NativePurchases.restore === "function") {
      const res = await NativePurchases.restore();
      return { ok: true, res };
    }
    return { ok: false, reason: "missing_method" };
  } catch (e) {
    return { ok: false, reason: "restore_failed", error: String(e?.message || e) };
  }
}

export async function getCustomerInfo() {
  if (!isNative()) return null;

  try {
    if (typeof NativePurchases.getCustomerInfo === "function") {
      return await NativePurchases.getCustomerInfo();
    }
    if (typeof NativePurchases.getPurchaserInfo === "function") {
      return await NativePurchases.getPurchaserInfo();
    }
    return null;
  } catch (e) {
    console.warn("[Purchases] getCustomerInfo failed:", e);
    return null;
  }
}
