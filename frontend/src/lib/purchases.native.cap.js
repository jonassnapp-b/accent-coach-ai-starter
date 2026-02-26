// frontend/src/lib/purchases.native.cap.js
import { Capacitor } from "@capacitor/core";
console.log("[Purchases] purchases.native.cap.js LOADED");
export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

const isNative = Capacitor?.isNativePlatform?.() ?? false;

// IMPORTANT:
// Make the module id opaque so Vite/Rollup can't resolve it during web builds.
let capgoPromise = null;
async function getCapgo() {
  if (!isNative) return null;

  if (!capgoPromise) {
    // IMPORTANT: do NOT use @vite-ignore here, we WANT Vite to bundle it.
    capgoPromise = import("@capgo/native-purchases");
  }

  try {
    return await capgoPromise;
  } catch (e) {
    console.log("[Purchases] Failed to load @capgo/native-purchases:", e);
    return null;
  }
}

function normalizeProduct(p) {
  const id = p?.identifier ?? p?.productIdentifier ?? p?.productId ?? p?.id;
  const title = p?.title ?? p?.localizedTitle ?? p?.displayName ?? "";
  const priceString = p?.priceString ?? p?.localizedPrice ?? p?.price ?? "";
  return { id, title, priceString, _raw: p };
}

export async function initPurchases() {
  if (!isNative) return { ok: false, reason: "not_native" };
  const capgo = await getCapgo();
  if (!capgo) return { ok: false, reason: "capgo_missing" };

  const { NativePurchases } = capgo;
  try {
    const sup = await NativePurchases.isBillingSupported();
    if (!sup?.isBillingSupported) return { ok: false, reason: "billing_not_supported" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "init_failed", error: String(e?.message ?? e) };
  }
}

export async function loadProducts() {
  console.log("[Purchases] loadProducts() CALLED. isNative=", isNative);
  console.log("[Purchases] platform:", Capacitor?.getPlatform ? Capacitor.getPlatform() : "no platform");
  console.log("[Purchases] SUBS_IDS:", SUBS_IDS);

  if (!isNative) return [];
  const capgo = await getCapgo();
  if (!capgo) return [];

  const { NativePurchases, PURCHASE_TYPE } = capgo;

  console.log("[Purchases] capgo module keys:", Object.keys(capgo || {}));
  console.log("[Purchases] NativePurchases keys:", Object.keys(NativePurchases || {}));
  console.log("[Purchases] PURCHASE_TYPE:", PURCHASE_TYPE);
  try {
    console.log("[Purchases] PURCHASE_TYPE keys:", Object.keys(PURCHASE_TYPE || {}));
  } catch {}

  // Capgo kan have forskellige enum-navne mellem versioner.
  const subType =
    PURCHASE_TYPE?.SUBS ??
    PURCHASE_TYPE?.SUBSCRIPTION ??
    PURCHASE_TYPE?.AUTO_RENEWABLE_SUBSCRIPTION ??
    PURCHASE_TYPE?.AUTO_RENEW_SUBSCRIPTION ??
    PURCHASE_TYPE?.AUTO_RENEWABLE ??
    PURCHASE_TYPE?.SUB;

  const attempts = [
    { name: "A productIdentifiers + productType", payload: { productIdentifiers: SUBS_IDS, productType: subType } },
    { name: "B productIdentifiers only", payload: { productIdentifiers: SUBS_IDS } },
    { name: "C identifiers + productType", payload: { identifiers: SUBS_IDS, productType: subType } },
    { name: "D identifiers only", payload: { identifiers: SUBS_IDS } },
    { name: "E productIds + productType", payload: { productIds: SUBS_IDS, productType: subType } },
    { name: "F productIds only", payload: { productIds: SUBS_IDS } },
    { name: "G ids + productType", payload: { ids: SUBS_IDS, productType: subType } },
    { name: "H ids only", payload: { ids: SUBS_IDS } },
  ];

  for (const a of attempts) {
    try {
      console.log(`[Purchases] getProducts attempt: ${a.name}`, a.payload);

      const res = await NativePurchases.getProducts(a.payload);

      console.log(
        `[Purchases] ${a.name} res json:`,
        (() => {
          try {
            return JSON.stringify(res);
          } catch {
            return "<unstringifiable>";
          }
        })()
      );

      const raw = res?.products ?? res ?? [];
      const normalized = Array.isArray(raw) ? raw.map(normalizeProduct).filter((p) => !!p.id) : [];

      console.log(`[Purchases] ${a.name} normalized count:`, normalized.length);
      if (normalized.length) return normalized;
    } catch (e) {
      console.log(`[Purchases] ${a.name} ERROR (raw):`, e);
      console.log(`[Purchases] ${a.name} ERROR message:`, String(e?.message ?? e));
      try {
        console.log(`[Purchases] ${a.name} ERROR json:`, JSON.stringify(e));
      } catch {}
    }
  }

  console.log("[Purchases] All getProducts attempts returned empty.");
  return [];
}

export async function buyProduct(productId) {
  if (!isNative) return { ok: false, reason: "not_native" };
  const capgo = await getCapgo();
  if (!capgo) return { ok: false, reason: "capgo_missing" };

  const { NativePurchases, PURCHASE_TYPE } = capgo;
  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
      quantity: 1,
    });
    return { ok: true, transaction };
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.toLowerCase().includes("cancel")) return { ok: false, reason: "cancelled" };
    return { ok: false, reason: "purchase_failed", error: msg };
  }
}

export async function restorePurchases() {
  if (!isNative) return { ok: false, reason: "not_native" };
  const capgo = await getCapgo();
  if (!capgo) return { ok: false, reason: "capgo_missing" };

  const { NativePurchases } = capgo;
  try {
    await NativePurchases.restorePurchases();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "restore_failed", error: String(e?.message ?? e) };
  }
}

export async function getProStatus() {
  if (!isNative) return { isPro: false, activeProductIds: [] };
  const capgo = await getCapgo();
  if (!capgo) return { isPro: false, activeProductIds: [], reason: "capgo_missing" };

  const { NativePurchases, PURCHASE_TYPE } = capgo;
  try {
    const res = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    const purchases = res?.purchases ?? [];
    const active = purchases.filter((p) => p?.isActive);
    const activeProductIds = Array.from(
      new Set(active.map((p) => p?.productIdentifier ?? p?.identifier ?? p?.id).filter(Boolean))
    );
    console.log("[DEBUG] getProStatus result:", {
  isPro: activeProductIds.length > 0,
  activeProductIds
});
    return { isPro: activeProductIds.length > 0, activeProductIds, _raw: purchases };
  } catch (e) {
    return { isPro: false, activeProductIds: [], error: String(e?.message ?? e) };
  }
}