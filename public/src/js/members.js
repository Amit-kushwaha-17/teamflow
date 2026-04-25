// ═══════════════════════════════════════════════════
// members.js — Member management, join codes, admin approval
// ═══════════════════════════════════════════════════

import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { currentUser, currentUserData } from "./auth.js";
import { logActivity } from "./activity.js";
import { sendTaskNotification } from "./notifications.js";
import { showToast } from "./ui.js";

export let allMembers = {};

// ─────────────────────────────────────────────────
// Load all approved members into allMembers map
// ─────────────────────────────────────────────────
export async function loadMembers() {
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  allMembers = {};
  snap.forEach((d) => {
    allMembers[d.id] = d.data();
  });
  return allMembers;
}

// ─────────────────────────────────────────────────
// Subscribe to pending members (admin only)
// ─────────────────────────────────────────────────
export function subscribeToPendingMembers(callback) {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  return onSnapshot(q, (snap) => {
    const pending = [];
    snap.forEach((d) => pending.push({ id: d.id, ...d.data() }));
    callback(pending);
  });
}

// ─────────────────────────────────────────────────
// Subscribe to all members (real-time)
// ─────────────────────────────────────────────────
export function subscribeToMembers(callback) {
  return onSnapshot(collection(db, "users"), (snap) => {
    allMembers = {};
    snap.forEach((d) => {
      if (d.data().status === "approved") allMembers[d.id] = d.data();
    });
    callback(allMembers);
  });
}

// ─────────────────────────────────────────────────
// Admin: Approve a pending member
// ─────────────────────────────────────────────────
export async function approveMember(uid) {
  if (currentUserData.role !== "admin" && currentUserData.role !== "manager") {
    throw new Error("Permission denied.");
  }

  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();

  await updateDoc(doc(db, "users", uid), {
    status: "approved",
    approvedBy: currentUser.uid,
    approvedAt: serverTimestamp(),
  });

  await logActivity("member_approved", `${currentUserData.name} approved ${userData.name} to join the team`);

  // Notify the user
  await sendTaskNotification({
    type: "account_approved",
    taskId: null,
    taskTitle: null,
    recipientId: uid,
    senderName: currentUserData.name,
    message: `Your request to join the team has been approved! You can now access all tasks.`,
  });

  showToast(`${userData.name} approved!`, "success");
}

// ─────────────────────────────────────────────────
// Admin: Reject a pending member
// ─────────────────────────────────────────────────
export async function rejectMember(uid) {
  if (currentUserData.role !== "admin") throw new Error("Permission denied.");

  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();

  await updateDoc(doc(db, "users", uid), {
    status: "rejected",
    rejectedBy: currentUser.uid,
    rejectedAt: serverTimestamp(),
  });

  await logActivity("member_rejected", `${currentUserData.name} rejected ${userData.name}'s join request`);
  showToast(`${userData.name} rejected.`, "info");
}

// ─────────────────────────────────────────────────
// Admin: Change member role
// ─────────────────────────────────────────────────
export async function changeMemberRole(uid, newRole) {
  if (currentUserData.role !== "admin") throw new Error("Only admins can change roles.");
  if (uid === currentUser.uid) throw new Error("Cannot change your own role.");

  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();

  await updateDoc(doc(db, "users", uid), { role: newRole });
  await logActivity("role_changed", `${currentUserData.name} changed ${userData.name}'s role to ${newRole}`);
  showToast("Role updated.", "success");
}

// ─────────────────────────────────────────────────
// Generate a unique join code (admin only)
// ─────────────────────────────────────────────────
export async function generateJoinCode() {
  if (!["admin", "manager"].includes(currentUserData.role)) {
    throw new Error("Permission denied.");
  }

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  await addDoc(collection(db, "joinCodes"), {
    code,
    createdBy: currentUser.uid,
    createdByName: currentUserData.name,
    used: false,
    usedBy: null,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  await logActivity("join_code_created", `${currentUserData.name} generated a join code`);
  return code;
}

// ─────────────────────────────────────────────────
// Get all join codes (admin only)
// ─────────────────────────────────────────────────
export async function getJoinCodes() {
  const snap = await getDocs(query(collection(db, "joinCodes"), orderBy("createdAt", "desc")));
  const codes = [];
  snap.forEach((d) => codes.push({ id: d.id, ...d.data() }));
  return codes;
}
