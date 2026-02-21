// frontend/src/lib/purchases.native.js
import { Capacitor } from "@capacitor/core";

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

const isNative = Capacitor?.isNativePlatform?.() ?? false;

let capgoPromise = null;
async function getCapgo() {
  if (!isNative) return null;
  if (!capgoPromise) capgoPromise = import(/* @vite-ignore */ "@capgo/native-purchases");
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
  if (!isNative) return [];
  const capgo = await getCapgo();
  if (!capgo) return [];

  const { NativePurchases, PURCHASE_TYPE } = capgo;
  try {
    const res = await NativePurchases.getProducts({
      productIdentifiers: SUBS_IDS,
      productType: PURCHASE_TYPE.SUBS,
    });
    const raw = res?.products ?? [];
    return raw.map(normalizeProduct).filter((p) => !!p.id);
  } catch (e) {
    console.log("[Purchases] loadProducts error:", e);
    return [];
  }
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
    return { isPro: activeProductIds.length > 0, activeProductIds, _raw: purchases };
  } catch (e) {
    return { isPro: false, activeProductIds: [], error: String(e?.message ?? e) };
  }
}