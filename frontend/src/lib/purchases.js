// frontend/src/lib/purchases.js
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor?.isNativePlatform?.() ?? false;

const mod = isNative
  ? await import("./purchases.native.js")
  : await import("./purchases.web.js");

export const SUBS_IDS = mod.SUBS_IDS;
export const initPurchases = mod.initPurchases;
export const loadProducts = mod.loadProducts;
export const buyProduct = mod.buyProduct;
export const restorePurchases = mod.restorePurchases;
export const getProStatus = mod.getProStatus;