// This file is safe for Vercel. It selects the right implementation per platform.
import { Capacitor } from "@capacitor/core";

const isNative = Capacitor?.isNativePlatform?.() ?? false;

// top-level await is supported in Vite
const mod = isNative
  ? await import("./purchases.native.js")
  : await import("./purchases.web.js");

export const SUBS_IDS = mod.SUBS_IDS;
export const initPurchases = mod.initPurchases;
export const loadProducts = mod.loadProducts;
export const buyProduct = mod.buyProduct;
export const restorePurchases = mod.restorePurchases;
export const getProStatus = mod.getProStatus;