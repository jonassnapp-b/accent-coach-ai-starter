// frontend/src/lib/purchases.js
import { Capacitor } from "@capacitor/core";
console.log("[BUILD] purchases.js loaded");

export const SUBS_IDS = ["fluentup.pro.monthly", "fluentup.pro.yearly"];

function isNative() {
  return Capacitor?.isNativePlatform?.() ?? false;
}

let implPromise = null;

async function getImpl() {
  console.log("[BUILD] getImpl() called");
  console.log("[BUILD] isNative() =", isNative());

  if (implPromise) {
    console.log("[BUILD] returning cached implPromise");
    return implPromise;
  }

  if (!isNative()) {
    console.log("[BUILD] loading WEB purchases implementation");
    implPromise = import("./purchases.web.js");
    return implPromise;
  }

  console.log("[BUILD] attempting native import purchases.native.cap.js");
  implPromise = import("./purchases.native.cap.js");
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