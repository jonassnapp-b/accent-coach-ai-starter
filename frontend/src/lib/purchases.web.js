// frontend/src/lib/purchases.web.js
export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

export async function initPurchases() {
  return { ok: false, reason: "not_native" };
}
export async function loadProducts() {
  return [];
}
export async function buyProduct() {
  return { ok: false, reason: "not_native" };
}
export async function restorePurchases() {
  return { ok: false, reason: "not_native" };
}
export async function getProStatus() {
  return { isPro: false, activeProductIds: [] };
}