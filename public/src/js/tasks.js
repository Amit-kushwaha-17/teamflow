// tasks.js — Task management
import { getFirebaseDb } from "./firebase.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { currentUser, currentUserData } from "./auth.js";
import { logActivity } from "./activity.js";
import { sendTaskNotification } from "./notifications.js";
import { showToast } from "./ui.js";

export let allTasks = [];
let taskUnsub = null;

export function subscribeToTasks(callback) {
  if (taskUnsub) taskUnsub();
  const db = getFirebaseDb();
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  taskUnsub = onSnapshot(q, (snap) => {
    allTasks = [];
    snap.forEach((d) => allTasks.push({ id: d.id, ...d.data() }));
    callback(allTasks);
  });
  return () => taskUnsub && taskUnsub();
}

export async function createTask({ title, description, priority, dueDate, assigneeId, assigneeName }) {
  if (!["admin", "manager"].includes(currentUserData?.role)) throw new Error("Only admins and managers can create tasks.");
  const db = getFirebaseDb();
  const ref = await addDoc(collection(db, "tasks"), {
    title, description: description || "", priority: priority || "medium",
    status: "pending", dueDate: dueDate || null,
    assigneeId: assigneeId || null, assigneeName: assigneeName || null,
    acceptedBy: null, acceptedByName: null, acceptedAt: null, completedAt: null,
    commentCount: 0,
    createdBy: currentUser.uid, createdByName: currentUserData.name,
    createdAt: serverTimestamp(),
  });
  await addHistory(ref.id, "created", `Task created by ${currentUserData.name}`);
  await logActivity("task_created", `${currentUserData.name} created: "${title}"`, currentUser.uid);
  if (assigneeId) {
    await sendTaskNotification({ type: "task_assigned", taskId: ref.id, taskTitle: title,
      recipientId: assigneeId, senderName: currentUserData.name,
      message: `You've been assigned: "${title}"` });
  }
  showToast("Task created!", "success");
  return ref.id;
}

export async function acceptTask(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "pending") throw new Error("Task is no longer available.");
  if (task.assigneeId && task.assigneeId !== currentUser.uid) throw new Error("This task is assigned to someone else.");
  const db = getFirebaseDb();
  await updateDoc(doc(db, "tasks", taskId), {
    status: "accepted", acceptedBy: currentUser.uid, acceptedByName: currentUserData.name, acceptedAt: serverTimestamp(),
  });
  await addHistory(taskId, "accepted", `Accepted by ${currentUserData.name}`);
  await logActivity("task_accepted", `${currentUserData.name} accepted: "${task.title}"`, currentUser.uid);
  if (task.createdBy !== currentUser.uid) {
    await sendTaskNotification({ type: "task_accepted", taskId, taskTitle: task.title,
      recipientId: task.createdBy, senderName: currentUserData.name,
      message: `${currentUserData.name} accepted: "${task.title}"` });
  }
  showToast("Task accepted!", "success");
}

export async function completeTask(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found.");
  const isAccepter = task.acceptedBy === currentUser.uid;
  const isAssigned = task.assigneeId === currentUser.uid && task.status === "accepted";
  if (!isAccepter && !isAssigned) throw new Error("Only the person who accepted this task can mark it complete.");
  const db = getFirebaseDb();
  await updateDoc(doc(db, "tasks", taskId), { status: "completed", completedAt: serverTimestamp() });
  await addHistory(taskId, "completed", `Completed by ${currentUserData.name}`);
  await logActivity("task_completed", `${currentUserData.name} completed: "${task.title}"`, currentUser.uid);
  if (task.createdBy !== currentUser.uid) {
    await sendTaskNotification({ type: "task_completed", taskId, taskTitle: task.title,
      recipientId: task.createdBy, senderName: currentUserData.name,
      message: `${currentUserData.name} completed: "${task.title}"` });
  }
  showToast("Task complete! ✓", "success");
}

export async function deleteTask(taskId) {
  if (!["admin", "manager"].includes(currentUserData?.role)) throw new Error("Permission denied.");
  const task = allTasks.find((t) => t.id === taskId);
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "tasks", taskId));
  await logActivity("task_deleted", `${currentUserData.name} deleted: "${task?.title}"`, currentUser.uid);
  showToast("Task deleted.", "info");
}

export async function addComment(taskId, text) {
  if (!text.trim()) throw new Error("Comment cannot be empty.");
  const db = getFirebaseDb();
  const task = allTasks.find((t) => t.id === taskId);
  await addDoc(collection(db, "tasks", taskId, "comments"), {
    text: text.trim(), authorId: currentUser.uid, authorName: currentUserData.name, createdAt: serverTimestamp(),
  });
  const ref = doc(db, "tasks", taskId);
  const snap = await getDoc(ref);
  await updateDoc(ref, { commentCount: (snap.data()?.commentCount || 0) + 1 });
  await logActivity("comment_added", `${currentUserData.name} commented on "${task?.title}"`, currentUser.uid);
  const notifyId = task?.acceptedBy && task.acceptedBy !== currentUser.uid ? task.acceptedBy
    : task?.createdBy !== currentUser.uid ? task?.createdBy : null;
  if (notifyId) await sendTaskNotification({ type: "new_comment", taskId, taskTitle: task?.title,
    recipientId: notifyId, senderName: currentUserData.name, message: `${currentUserData.name} commented on "${task?.title}"` });
}

export async function getTaskDetail(taskId) {
  const db = getFirebaseDb();
  const [commSnap, histSnap] = await Promise.all([
    getDocs(query(collection(db, "tasks", taskId, "comments"), orderBy("createdAt", "asc"))),
    getDocs(query(collection(db, "tasks", taskId, "history"), orderBy("createdAt", "asc"))),
  ]);
  const comments = []; commSnap.forEach((d) => comments.push({ id: d.id, ...d.data() }));
  const history = [];  histSnap.forEach((d) => history.push({ id: d.id, ...d.data() }));
  return { comments, history };
}

export async function addHistory(taskId, type, text) {
  const db = getFirebaseDb();
  await addDoc(collection(db, "tasks", taskId, "history"), {
    type, text, authorId: currentUser.uid, createdAt: serverTimestamp(),
  });
}
