// ═══════════════════════════════════════════════════
// firebase.js — Firebase initialization
// Config is loaded from localStorage (set via setup screen)
// ═══════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

export let auth, db, functions;

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
