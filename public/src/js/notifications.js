// notifications.js — In-app notifications
import { getFirebaseDb, getFirebaseFunctions } from "./firebase.js";
import {
  collection, addDoc, updateDoc, getDocs, query, where, orderBy, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

export async function sendTaskNotification({ type, taskId, taskTitle, recipientId, senderName, message }) {
  const db = getFirebaseDb();
  await addDoc(collection(db, "notifications"), {
    type, taskId, taskTitle, recipientId, senderName, message,
    read: false, createdAt: serverTimestamp(),
  });
  // Email via Cloud Function (optional - skip if functions not deployed)
  try {
    const fn = getFirebaseFunctions();
    const sendEmail = httpsCallable(fn, "sendEmailNotification");
    await sendEmail({ type, taskId, taskTitle, recipientId, senderName, message });
  } catch (e) {
    console.warn("Email notification skipped:", e.message);
  }
}

export function subscribeToNotifications(uid, callback) {
  const db = getFirebaseDb();
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

export async function markNotifRead(notifId) {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "notifications")));
  const target = snap.docs.find((d) => d.id === notifId);
  if (target) await updateDoc(target.ref, { read: true });
}

export async function markAllNotifsRead(uid) {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, "notifications"), where("recipientId", "==", uid), where("read", "==", false))
  );
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
}
