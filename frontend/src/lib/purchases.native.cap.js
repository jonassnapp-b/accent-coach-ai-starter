// frontend/src/lib/purchases.native.cap.js
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
console.log("[BUILD] purchases.native.cap.js loaded");
console.log("[BUILD] Capacitor.isNativePlatform() =", Capacitor?.isNativePlatform?.());

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

const isNative = Capacitor?.isNativePlatform?.() ?? false;
console.log("[Purchases] native file loaded. isNative=", isNative);
// IMPORTANT:
// Make the module id opaque so Vite/Rollup can't resolve it during web builds.


function normalizeProduct(p) {
  const id = p?.identifier ?? p?.productIdentifier ?? p?.productId ?? p?.id;
  const title = p?.title ?? p?.localizedTitle ?? p?.displayName ?? "";
  const priceString = p?.priceString ?? p?.localizedPrice ?? p?.price ?? "";
  return { id, title, priceString, _raw: p };
}

export async function initPurchases() {
  if (!isNative) return { ok: false, reason: "not_native" };

  console.log("[Purchases] NativePurchases object =", NativePurchases);

  try {
    const sup = await NativePurchases.isBillingSupported();
    console.log("[Purchases] isBillingSupported =", sup);

    if (!sup?.isBillingSupported) {
      return { ok: false, reason: "billing_not_supported" };
    }

    return { ok: true };
  } catch (e) {
    console.log("[Purchases] init FAILED", e);
    return { ok: false, reason: "init_failed", error: String(e?.message ?? e) };
  }
}

export async function loadProducts() {
  console.log("[Purchases] loadProducts() called");

  if (!isNative) return [];

  try {
    console.log("[Purchases] calling getProducts with IDs =", SUBS_IDS);

    const res = await NativePurchases.getProducts({
      productIdentifiers: SUBS_IDS,
      productType: PURCHASE_TYPE.SUBS,
    });

    console.log("[Purchases] raw getProducts response =", res);

    const raw = res?.products ?? [];
    return raw.map(normalizeProduct).filter((p) => !!p.id);
  } catch (e) {
    console.log("[Purchases] getProducts FAILED", e);
    return [];
  }
}

export async function buyProduct(productId) {
  if (!isNative) return { ok: false, reason: "not_native" };

  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
      quantity: 1,
    });

    return { ok: true, transaction };
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.toLowerCase().includes("cancel")) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "purchase_failed", error: msg };
  }
}

export async function restorePurchases() {
  if (!isNative) return { ok: false, reason: "not_native" };

  try {
    await NativePurchases.restorePurchases();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "restore_failed", error: String(e?.message ?? e) };
  }
}

export async function getProStatus() {
  console.log("[Purchases] getProStatus() called");

  if (!isNative) return { isPro: false, activeProductIds: [] };

  try {
    const res = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.SUBS,
    });

    console.log("[Purchases] getPurchases raw response =", res);

    const purchases = res?.purchases ?? [];
    const active = purchases.filter((p) => p?.isActive);

    const activeProductIds = Array.from(
      new Set(
        active
          .map((p) => p?.productIdentifier ?? p?.identifier ?? p?.id)
          .filter(Boolean)
      )
    );

    return {
      isPro: activeProductIds.length > 0,
      activeProductIds,
      _raw: purchases,
    };
  } catch (e) {
    console.log("[Purchases] getProStatus FAILED", e);
    return { isPro: false, activeProductIds: [], error: String(e?.message ?? e) };
  }
}