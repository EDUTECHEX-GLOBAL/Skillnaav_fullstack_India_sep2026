import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration for Google Auth (Firebase Auth only)
const firebaseAuthConfig = {
  apiKey: "AIzaSyDAQggqn21lqfI3O754By_WMvizSWLNvIo",
  authDomain: "skillnaav-authentication.firebaseapp.com",
  projectId: "skillnaav-authentication",
  storageBucket: "skillnaav-authentication.firebasestorage.app",
  messagingSenderId: "533152822891",
  appId: "1:533152822891:web:60b4c15d5f6dad05b9a32e",
  measurementId: "G-KQTBM0VC93",
};

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseAuthConfig);

// Firebase Auth & Firestore
const auth = getAuth(firebaseApp);
const googleAuthProvider = new GoogleAuthProvider();
const db = getFirestore(firebaseApp);

// Export only what you need
export { auth, googleAuthProvider, signInWithPopup, db };
