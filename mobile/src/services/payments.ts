import { Platform } from "react-native";
import { PlanChoice } from "../api/subscriptions";
import * as Iap from "./iap";

type StartParams = {
  plan: PlanChoice;
};

export const startSubscription = async ({ plan }: StartParams) => {
  if (Platform.OS === "ios") return Iap.purchaseSubscription(plan);
  throw new Error(
    "Subscriptions are currently available on iOS only. Android billing is coming soon."
  );
};

export const restorePurchases = async () => {
  if (Platform.OS !== "ios") {
    throw new Error("Restore purchases is only required on iOS.");
  }
  return Iap.restorePurchases();
};

export const bootstrapPayments = async () => {
  try {
    if (Platform.OS !== "ios") return;
    await Iap.initIapConnection();
    await Iap.settlePendingPurchases();
  } catch (err) {
    console.warn(
      "[Payments] Skipping IAP bootstrap (likely Expo Go or missing native module):",
      err
    );
  }
};

export const fetchProductMetadata = async () => {
  if (Platform.OS !== "ios") return [];
  return Iap.fetchProducts();
};
