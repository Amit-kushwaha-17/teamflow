// activity.js — Global team activity log
import { getFirebaseDb } from "./firebase.js";
import {
  collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function logActivity(type, text, authorId) {
  const db = getFirebaseDb();
  await addDoc(collection(db, "activity"), {
    type, text,
    authorId: authorId || "system",
    createdAt: serverTimestamp(),
  });
}

export function subscribeToActivity(callback) {
  const db = getFirebaseDb();
  const q = query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    callback(items);
  });
}
