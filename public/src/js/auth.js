// auth.js — Authentication: Email/Password, Google, Phone
import { getFirebaseAuth, getFirebaseDb } from "./firebase.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber,
  onAuthStateChanged, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showScreen } from "./ui.js";
import { logActivity } from "./activity.js";

export let currentUser = null;
export let currentUserData = null;

export function initAuth(onLoggedIn, onLoggedOut) {
  const auth = getFirebaseAuth();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      const userData = await fetchUserData(user.uid);
      if (userData) {
        currentUserData = userData;
        if (userData.status === "pending")  { showScreen("pending-screen"); return; }
        if (userData.status === "rejected") { showScreen("rejected-screen"); return; }
        onLoggedIn(user, userData);
      } else {
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
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function loginWithEmail(email, password) {
  try {
    const auth = getFirebaseAuth();
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) { throw new Error(friendlyAuthError(e.code)); }
}

export async function registerWithEmail(name, email, password, joinCode) {
  const auth = getFirebaseAuth();
  const db   = getFirebaseDb();
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
  } catch (e) { throw new Error(friendlyAuthError(e.code)); }

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const isFirstUser = usersSnap.empty;

    if (isFirstUser) {
      await createUserDoc(cred.user, name, "admin", "approved");
      await logActivity("account_created", `Admin account created: ${name}`, cred.user.uid);
      return cred.user;
    }

    if (!joinCode || joinCode.trim() === "") {
      await cred.user.delete();
      throw new Error("A join code is required. Ask your admin to generate one.");
    }
    const codeValid = await validateJoinCode(joinCode);
    if (!codeValid) {
      await cred.user.delete();
      throw new Error("Invalid or expired join code. Ask your admin for a new one.");
    }
    await createUserDoc(cred.user, name, "member", "pending");
    await invalidateJoinCode(joinCode, cred.user.uid);
    await logActivity("join_request", `${name} requested to join the team`, cred.user.uid);
    return cred.user;
  } catch (e) {
    if (e.message && !e.code) throw e;
    throw new Error(friendlyAuthError(e.code));
  }
}

export async function loginWithGoogle() {
  try {
    const auth = getFirebaseAuth();
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    return cred.user;
  } catch (e) { throw new Error(friendlyAuthError(e.code)); }
}

export function setupRecaptcha(containerId) {
  const auth = getFirebaseAuth();
  if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch(_){} }
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible", callback: () => {},
  });
  return window.recaptchaVerifier;
}

export async function sendPhoneOTP(phoneNumber) {
  try {
    const confirmation = await signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, window.recaptchaVerifier);
    window.confirmationResult = confirmation;
    return confirmation;
  } catch (e) { throw new Error(friendlyAuthError(e.code)); }
}

export async function verifyPhoneOTP(otp) {
  try {
    const cred = await window.confirmationResult.confirm(otp);
    return cred.user;
  } catch (e) { throw new Error("Invalid OTP. Please try again."); }
}

export async function submitJoinCode(name, joinCode) {
  if (!currentUser) throw new Error("Not authenticated.");
  const codeValid = await validateJoinCode(joinCode);
  if (!codeValid) throw new Error("Invalid or expired join code.");
  await createUserDoc(currentUser, name, "member", "pending");
  await invalidateJoinCode(joinCode, currentUser.uid);
  await logActivity("join_request", `${name} requested to join the team`, currentUser.uid);
}

export async function logout() {
  currentUser = null; currentUserData = null;
  await signOut(getFirebaseAuth());
}

async function validateJoinCode(code) {
  if (!code) return false;
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, "joinCodes"), where("code", "==", code.toUpperCase()), where("used", "==", false))
  );
  return !snap.empty;
}

async function invalidateJoinCode(code, usedByUid) {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "joinCodes"), where("code", "==", code.toUpperCase())));
  if (!snap.empty) await updateDoc(snap.docs[0].ref, { used: true, usedBy: usedByUid, usedAt: serverTimestamp() });
}

async function createUserDoc(user, name, role, status) {
  const db = getFirebaseDb();
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid, name,
    email: user.email || null,
    phone: user.phoneNumber || null,
    photoURL: user.photoURL || null,
    role, status, createdAt: serverTimestamp(),
  });
}

function friendlyAuthError(code) {
  const map = {
    "auth/user-not-found":        "No account found with that email.",
    "auth/wrong-password":        "Incorrect password.",
    "auth/invalid-credential":    "Incorrect email or password.",
    "auth/email-already-in-use":  "An account with this email already exists.",
    "auth/weak-password":         "Password must be at least 6 characters.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/too-many-requests":     "Too many attempts. Please wait a few minutes.",
    "auth/popup-closed-by-user":  "Sign-in popup was closed.",
    "auth/network-request-failed":"Network error. Check your connection.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase Console.",
  };
  return map[code] || (code ? `Firebase error: ${code}` : "Something went wrong. Try again.");
}
