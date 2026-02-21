// frontend/src/lib/purchases.js
import { Capacitor } from "@capacitor/core";

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

function isNative() {
  return Capacitor?.isNativePlatform?.() ?? false;
}

// Lazy-load implementation so Vercel never has to resolve native code.
let implPromise = null;
async function getImpl() {
  if (implPromise) return implPromise;

  if (!isNative()) {
    implPromise = import("./purchases.web.js");
    return implPromise;
  }

  // Important: don't let Vite/Rollup try to resolve this at build time
  implPromise = import(/* @vite-ignore */ "./purchases.native.js");
  return implPromise;
}

export async function initPurchases(...args) {
  const mod = await getImpl();
  return mod.initPurchases(...args);
}

export async function loadProducts(...args) {
  const mod = await getImpl();
  return mod.loadProducts(...args);
}

export async function buyProduct(...args) {
  const mod = await getImpl();
  return mod.buyProduct(...args);
}

export async function restorePurchases(...args) {
  const mod = await getImpl();
  return mod.restorePurchases(...args);
}

export async function getProStatus(...args) {
  const mod = await getImpl();
  return mod.getProStatus(...args);
}