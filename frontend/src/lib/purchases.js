// frontend/src/lib/purchases.js
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

function isNative() {
  return Capacitor?.isNativePlatform?.() ?? false;
}

function normalizeProduct(p) {
  // Capgo kan returnere lidt forskellige shapes på tværs af versioner/platforme
  const id =
    p?.identifier ??
    p?.productIdentifier ??
    p?.productId ??
    p?.id;

  const title =
    p?.title ??
    p?.localizedTitle ??
    p?.displayName ??
    "";

  const priceString =
    p?.priceString ??
    p?.localizedPrice ??
    p?.price ??
    "";

  return {
    id,
    title,
    priceString,
    _raw: p,
  };
}

export async function initPurchases() {
  if (!isNative()) return { ok: false, reason: "not_native" };

  try {
    const sup = await NativePurchases.isBillingSupported();
    if (!sup?.isBillingSupported) return { ok: false, reason: "billing_not_supported" };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "init_failed", error: String(e?.message ?? e) };
  }
}

export async function loadProducts() {
  if (!isNative()) return [];

  try {
    const res = await NativePurchases.getProducts({
      productIdentifiers: SUBS_IDS,
      productType: PURCHASE_TYPE.SUBS,
    });

    const rawProducts = res?.products ?? [];
    const products = rawProducts
      .map(normalizeProduct)
      .filter((p) => !!p.id); // vigtigt: kun gyldige

    console.log("[Purchases] loadProducts raw:", rawProducts);
    console.log("[Purchases] loadProducts normalized:", products);

    return products;
  } catch (e) {
    console.log("[Purchases] loadProducts error:", e);
    return [];
  }
}

export async function buyProduct(productId) {
  if (!isNative()) return { ok: false, reason: "not_native" };

  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
      quantity: 1,
    });

    return { ok: true, transaction };
  } catch (e) {
    const msg = String(e?.message ?? e);
    // bred cancel-detektion (Capacitor errors varierer)
    if (msg.toLowerCase().includes("cancel")) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "purchase_failed", error: msg };
  }
}

export async function restorePurchases() {
  if (!isNative()) return { ok: false, reason: "not_native" };

  try {
    await NativePurchases.restorePurchases();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "restore_failed", error: String(e?.message ?? e) };
  }
}

/**
 * Pro entitlement (client-side):
 * - korrekt ift. sandbox/testflight, og “ikke bare localStorage=true”
 * - production-grade kan senere udvides med server verification.
 */
export async function getProStatus() {
  if (!isNative()) return { isPro: false, activeProductIds: [] };

  try {
    const res = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
    const purchases = res?.purchases ?? [];

    // Capgo iOS subs har typisk isActive
    const active = purchases.filter((p) => p?.isActive);

    const activeProductIds = Array.from(
      new Set(
        active
          .map((p) => p?.productIdentifier ?? p?.identifier ?? p?.id)
          .filter(Boolean)
      )
    );

    return { isPro: activeProductIds.length > 0, activeProductIds, _raw: purchases };
  } catch (e) {
    console.log("[Purchases] getProStatus error:", e);
    return { isPro: false, activeProductIds: [], error: String(e?.message ?? e) };
  }
}
