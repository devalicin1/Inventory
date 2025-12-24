import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from './firebase'

export interface AuthError {
  code: string
  message: string
}

// Sign in with email and password
export async function signIn(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  } catch (error: any) {
    console.error('SignIn error:', error)
    // Firebase Auth hata kodunu al
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Create new user with email and password
export async function signUp(
  email: string, 
  password: string, 
  displayName?: string
): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user
    
    // Display name varsa güncelle
    if (displayName) {
      await updateProfile(user, { displayName })
    }
    
    // Email verification gönder
    if (!user.emailVerified) {
      await sendEmailVerification(user)
    }
    
    return user
  } catch (error: any) {
    console.error('SignUp error:', error)
    // Firebase Auth hata kodunu al
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Send password reset email
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email)
  } catch (error: any) {
    console.error('SendPasswordReset error:', error)
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Verify password reset code
export async function verifyResetCode(code: string): Promise<string> {
  try {
    const email = await verifyPasswordResetCode(auth, code)
    return email
  } catch (error: any) {
    console.error('VerifyResetCode error:', error)
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Confirm password reset
export async function confirmPasswordReset(code: string, newPassword: string): Promise<void> {
  try {
    await confirmPasswordReset(auth, code, newPassword)
  } catch (error: any) {
    console.error('ConfirmPasswordReset error:', error)
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Send email verification
export async function resendEmailVerification(): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error('No user is currently signed in')
    }
    await sendEmailVerification(user)
  } catch (error: any) {
    console.error('ResendEmailVerification error:', error)
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Verify email with action code
export async function verifyEmail(code: string): Promise<void> {
  try {
    await applyActionCode(auth, code)
  } catch (error: any) {
    console.error('VerifyEmail error:', error)
    const errorCode = error?.code || error?.message || 'auth/unknown'
    const authError: AuthError = {
      code: errorCode,
      message: getAuthErrorMessage(errorCode)
    }
    throw authError
  }
}

// Sign out
export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(auth)
  } catch (error: any) {
    const authError: AuthError = {
      code: error.code || 'auth/unknown',
      message: getAuthErrorMessage(error.code)
    }
    throw authError
  }
}

// Listen for auth state changes
export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback)
}

function getAuthErrorMessage(code: string): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': 'This email address is already in use.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/operation-not-allowed': 'Email/Password authentication is not enabled. Please enable Email/Password in Firebase Console > Authentication > Sign-in method.',
    'auth/weak-password': 'Password is too weak. It must be at least 6 characters.',
    'auth/user-disabled': 'This user account has been disabled.',
    'auth/user-not-found': 'No user found with this email address.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/invalid-api-key': 'Invalid API key. Please check your Firebase configuration.',
    'auth/unauthorized-domain': 'This domain is not authorized. Please add your domain to Authorized domains in Firebase Console.',
    'auth/configuration-not-found': 'Firebase Authentication is not configured. Please: 1) Enable Authentication service in Firebase Console, 2) Enable Email/Password in Sign-in method.',
    'auth/expired-action-code': 'The password reset code has expired. Please request a new one.',
    'auth/invalid-action-code': 'The password reset code is invalid. Please request a new one.',
    'auth/user-token-expired': 'Your session has expired. Please sign in again.',
  }
  
  if (!errorMessages[code]) {
    console.warn('Unknown auth error code:', code)
    return `An error occurred: ${code}. Please try again or check your Firebase Console settings.`
  }
  
  return errorMessages[code]
}
