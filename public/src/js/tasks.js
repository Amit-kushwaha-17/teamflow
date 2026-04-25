// ═══════════════════════════════════════════════════
// tasks.js — Task management: create, accept, complete,
//             delete, real-time listener, history
// ═══════════════════════════════════════════════════

import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { currentUser, currentUserData } from "./auth.js";
import { logActivity } from "./activity.js";
import { sendTaskNotification } from "./notifications.js";
import { showToast } from "./ui.js";

export let allTasks = [];
let taskUnsubscribe = null;

// ─────────────────────────────────────────────────
// Real-time task listener
// ─────────────────────────────────────────────────
export function subscribeToTasks(callback) {
  if (taskUnsubscribe) taskUnsubscribe();
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  taskUnsubscribe = onSnapshot(q, (snap) => {
    allTasks = [];
    snap.forEach((d) => allTasks.push({ id: d.id, ...d.data() }));
    callback(allTasks);
  });
  return () => taskUnsubscribe && taskUnsubscribe();
}

// ─────────────────────────────────────────────────
// Create Task (admin / manager only)
// ─────────────────────────────────────────────────
export async function createTask({ title, description, priority, dueDate, assigneeId, assigneeName }) {
  if (!["admin", "manager"].includes(currentUserData.role)) {
    throw new Error("Only admins and managers can create tasks.");
  }

  const taskRef = await addDoc(collection(db, "tasks"), {
    title,
    description: description || "",
    priority: priority || "medium",
    status: "pending",
    dueDate: dueDate || null,
    assigneeId: assigneeId || null,
    assigneeName: assigneeName || null,
    acceptedBy: null,
    acceptedByName: null,
    acceptedAt: null,
    completedAt: null,
    commentCount: 0,
    createdBy: currentUser.uid,
    createdByName: currentUserData.name,
    createdAt: serverTimestamp(),
  });

  // History
  await addHistory(taskRef.id, "created", `Task created by ${currentUserData.name}`);

  // Activity log
  await logActivity("task_created", `${currentUserData.name} created task: "${title}"`);

  // Email notification to assignee
  if (assigneeId) {
    await sendTaskNotification({
      type: "task_assigned",
      taskId: taskRef.id,
      taskTitle: title,
      recipientId: assigneeId,
      senderName: currentUserData.name,
      message: `You have been assigned a new task: "${title}"`,
    });
  }

  showToast("Task created!", "success");
  return taskRef.id;
}

// ─────────────────────────────────────────────────
// Accept Task
// ─────────────────────────────────────────────────
export async function acceptTask(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "pending") throw new Error("Task is no longer available.");
  if (task.assigneeId && task.assigneeId !== currentUser.uid) {
    throw new Error("This task is assigned to someone else.");
  }

  await updateDoc(doc(db, "tasks", taskId), {
    status: "accepted",
    acceptedBy: currentUser.uid,
    acceptedByName: currentUserData.name,
    acceptedAt: serverTimestamp(),
  });

  await addHistory(taskId, "accepted", `Task accepted by ${currentUserData.name}`);
  await logActivity("task_accepted", `${currentUserData.name} accepted: "${task.title}"`);

  // Notify task creator
  if (task.createdBy !== currentUser.uid) {
    await sendTaskNotification({
      type: "task_accepted",
      taskId,
      taskTitle: task.title,
      recipientId: task.createdBy,
      senderName: currentUserData.name,
      message: `${currentUserData.name} accepted your task: "${task.title}"`,
    });
  }

  showToast("Task accepted!", "success");
}

// ─────────────────────────────────────────────────
// Complete Task — ONLY the accepter can do this
// ─────────────────────────────────────────────────
export async function completeTask(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Task not found.");

  const isAccepter = task.acceptedBy === currentUser.uid;
  const isAssignedAccepter = task.assigneeId === currentUser.uid && task.status === "accepted";

  if (!isAccepter && !isAssignedAccepter) {
    throw new Error("Only the person who accepted this task can mark it complete.");
  }

  await updateDoc(doc(db, "tasks", taskId), {
    status: "completed",
    completedAt: serverTimestamp(),
  });

  await addHistory(taskId, "completed", `Task completed by ${currentUserData.name}`);
  await logActivity("task_completed", `${currentUserData.name} completed: "${task.title}"`);

  // Notify creator
  if (task.createdBy !== currentUser.uid) {
    await sendTaskNotification({
      type: "task_completed",
      taskId,
      taskTitle: task.title,
      recipientId: task.createdBy,
      senderName: currentUserData.name,
      message: `${currentUserData.name} completed task: "${task.title}"`,
    });
  }

  showToast("Task marked complete!", "success");
}

// ─────────────────────────────────────────────────
// Delete Task (admin / manager only)
// ─────────────────────────────────────────────────
export async function deleteTask(taskId) {
  if (!["admin", "manager"].includes(currentUserData.role)) {
    throw new Error("Permission denied.");
  }

  const task = allTasks.find((t) => t.id === taskId);
  await deleteDoc(doc(db, "tasks", taskId));
  await logActivity("task_deleted", `${currentUserData.name} deleted: "${task?.title || taskId}"`);
  showToast("Task deleted.", "info");
}

// ─────────────────────────────────────────────────
// Add comment to task
// ─────────────────────────────────────────────────
export async function addComment(taskId, text) {
  if (!text.trim()) throw new Error("Comment cannot be empty.");

  const task = allTasks.find((t) => t.id === taskId);
  await addDoc(collection(db, "tasks", taskId, "comments"), {
    text: text.trim(),
    authorId: currentUser.uid,
    authorName: currentUserData.name,
    createdAt: serverTimestamp(),
  });

  // Increment count
  const ref = doc(db, "tasks", taskId);
  const snap = await getDoc(ref);
  await updateDoc(ref, { commentCount: (snap.data()?.commentCount || 0) + 1 });

  await logActivity("comment_added", `${currentUserData.name} commented on "${task?.title}"`);

  // Notify assignee/accepter
  const notifyId =
    task?.acceptedBy && task.acceptedBy !== currentUser.uid
      ? task.acceptedBy
      : task?.createdBy !== currentUser.uid
      ? task?.createdBy
      : null;

  if (notifyId) {
    await sendTaskNotification({
      type: "new_comment",
      taskId,
      taskTitle: task?.title,
      recipientId: notifyId,
      senderName: currentUserData.name,
      message: `${currentUserData.name} commented on "${task?.title}"`,
    });
  }
}

// ─────────────────────────────────────────────────
// Fetch comments + history for a task
// ─────────────────────────────────────────────────
export async function getTaskDetail(taskId) {
  const [commSnap, histSnap] = await Promise.all([
    getDocs(query(collection(db, "tasks", taskId, "comments"), orderBy("createdAt", "asc"))),
    getDocs(query(collection(db, "tasks", taskId, "history"), orderBy("createdAt", "asc"))),
  ]);

  const comments = [];
  commSnap.forEach((d) => comments.push({ id: d.id, ...d.data() }));

  const history = [];
  histSnap.forEach((d) => history.push({ id: d.id, ...d.data() }));

  return { comments, history };
}

// ─────────────────────────────────────────────────
// Internal: Add task history entry
// ─────────────────────────────────────────────────
export async function addHistory(taskId, type, text) {
  await addDoc(collection(db, "tasks", taskId, "history"), {
    type,
    text,
    authorId: currentUser.uid,
    createdAt: serverTimestamp(),
  });
}
