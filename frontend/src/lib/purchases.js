import { Capacitor } from "@capacitor/core";

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

function isNative() {
  return Capacitor?.isNativePlatform?.() ?? false;
}

let implPromise = null;

async function getImpl() {
  if (implPromise) return implPromise;

  if (!isNative()) {
    implPromise = import("./purchases.web.js");
    return implPromise;
  }

  // renamed file + vite-ignore so Rollup won't crawl/resolve it in web builds
  implPromise = import(/* @vite-ignore */ "./purchases.native.cap.js");
  return implPromise;
}

export async function initPurchases(...args) {
  return (await getImpl()).initPurchases(...args);
}
export async function loadProducts(...args) {
  return (await getImpl()).loadProducts(...args);
}
export async function buyProduct(...args) {
  return (await getImpl()).buyProduct(...args);
}
export async function restorePurchases(...args) {
  return (await getImpl()).restorePurchases(...args);
}
export async function getProStatus(...args) {
  return (await getImpl()).getProStatus(...args);
}