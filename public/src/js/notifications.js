// ═══════════════════════════════════════════════════
// notifications.js — In-app + email notifications
// Uses Firestore for in-app, Firebase Functions for email
// ═══════════════════════════════════════════════════

import { db, functions } from "./firebase.js";
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { currentUser } from "./auth.js";

// ─────────────────────────────────────────────────
// Send in-app + email notification
// ─────────────────────────────────────────────────
export async function sendTaskNotification({ type, taskId, taskTitle, recipientId, senderName, message }) {
  // 1. In-app notification (Firestore)
  await addDoc(collection(db, "notifications"), {
    type,
    taskId,
    taskTitle,
    recipientId,
    senderName,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });

  // 2. Email notification via Firebase Cloud Function
  try {
    const sendEmail = httpsCallable(functions, "sendEmailNotification");
    await sendEmail({ type, taskId, taskTitle, recipientId, senderName, message });
  } catch (e) {
    // Email is best-effort; don't block the app if it fails
    console.warn("Email notification failed:", e.message);
  }
}

// ─────────────────────────────────────────────────
// Subscribe to current user's notifications
// ─────────────────────────────────────────────────
export function subscribeToNotifications(uid, callback) {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const notifs = [];
    snap.forEach((d) => notifs.push({ id: d.id, ...d.data() }));
    callback(notifs);
  });
}

// ─────────────────────────────────────────────────
// Mark notification as read
// ─────────────────────────────────────────────────
export async function markNotifRead(notifId) {
  const snap = await getDocs(
    query(collection(db, "notifications"), where("recipientId", "==", currentUser?.uid))
  );
  const target = snap.docs.find((d) => d.id === notifId);
  if (target) await updateDoc(target.ref, { read: true });
}

// ─────────────────────────────────────────────────
// Mark all notifications read
// ─────────────────────────────────────────────────
export async function markAllNotifsRead(uid) {
  const snap = await getDocs(
    query(collection(db, "notifications"), where("recipientId", "==", uid), where("read", "==", false))
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}
