// ═══════════════════════════════════════════════════
// firebase.js — Firebase initialization
// Config is loaded from localStorage (set via setup screen)
// ═══════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

<<<<<<< HEAD
export let auth, db, functions;
=======
// ─────────────────────────────────────────────────
// 🔥 PASTE YOUR FIREBASE CONFIG HERE
// Get it from: Firebase Console → Project Settings → Your Apps
// ─────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAESaNb_0BYrBzLtM9mGN0s7sn1JRV6zNA",
  authDomain: "taskflow-1ded8.firebaseapp.com",
  projectId: "taskflow-1ded8",
  storageBucket: "taskflow-1ded8.firebasestorage.app",
  messagingSenderId: "306003039349",
  appId: "1:306003039349:web:37a66173e4fb2a57bf143c"
};
>>>>>>> 53909aaba8a8eb7434181acbb5bd004a2d2ba7e0

export function initFirebase(config) {
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  return app;
}

export function getSavedConfig() {
  try {
    const raw = localStorage.getItem("tf_firebase_config");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveConfig(config) {
  localStorage.setItem("tf_firebase_config", JSON.stringify(config));
}

export function clearConfig() {
  localStorage.removeItem("tf_firebase_config");
}
