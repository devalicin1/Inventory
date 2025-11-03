import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
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

// Firestore init (HMR-safe) 
const globalKey = '__inventory_firestore__'
let db: Firestore = (globalThis as any)[globalKey]
if (!db) {
  try {
    // Try to initialize with transport settings in dev to avoid WebChannel 400s
    const baseOptions = { ignoreUndefinedProperties: true } as any
    const options = import.meta.env.DEV
      ? {
          ...baseOptions,
          experimentalAutoDetectLongPolling: true,
          experimentalForceLongPolling: true,
          useFetchStreams: false,
        }
      : baseOptions
    db = initializeFirestore(app, options)
  } catch (error) {
    // If already initialized by another HMR pass, reuse it
    db = getFirestore(app)
  }
  ;(globalThis as any)[globalKey] = db
}

export { db }
export const functions = getFunctions(app)
export const storage = getStorage(app)

// Authentication is handled by the session store in App.tsx
// No need for anonymous sign-in since we're using mock authentication

// Emulators disabled - writing to production Firebase
// if (import.meta.env.DEV) {
//   try {
//     connectAuthEmulator(auth, 'http://127.0.0.1:9099')
//     connectFirestoreEmulator(db, '127.0.0.1', 8080)
//     connectFunctionsEmulator(functions, '127.0.0.1', 5001)
//     connectStorageEmulator(storage, '127.0.0.1', 9199)
//     console.info('[firebase] Using local emulators (auth:9099, firestore:8080, functions:5001, storage:9199)')
//     if (!auth.currentUser) {
//       void signInAnonymously(auth).catch(() => {})
//     }
//   } catch (_) {
//     // noop if already connected
//   }
// }

