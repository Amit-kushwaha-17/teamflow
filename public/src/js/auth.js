// ═══════════════════════════════════════════════════
// auth.js — Authentication: Email/Password, Google, Phone
// + Join Code request flow + Admin approval
// ═══════════════════════════════════════════════════

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, showScreen } from "./ui.js";
import { logActivity } from "./activity.js";

export let currentUser = null;
export let currentUserData = null;

// ─────────────────────────────────────────────────
// Auth State Listener
// ─────────────────────────────────────────────────
export function initAuth(onLoggedIn, onLoggedOut) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const userData = await fetchUserData(user.uid);
      if (userData) {
        currentUserData = userData;

        // Check approval status
        if (userData.status === "pending") {
          showScreen("pending-screen");
          return;
        }
        if (userData.status === "rejected") {
          showScreen("rejected-screen");
          return;
        }

        onLoggedIn(user, userData);
      } else {
        // New Google/Phone user — needs to join with code
        showScreen("join-screen");
      }
    } else {
      currentUser = null;
      currentUserData = null;
      onLoggedOut();
    }
  });
}

async function fetchUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// ─────────────────────────────────────────────────
// Email / Password Login
// ─────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw new Error(friendlyAuthError(e.code));
  }
}

// ─────────────────────────────────────────────────
// Email / Password Register
// First-ever user → auto admin (no join code needed)
// Subsequent users → need a valid join code
// ─────────────────────────────────────────────────
export async function registerWithEmail(name, email, password, joinCode) {
  // Step 1: Create the Firebase Auth account first
  // (Firestore rules require auth to query joinCodes)
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    throw new Error(friendlyAuthError(e.code));
  }

  try {
    // Step 2: Check if this is the very first user
    const usersSnap = await getDocs(collection(db, "users"));
    const isFirstUser = usersSnap.empty;

    if (isFirstUser) {
      // Auto-promote to admin, no join code needed
      await createUserDoc(cred.user, name, "admin", "approved");
      await logActivity("account_created", `Admin account created: ${name}`);
      return cred.user;
    }

    // Step 3: Not first user — validate join code
    if (!joinCode || joinCode.trim() === "") {
      await cred.user.delete(); // Roll back auth account
      throw new Error("A join code is required. Ask your admin to generate one.");
    }

    const codeValid = await validateJoinCode(joinCode);
    if (!codeValid) {
      await cred.user.delete(); // Roll back auth account
      throw new Error("Invalid or expired join code. Ask your admin for a new one.");
    }

    await createUserDoc(cred.user, name, "member", "pending");
    await invalidateJoinCode(joinCode, cred.user.uid);
    await logActivity("join_request", `${name} requested to join the team`);
    return cred.user;

  } catch (e) {
    // If it's already our error, rethrow it
    if (e.message && !e.code) throw e;
    throw new Error(friendlyAuthError(e.code));
  }
}

// ─────────────────────────────────────────────────
// Google Sign-In
// ─────────────────────────────────────────────────
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    // onAuthStateChanged will handle routing
    return cred.user;
  } catch (e) {
    throw new Error(friendlyAuthError(e.code));
  }
}

// ─────────────────────────────────────────────────
// Phone Auth — Step 1: Send OTP
// ─────────────────────────────────────────────────
export function setupRecaptcha(containerId) {
  if (window.recaptchaVerifier) {
    window.recaptchaVerifier.clear();
  }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
  });
  return window.recaptchaVerifier;
}

export async function sendPhoneOTP(phoneNumber) {
  const appVerifier = window.recaptchaVerifier;
  try {
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    window.confirmationResult = confirmation;
    return confirmation;
  } catch (e) {
    throw new Error(friendlyAuthError(e.code));
  }
}

// ─────────────────────────────────────────────────
// Phone Auth — Step 2: Verify OTP
// ─────────────────────────────────────────────────
export async function verifyPhoneOTP(otp) {
  try {
    const cred = await window.confirmationResult.confirm(otp);
    return cred.user;
  } catch (e) {
    throw new Error("Invalid OTP. Please try again.");
  }
}

// ─────────────────────────────────────────────────
// Join Code Submission (for Google/Phone users)
// ─────────────────────────────────────────────────
export async function submitJoinCode(name, joinCode) {
  if (!currentUser) throw new Error("Not authenticated.");
  const codeValid = await validateJoinCode(joinCode);
  if (!codeValid) throw new Error("Invalid or expired join code.");

  await createUserDoc(currentUser, name, "member", "pending");
  await invalidateJoinCode(joinCode, currentUser.uid);
  await logActivity("join_request", `${name} requested to join the team`);
}

// ─────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────
export async function logout() {
  currentUser = null;
  currentUserData = null;
  await signOut(auth);
}

// ─────────────────────────────────────────────────
// Join Code Validation
// ─────────────────────────────────────────────────
async function validateJoinCode(code) {
  if (!code) return false;
  const snap = await getDocs(
    query(collection(db, "joinCodes"), where("code", "==", code.toUpperCase()), where("used", "==", false))
  );
  return !snap.empty;
}

async function invalidateJoinCode(code, usedByUid) {
  const snap = await getDocs(
    query(collection(db, "joinCodes"), where("code", "==", code.toUpperCase()))
  );
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, {
      used: true,
      usedBy: usedByUid,
      usedAt: serverTimestamp(),
    });
  }
}

// ─────────────────────────────────────────────────
// Create User Document in Firestore
// ─────────────────────────────────────────────────
async function createUserDoc(user, name, role, status) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    name,
    email: user.email || null,
    phone: user.phoneNumber || null,
    photoURL: user.photoURL || null,
    role,
    status, // pending | approved | rejected
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────
// Admin: Create first admin (no join code needed)
// ─────────────────────────────────────────────────
export async function createFirstAdmin(name, email, password) {
  // Only allowed if no users exist
  const snap = await getDocs(collection(db, "users"));
  if (!snap.empty) throw new Error("Team already has members. Use a join code.");

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    name,
    email,
    phone: null,
    photoURL: null,
    role: "admin",
    status: "approved",
    createdAt: serverTimestamp(),
  });
  return cred.user;
}

// ─────────────────────────────────────────────────
// Friendly error messages
// ─────────────────────────────────────────────────
function friendlyAuthError(code) {
  const map = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password. Please try again.",
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/too-many-requests":    "Too many attempts. Please wait a few minutes.",
    "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed":  "This sign-in method is not enabled in Firebase.",
    "auth/requires-recent-login":  "Please sign out and sign in again.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  };
  // Return the mapped message, or the raw code so it's never a mystery
  return map[code] || (code ? `Error: ${code}` : "Authentication failed. Try again.");
}
