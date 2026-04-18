import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

import {
  firebaseClientConfig,
  firebaseEnvErrorMessage,
  hasFirebaseClientEnv,
} from "@/lib/firebase/config";

const app: FirebaseApp | null = hasFirebaseClientEnv
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseClientConfig!)
  : null;

export const firebaseApp = app;
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseDb: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export function assertFirebaseConfigured() {
  if (!firebaseApp) {
    throw new Error(firebaseEnvErrorMessage || "Firebase is not configured.");
  }
}

export async function initFirebaseAnalytics() {
  if (
    typeof window === "undefined" ||
    !firebaseClientConfig?.measurementId ||
    !firebaseApp
  ) {
    return null;
  }

  const analyticsModule = await import("firebase/analytics");
  const supported = await analyticsModule.isSupported();
  if (!supported) {
    return null;
  }

  return analyticsModule.getAnalytics(firebaseApp);
}
