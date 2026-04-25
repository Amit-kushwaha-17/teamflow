// ═══════════════════════════════════════════════════
// firebase.js — Firebase initialization
// Uses getter functions so modules always get live instances
// ═══════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

let _app = null;

export function initFirebase(config) {
  _app = getApps().length === 0 ? initializeApp(config) : getApp();
  return _app;
}

export function getFirebaseAuth()      { return getAuth(_app); }
export function getFirebaseDb()        { return getFirestore(_app); }
export function getFirebaseFunctions() { return getFunctions(_app); }
export function isFirebaseReady()      { return _app !== null; }

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
