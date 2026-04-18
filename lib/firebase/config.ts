export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const rawFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

export const missingFirebaseEnv = Object.entries(rawFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const hasFirebaseClientEnv = missingFirebaseEnv.length === 0;

export const firebaseEnvErrorMessage = hasFirebaseClientEnv
  ? ""
  : `Missing Firebase environment variable(s): ${missingFirebaseEnv.join(", ")}`;

export const firebaseClientConfig: FirebaseClientConfig | null = hasFirebaseClientEnv
  ? {
      apiKey: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_API_KEY as string,
      authDomain: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
      projectId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
      storageBucket: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
      messagingSenderId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
      appId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_APP_ID as string,
      measurementId: rawFirebaseEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    }
  : null;
