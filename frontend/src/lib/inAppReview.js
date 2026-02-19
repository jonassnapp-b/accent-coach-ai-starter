import { Capacitor } from "@capacitor/core";
import { InAppReview } from "@capacitor-community/in-app-review";

export async function requestAppReview() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await InAppReview.requestReview();
  } catch {
    // Apple kan vælge ikke at vise prompten – det er normalt.
  }
}
