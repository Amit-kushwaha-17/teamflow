// ═══════════════════════════════════════════════════
// firebase.js — Central Firebase initialization
// Replace ONLY the firebaseConfig object with yours
// ═══════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export default app;
