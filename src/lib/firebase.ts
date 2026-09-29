import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Note: Initialize Firestore with experimentalAutoDetectLongPolling to prevent iframe connection timeouts and 'code=unavailable' errors
const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = dbId
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, dbId)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const auth = getAuth(app);

// Workspace Scopes for Gmail
export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
];

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach(scope => googleProvider.addScope(scope));

// In-memory access token cache (CRITICAL: Do not store in localStorage)
let cachedAccessToken: string | null = null;
let activeSignInPromise: Promise<{ user: User; accessToken: string | null } | null> | null = null;

export const getCachedAccessToken = () => cachedAccessToken;

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null } | null> {
  // If a popup request is already in progress, return the active promise to prevent cancelling it
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  activeSignInPromise = (async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      cachedAccessToken = credential?.accessToken || null;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (error: any) {
      const errorCode = error?.code || '';
      const errorMsg = error?.message || '';

      // Gracefully handle cancellation, closed popup, or superseded popup requests without uncaught errors
      if (
        errorCode === 'auth/cancelled-popup-request' ||
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/popup-blocked' ||
        errorMsg.includes('auth/cancelled-popup-request') ||
        errorMsg.includes('auth/popup-closed-by-user') ||
        errorMsg.includes('auth/popup-blocked')
      ) {
        console.warn('Google Sign-In popup was cancelled, closed by user, or superseded.');
        return null;
      }

      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
  cachedAccessToken = null;
}

export function subscribeToAuth(
  onSuccess: (user: User, token: string | null) => void,
  onLoggedOut: () => void
) {
  return onAuthStateChanged(auth, user => {
    if (user) {
      onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      onLoggedOut();
    }
  });
}

// Test connection on boot as mandated by Firebase skill
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (
      (error instanceof Error && error.message.includes('the client is offline')) ||
      error?.code === 'unavailable' ||
      error?.code === 'failed-precondition' ||
      error?.message?.includes('unavailable')
    ) {
      console.warn('Firebase client is offline or backend temporarily unreachable. Local cache active.');
    }
  }
}

// Hardened error handler conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
