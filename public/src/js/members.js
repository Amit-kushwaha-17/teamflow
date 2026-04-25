// members.js — Member management, join codes, approvals
import { getFirebaseDb } from "./firebase.js";
import {
  collection, doc, getDocs, getDoc, updateDoc, addDoc, deleteDoc,
  query, where, onSnapshot, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { currentUser, currentUserData } from "./auth.js";
import { logActivity } from "./activity.js";
import { sendTaskNotification } from "./notifications.js";
import { showToast } from "./ui.js";

export let allMembers = {};

export async function loadMembers() {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "users"), where("status", "==", "approved")));
  allMembers = {};
  snap.forEach((d) => { allMembers[d.id] = d.data(); });
  return allMembers;
}

export function subscribeToPendingMembers(callback) {
  const db = getFirebaseDb();
  return onSnapshot(query(collection(db, "users"), where("status", "==", "pending")), (snap) => {
    const pending = [];
    snap.forEach((d) => pending.push({ id: d.id, ...d.data() }));
    callback(pending);
  });
}

export function subscribeToMembers(callback) {
  const db = getFirebaseDb();
  return onSnapshot(collection(db, "users"), (snap) => {
    allMembers = {};
    snap.forEach((d) => { if (d.data().status === "approved") allMembers[d.id] = d.data(); });
    callback(allMembers);
  });
}

export async function approveMember(uid) {
  if (!["admin","manager"].includes(currentUserData?.role)) throw new Error("Permission denied.");
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();
  await updateDoc(doc(db, "users", uid), { status: "approved", approvedBy: currentUser.uid, approvedAt: serverTimestamp() });
  await logActivity("member_approved", `${currentUserData.name} approved ${userData.name}`, currentUser.uid);
  await sendTaskNotification({ type: "account_approved", taskId: null, taskTitle: null,
    recipientId: uid, senderName: currentUserData.name,
    message: `Your request to join has been approved! You can now access all tasks.` });
  showToast(`${userData.name} approved!`, "success");
}

export async function rejectMember(uid) {
  if (currentUserData?.role !== "admin") throw new Error("Permission denied.");
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();
  await updateDoc(doc(db, "users", uid), { status: "rejected", rejectedBy: currentUser.uid, rejectedAt: serverTimestamp() });
  await logActivity("member_rejected", `${currentUserData.name} rejected ${userData.name}`, currentUser.uid);
  showToast(`${userData.name} rejected.`, "info");
}

export async function changeMemberRole(uid, newRole) {
  if (currentUserData?.role !== "admin") throw new Error("Only admins can change roles.");
  if (uid === currentUser.uid) throw new Error("Cannot change your own role.");
  const db = getFirebaseDb();
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.data();
  await updateDoc(doc(db, "users", uid), { role: newRole });
  await logActivity("role_changed", `${currentUserData.name} changed ${userData.name}'s role to ${newRole}`, currentUser.uid);
  showToast("Role updated.", "success");
}

export async function generateJoinCode() {
  if (!["admin","manager"].includes(currentUserData?.role)) throw new Error("Permission denied.");
  const db = getFirebaseDb();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await addDoc(collection(db, "joinCodes"), {
    code, createdBy: currentUser.uid, createdByName: currentUserData.name,
    used: false, usedBy: null, createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await logActivity("join_code_created", `${currentUserData.name} generated join code: ${code}`, currentUser.uid);
  return code;
}

export async function getJoinCodes() {
  const db = getFirebaseDb();
  const snap = await getDocs(query(collection(db, "joinCodes"), orderBy("createdAt", "desc")));
  const codes = [];
  snap.forEach((d) => codes.push({ id: d.id, ...d.data() }));
  return codes;
}
