// ═══════════════════════════════════════════════════
// activity.js — Global team activity log
// ═══════════════════════════════════════════════════

import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { currentUser } from "./auth.js";

// ─────────────────────────────────────────────────
// Write activity entry
// ─────────────────────────────────────────────────
export async function logActivity(type, text) {
  await addDoc(collection(db, "activity"), {
    type,
    text,
    authorId: currentUser?.uid || "system",
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────
// Subscribe to activity log (latest 100)
// ─────────────────────────────────────────────────
export function subscribeToActivity(callback) {
  const q = query(collection(db, "activity"), orderBy("createdAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    const items = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
    callback(items);
  });
}
