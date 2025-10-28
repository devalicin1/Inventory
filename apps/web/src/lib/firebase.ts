import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

// Firebase config (can be moved to env if needed)
const firebaseConfig = {
  apiKey: 'AIzaSyAwnlW9z3YNBg4nbKO4jbwHVLqRC9BEuBQ',
  authDomain: 'inventory-ce0c2.firebaseapp.com',
  projectId: 'inventory-ce0c2',
  storageBucket: 'inventory-ce0c2.firebasestorage.app',
  messagingSenderId: '289537497017',
  appId: '1:289537497017:web:825334baafd0f555a60868',
  measurementId: 'G-X2DBY1NHKN',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

// Firestore init (HMR-safe) using long polling to avoid WebChannel/CORS issues
const globalKey = '__inventory_firestore__'
let db: Firestore = (globalThis as any)[globalKey]
if (!db) {
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      ignoreUndefinedProperties: true,
    })
  } catch (error) {
    // If already initialized by another HMR pass, reuse it
    db = getFirestore(app)
  }
  ;(globalThis as any)[globalKey] = db
}

export { db }
export const functions = getFunctions(app)
export const storage = getStorage(app)

// Emulators for local dev (opt-in)
// Set VITE_USE_EMULATORS=true in .env.local to enable
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099')
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    console.info('[firebase] Using local emulators')
  } catch (_) {
    // noop if already connected
  }
}

