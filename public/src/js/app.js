// ═══════════════════════════════════════════════════
// app.js — Main application entry point
// Orchestrates all modules and renders the UI
// ═══════════════════════════════════════════════════

import { initAuth, loginWithEmail, registerWithEmail, loginWithGoogle, sendPhoneOTP, verifyPhoneOTP, setupRecaptcha, submitJoinCode, createFirstAdmin, logout, currentUser, currentUserData } from "./auth.js";
import { subscribeToTasks, createTask, acceptTask, completeTask, deleteTask, addComment, getTaskDetail } from "./tasks.js";
import { subscribeToActivity } from "./activity.js";
import { subscribeToNotifications, markAllNotifsRead, markNotifRead } from "./notifications.js";
import { loadMembers, subscribeToMembers, subscribeToPendingMembers, approveMember, rejectMember, changeMemberRole, generateJoinCode, getJoinCodes, allMembers } from "./members.js";
import { showScreen, showToast, getAvatarStyle, initials, avatarHTML, formatTimestamp, timeAgo, statusTag, priorityDot, roleBadge, showError, clearError, setLoading } from "./ui.js";
import { initFirebase, getSavedConfig, saveConfig, clearConfig } from "./firebase.js";

// ─────────────────────────────────────────────────
// Boot — show config screen or start app
// ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const saved = getSavedConfig();

  if (!saved || !saved.apiKey || saved.apiKey === "YOUR_API_KEY") {
    showConfigScreen();
    return;
  }

  try {
    initFirebase(saved);
  } catch (e) {
    clearConfig();
    showConfigScreen("Invalid saved config. Please re-enter.");
    return;
  }

  bootApp();
});

function bootApp() {
  // setupRecaptcha must run AFTER initFirebase() so getFirebaseAuth() works
  try { setupRecaptcha("recaptcha-container"); } catch(e) { console.warn("Recaptcha init:", e.message); }
  bindConfigEvents();
  bindAuthEvents();

  initAuth(
    async (user, userData) => {
      await loadMembers();
      await startApp(user, userData);
    },
    () => {
      showScreen("auth-screen");
    }
  );
}

// ─────────────────────────────────────────────────
// Config screen logic
// ─────────────────────────────────────────────────
function showConfigScreen(errorMsg) {
  showScreen("config-screen");
  if (errorMsg) {
    const el = document.getElementById("cfg-error");
    if (el) el.textContent = errorMsg;
  }
}

function bindConfigEvents() {
  document.getElementById("btn-save-config")?.addEventListener("click", () => {
    const config = {
      apiKey:            document.getElementById("cfg-apiKey").value.trim(),
      authDomain:        document.getElementById("cfg-authDomain").value.trim(),
      projectId:         document.getElementById("cfg-projectId").value.trim(),
      storageBucket:     document.getElementById("cfg-storageBucket").value.trim(),
      messagingSenderId: document.getElementById("cfg-messagingSenderId").value.trim(),
      appId:             document.getElementById("cfg-appId").value.trim(),
    };

    const errEl = document.getElementById("cfg-error");
    for (const [k, v] of Object.entries(config)) {
      if (!v) { errEl.textContent = `Please fill in: ${k}`; return; }
    }

    try {
      initFirebase(config);
      saveConfig(config);
      showScreen("auth-screen");
      bootApp();
    } catch (e) {
      errEl.textContent = "Firebase error: " + e.message;
    }
  });

  document.getElementById("btn-reset-config")?.addEventListener("click", () => {
    clearConfig();
    location.reload();
  });
}

// ─────────────────────────────────────────────────
// Auth event bindings
// ─────────────────────────────────────────────────
function bindAuthEvents() {
  // Tab switching
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".auth-form").forEach((f) => (f.style.display = "none"));
      document.getElementById(`form-${tab.dataset.form}`).style.display = "block";
    });
  });

  // Email login
  document.getElementById("btn-email-login")?.addEventListener("click", async () => {
    clearError("login-error");
    setLoading("btn-email-login", true, "Sign In");
    try {
      await loginWithEmail(
        document.getElementById("login-email").value,
        document.getElementById("login-pass").value
      );
    } catch (e) {
      showError("login-error", e.message);
    }
    setLoading("btn-email-login", false, "Sign In");
  });

  // Email register
  document.getElementById("btn-email-register")?.addEventListener("click", async () => {
    clearError("reg-error");
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-pass").value;
    const code = document.getElementById("reg-join-code").value.trim();
    if (!name) { showError("reg-error", "Please enter your full name."); return; }
    if (!email) { showError("reg-error", "Please enter your email."); return; }
    if (!pass)  { showError("reg-error", "Please enter a password."); return; }
    setLoading("btn-email-register", true, "Creating account…");
    try {
      await registerWithEmail(name, email, pass, code);
      // onAuthStateChanged fires and routes to app (if admin) or pending screen
    } catch (e) {
      showError("reg-error", e.message);
    }
    setLoading("btn-email-register", false, "Create Account");
  });

  // Google login
  document.getElementById("btn-google")?.addEventListener("click", async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      showError("login-error", e.message);
    }
  });

  document.getElementById("btn-google-reg")?.addEventListener("click", async () => {
    try {
      await loginWithGoogle();
    } catch (e) {
      showError("reg-error", e.message);
    }
  });

  // Phone OTP send
  document.getElementById("btn-send-otp")?.addEventListener("click", async () => {
    clearError("phone-error");
    const phone = document.getElementById("phone-number").value;
    setLoading("btn-send-otp", true, "Send OTP");
    try {
      await sendPhoneOTP(phone);
      document.getElementById("otp-step-1").style.display = "none";
      document.getElementById("otp-step-2").style.display = "block";
    } catch (e) {
      showError("phone-error", e.message);
    }
    setLoading("btn-send-otp", false, "Send OTP");
  });

  // Phone OTP verify
  document.getElementById("btn-verify-otp")?.addEventListener("click", async () => {
    clearError("phone-error");
    setLoading("btn-verify-otp", true, "Verify");
    try {
      await verifyPhoneOTP(document.getElementById("otp-code").value);
    } catch (e) {
      showError("phone-error", e.message);
    }
    setLoading("btn-verify-otp", false, "Verify");
  });

  // Join code (for Google/Phone new users)
  document.getElementById("btn-submit-join")?.addEventListener("click", async () => {
    clearError("join-error");
    setLoading("btn-submit-join", true, "Submit");
    try {
      await submitJoinCode(
        document.getElementById("join-name").value,
        document.getElementById("join-code-input").value
      );
      showScreen("pending-screen");
    } catch (e) {
      showError("join-error", e.message);
    }
    setLoading("btn-submit-join", false, "Submit");
  });

  // First admin setup
  document.getElementById("btn-create-admin")?.addEventListener("click", async () => {
    clearError("setup-error");
    setLoading("btn-create-admin", true, "Create Admin");
    try {
      await createFirstAdmin(
        document.getElementById("setup-name").value,
        document.getElementById("setup-email").value,
        document.getElementById("setup-pass").value
      );
    } catch (e) {
      showError("setup-error", e.message);
    }
    setLoading("btn-create-admin", false, "Create Admin");
  });

  // Logout
  document.getElementById("btn-logout")?.addEventListener("click", async () => {
    await logout();
    showScreen("auth-screen");
  });
}

// ─────────────────────────────────────────────────
// Start App
// ─────────────────────────────────────────────────
async function startApp(user, userData) {
  showScreen("app-screen");

  // Topbar
  const [bg, fg] = getAvatarStyle(user.uid);
  document.getElementById("topbar-avatar").style.cssText = `background:${bg};color:${fg};width:28px;height:28px;font-size:11px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600`;
  document.getElementById("topbar-avatar").textContent = initials(userData.name);
  document.getElementById("topbar-name").textContent = userData.name;
  document.getElementById("topbar-role").innerHTML = roleBadge(userData.role);

  // Role-gated nav items
  const isAdmin = userData.role === "admin";
  const isManager = userData.role === "manager";
  document.getElementById("nav-members").style.display = isAdmin || isManager ? "flex" : "none";
  document.getElementById("nav-admin").style.display = isAdmin ? "flex" : "none";
  document.getElementById("btn-new-task").style.display = isAdmin || isManager ? "inline-flex" : "none";

  // Populate assignee dropdown
  populateAssigneeDropdown();

  // Real-time subscriptions
  subscribeToTasks(onTasksUpdate);
  subscribeToActivity(onActivityUpdate);
  subscribeToNotifications(user.uid, onNotificationsUpdate);
  subscribeToMembers((members) => {
    populateAssigneeDropdown();
    if (document.getElementById("page-members").classList.contains("active")) renderMembersPage();
  });

  if (isAdmin) {
    subscribeToPendingMembers(onPendingMembersUpdate);
  }

  // Nav bindings
  bindNavEvents();
  bindTaskEvents();
  bindAdminEvents();
  bindNotifEvents();

  // Default page
  showPage("dashboard");
}

// ─────────────────────────────────────────────────
// Assign dropdown
// ─────────────────────────────────────────────────
function populateAssigneeDropdown() {
  const sel = document.getElementById("nt-assignee");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Open to anyone —</option>';
  for (const [uid, m] of Object.entries(allMembers)) {
    if (currentUser && uid === currentUser.uid) continue;
    const opt = document.createElement("option");
    opt.value = uid;
    opt.textContent = `${m.name} (${m.role})`;
    sel.appendChild(opt);
  }
  if (prev) sel.value = prev;
}

// ─────────────────────────────────────────────────
// Page rendering
// ─────────────────────────────────────────────────
let currentPage = "dashboard";
let currentFilter = "all";

function showPage(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  document.getElementById(`page-${page}`)?.classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");
  currentPage = page;

  if (page === "members") renderMembersPage();
  if (page === "admin") renderAdminPage();
}

function bindNavEvents() {
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      currentFilter = chip.dataset.filter;
      renderTasksPage();
    });
  });
}

// ─────────────────────────────────────────────────
// Tasks rendering
// ─────────────────────────────────────────────────
let allTasksCache = [];

function onTasksUpdate(tasks) {
  allTasksCache = tasks;
  renderStats(tasks);
  renderMyTasks(tasks);
  if (currentPage === "tasks") renderTasksPage();
}

function renderStats(tasks) {
  document.getElementById("stat-total").textContent = tasks.length;
  document.getElementById("stat-pending").textContent = tasks.filter((t) => t.status === "pending").length;
  document.getElementById("stat-accepted").textContent = tasks.filter((t) => t.status === "accepted").length;
  document.getElementById("stat-completed").textContent = tasks.filter((t) => t.status === "completed").length;
}

function renderMyTasks(tasks) {
  const mine = tasks.filter(
    (t) => t.assigneeId === currentUser?.uid || t.acceptedBy === currentUser?.uid
  );
  renderTaskList("my-tasks-list", mine);
}

function renderTasksPage() {
  let tasks = allTasksCache;
  if (currentFilter === "pending") tasks = tasks.filter((t) => t.status === "pending");
  else if (currentFilter === "accepted") tasks = tasks.filter((t) => t.status === "accepted");
  else if (currentFilter === "completed") tasks = tasks.filter((t) => t.status === "completed");
  else if (currentFilter === "high") tasks = tasks.filter((t) => t.priority === "high");
  renderTaskList("tasks-list", tasks);
}

function renderTaskList(containerId, tasks) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (tasks.length === 0) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">◎</div><div class="empty-text">No tasks here</div></div>`;
    return;
  }

  el.innerHTML = tasks.map((t) => taskCardHTML(t)).join("");
}

function taskCardHTML(task) {
  const ud = currentUserData;
  const canManage = ud?.role === "admin" || ud?.role === "manager";
  const canAccept =
    task.status === "pending" &&
    (!task.assigneeId || task.assigneeId === currentUser?.uid) &&
    task.acceptedBy !== currentUser?.uid;
  const isAccepterOrAssigned =
    task.acceptedBy === currentUser?.uid ||
    (task.assigneeId === currentUser?.uid && task.status === "accepted");
  const canComplete = isAccepterOrAssigned && task.status === "accepted";

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && task.status !== "completed";
  const dueStr = due
    ? `<span class="task-due ${overdue ? "overdue" : ""}">
        ${overdue ? "⚠ " : ""}Due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </span>`
    : "";

  const whoStr = task.acceptedBy
    ? `👤 ${allMembers[task.acceptedBy]?.name || task.acceptedByName || "?"} (accepted)`
    : task.assigneeId
    ? `👤 ${allMembers[task.assigneeId]?.name || task.assigneeName || "?"} (assigned)`
    : `👤 Open`;

  return `
  <div class="task-card" data-id="${task.id}">
    <div class="task-card-top">
      ${priorityDot(task.priority)}
      <div style="flex:1;min-width:0">
        <div class="task-title">${task.title}</div>
        ${task.description ? `<div class="task-desc">${task.description}</div>` : ""}
      </div>
    </div>
    <div class="task-meta">
      ${statusTag(task.status)}
      ${dueStr}
      <span class="task-who">${whoStr}</span>
    </div>
    <div class="task-actions">
      ${canAccept ? `<button class="btn btn-secondary btn-sm" onclick="window._acceptTask('${task.id}')">Accept</button>` : ""}
      ${canComplete ? `<button class="btn btn-complete btn-sm" onclick="window._completeTask('${task.id}')">Mark Complete</button>` : ""}
      ${canManage && task.status !== "completed" ? `<button class="btn btn-danger btn-sm" onclick="window._deleteTask('${task.id}')">Delete</button>` : ""}
      <span class="comment-count" onclick="window._openDetail('${task.id}')">💬 ${task.commentCount || 0} &middot; History</span>
    </div>
  </div>`;
}

function bindTaskEvents() {
  window._acceptTask = async (id) => { try { await acceptTask(id); } catch (e) { showToast(e.message, "error"); } };
  window._completeTask = async (id) => { try { await completeTask(id); } catch (e) { showToast(e.message, "error"); } };
  window._deleteTask = async (id) => { if (confirm("Delete this task?")) { try { await deleteTask(id); } catch (e) { showToast(e.message, "error"); } } };
  window._openDetail = (id) => openTaskDetail(id);

  document.getElementById("btn-new-task")?.addEventListener("click", () => {
    document.getElementById("new-task-modal").classList.add("open");
    document.getElementById("nt-title").focus();
  });

  document.getElementById("btn-create-task")?.addEventListener("click", async () => {
    clearError("nt-error");
    setLoading("btn-create-task", true, "Create Task");
    try {
      const assigneeId = document.getElementById("nt-assignee").value;
      await createTask({
        title: document.getElementById("nt-title").value,
        description: document.getElementById("nt-desc").value,
        priority: document.getElementById("nt-priority").value,
        dueDate: document.getElementById("nt-due").value || null,
        assigneeId: assigneeId || null,
        assigneeName: assigneeId ? allMembers[assigneeId]?.name : null,
      });
      document.getElementById("new-task-modal").classList.remove("open");
      ["nt-title", "nt-desc", "nt-due"].forEach((id) => (document.getElementById(id).value = ""));
    } catch (e) {
      showError("nt-error", e.message);
    }
    setLoading("btn-create-task", false, "Create Task");
  });

  // Close modals
  document.querySelectorAll(".modal-close, .modal-overlay").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target === el) e.target.closest(".modal-overlay")?.classList.remove("open");
    });
  });

  document.querySelectorAll(".modal").forEach((m) => {
    m.addEventListener("click", (e) => e.stopPropagation());
  });
}

// ─────────────────────────────────────────────────
// Task Detail Modal
// ─────────────────────────────────────────────────
async function openTaskDetail(taskId) {
  const task = allTasksCache.find((t) => t.id === taskId);
  if (!task) return;

  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("detail-modal-body");
  document.getElementById("detail-modal-title").textContent = task.title;
  modal.classList.add("open");
  body.innerHTML = `<div class="loading"><div class="spinner"></div>Loading…</div>`;

  const { comments, history } = await getTaskDetail(taskId);

  const commentsHTML = comments.length === 0
    ? `<div style="color:var(--muted);font-size:12px;padding:0.5rem 0">No comments yet</div>`
    : comments.map((c) => `
      <div class="comment-item">
        ${avatarHTML(c.authorId, c.authorName, 28)}
        <div class="comment-body">
          <div class="comment-author">${c.authorName}</div>
          <div class="comment-text">${c.text}</div>
          <div class="comment-time">${formatTimestamp(c.createdAt)}</div>
        </div>
      </div>`).join("");

  const histHTML = history.map((h, i) => `
    <div class="history-item">
      <div class="history-line">
        <div class="history-dot" style="border-color:${h.type === "completed" ? "var(--green)" : h.type === "accepted" ? "var(--amber)" : "var(--accent)"}"></div>
        ${i < history.length - 1 ? `<div class="history-connector"></div>` : ""}
      </div>
      <div>
        <div class="history-action">${h.text}</div>
        <div class="history-meta">${formatTimestamp(h.createdAt)}</div>
      </div>
    </div>`).join("");

  const due = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "None";

  body.innerHTML = `
    <div class="detail-grid">
      <div><div class="detail-label">Status</div>${statusTag(task.status)}</div>
      <div><div class="detail-label">Priority</div><span style="font-weight:500;color:${task.priority==="high"?"var(--red)":task.priority==="medium"?"var(--amber)":"var(--green)"}">${task.priority}</span></div>
      <div><div class="detail-label">Created by</div>${allMembers[task.createdBy]?.name || task.createdByName || "?"}</div>
      <div><div class="detail-label">Due date</div>${due}</div>
    </div>
    ${task.description ? `<div class="detail-desc">${task.description}</div>` : ""}

    <div class="comments-section">
      <div class="section-title">Comments</div>
      <div id="modal-comments">${commentsHTML}</div>
      <div class="comment-input-row">
        <textarea id="comment-input" placeholder="Write a comment…" rows="2"></textarea>
        <button class="btn btn-secondary btn-sm" id="btn-post-comment">Post</button>
      </div>
    </div>

    <div class="history-section">
      <div class="section-title">Task History</div>
      ${histHTML || `<div style="color:var(--muted);font-size:12px">No history yet</div>`}
    </div>`;

  document.getElementById("btn-post-comment")?.addEventListener("click", async () => {
    const text = document.getElementById("comment-input").value;
    try {
      await addComment(taskId, text);
      openTaskDetail(taskId); // Refresh
    } catch (e) {
      showToast(e.message, "error");
    }
  });
}

// ─────────────────────────────────────────────────
// Activity log
// ─────────────────────────────────────────────────
function onActivityUpdate(items) {
  const el = document.getElementById("activity-list");
  if (!el) return;

  const iconMap = { task_created:"✦", task_accepted:"◎", task_completed:"✓", task_deleted:"✕", comment_added:"💬", join_request:"👋", member_approved:"✅", member_rejected:"✕", role_changed:"🔄", join_code_created:"🔑" };

  el.innerHTML = items.length === 0
    ? `<div class="empty"><div class="empty-text">No activity yet</div></div>`
    : items.map((a) => `
      <div class="activity-item">
        <div class="activity-icon">${iconMap[a.type] || "•"}</div>
        <div>
          <div class="activity-text">${a.text}</div>
          <div class="activity-time">${timeAgo(a.createdAt)}</div>
        </div>
      </div>`).join("");
}

// ─────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────
function onNotificationsUpdate(notifs) {
  const unread = notifs.filter((n) => !n.read).length;
  const badge = document.getElementById("notif-badge");
  if (badge) {
    badge.style.display = unread > 0 ? "flex" : "none";
    badge.textContent = unread > 9 ? "9+" : unread;
  }

  const list = document.getElementById("notif-list");
  if (!list) return;

  list.innerHTML = notifs.length === 0
    ? `<div style="padding:1rem;color:var(--muted);font-size:12px;text-align:center">No notifications</div>`
    : notifs.slice(0, 25).map((n) => `
        <div class="notif-item ${n.read ? "" : "unread"}" onclick="window._readNotif('${n.id}')">
          ${n.message}
          <div class="notif-time">${timeAgo(n.createdAt)}</div>
        </div>`).join("");
}

function bindNotifEvents() {
  window._readNotif = async (id) => await markNotifRead(id);

  document.getElementById("notif-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("notif-panel").classList.toggle("open");
  });

  document.getElementById("btn-mark-all-read")?.addEventListener("click", () => {
    if (currentUser) markAllNotifsRead(currentUser.uid);
  });

  document.addEventListener("click", (e) => {
    const panel = document.getElementById("notif-panel");
    const btn = document.getElementById("notif-btn");
    if (panel?.classList.contains("open") && !panel.contains(e.target) && !btn?.contains(e.target)) {
      panel.classList.remove("open");
    }
  });
}

// ─────────────────────────────────────────────────
// Members page
// ─────────────────────────────────────────────────
function renderMembersPage() {
  const grid = document.getElementById("members-grid");
  if (!grid) return;

  const members = Object.values(allMembers);
  if (members.length === 0) {
    grid.innerHTML = `<div class="empty"><div class="empty-text">No members yet</div></div>`;
    return;
  }

  const isAdmin = currentUserData?.role === "admin";

  grid.innerHTML = members.map((m) => {
    const [bg, fg] = getAvatarStyle(m.uid);
    const roleControl = isAdmin && m.uid !== currentUser?.uid
      ? `<select class="role-select" onchange="window._changeRole('${m.uid}', this.value)">
          <option value="member" ${m.role === "member" ? "selected" : ""}>Member</option>
          <option value="manager" ${m.role === "manager" ? "selected" : ""}>Manager</option>
          <option value="admin" ${m.role === "admin" ? "selected" : ""}>Admin</option>
        </select>`
      : roleBadge(m.role);

    return `
      <div class="member-card">
        <div class="member-avatar" style="background:${bg};color:${fg}">${initials(m.name)}</div>
        <div class="member-name">${m.name}</div>
        <div class="member-email">${m.email || m.phone || "—"}</div>
        <div style="margin-top:0.5rem">${roleControl}</div>
      </div>`;
  }).join("");

  window._changeRole = async (uid, role) => {
    try { await changeMemberRole(uid, role); } catch (e) { showToast(e.message, "error"); }
  };
}

// ─────────────────────────────────────────────────
// Admin panel
// ─────────────────────────────────────────────────
function onPendingMembersUpdate(pending) {
  const badge = document.getElementById("admin-badge");
  if (badge) {
    badge.style.display = pending.length > 0 ? "inline-flex" : "none";
    badge.textContent = pending.length;
  }

  const list = document.getElementById("pending-list");
  if (!list) return;

  list.innerHTML = pending.length === 0
    ? `<div class="empty"><div class="empty-text">No pending approvals</div></div>`
    : pending.map((m) => {
        const [bg, fg] = getAvatarStyle(m.uid);
        return `
          <div class="pending-card">
            <div class="member-avatar" style="background:${bg};color:${fg};width:36px;height:36px;font-size:13px">${initials(m.name)}</div>
            <div style="flex:1">
              <div style="font-weight:500;font-size:14px">${m.name}</div>
              <div style="font-size:12px;color:var(--muted)">${m.email || m.phone || "—"}</div>
            </div>
            <div style="display:flex;gap:0.5rem">
              <button class="btn btn-complete btn-sm" onclick="window._approve('${m.uid}')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="window._reject('${m.uid}')">Reject</button>
            </div>
          </div>`;
      }).join("");

  window._approve = async (uid) => { try { await approveMember(uid); } catch (e) { showToast(e.message, "error"); } };
  window._reject = async (uid) => { if (confirm("Reject this member?")) { try { await rejectMember(uid); } catch (e) { showToast(e.message, "error"); } } };
}

async function renderAdminPage() {
  // Join codes
  const codes = await getJoinCodes();
  const codesEl = document.getElementById("join-codes-list");
  if (codesEl) {
    codesEl.innerHTML = codes.length === 0
      ? `<div style="color:var(--muted);font-size:12px">No codes generated yet</div>`
      : codes.map((c) => `
          <div class="code-item">
            <span class="code-value">${c.code}</span>
            <span class="code-status ${c.used ? "used" : "active"}">${c.used ? "Used" : "Active"}</span>
            <span style="color:var(--muted);font-size:11px">${c.createdByName} · ${timeAgo(c.createdAt)}</span>
          </div>`).join("");
  }
}

function bindAdminEvents() {
  document.getElementById("btn-gen-code")?.addEventListener("click", async () => {
    setLoading("btn-gen-code", true, "Generate Code");
    try {
      const code = await generateJoinCode();
      showToast(`Join code: ${code}`, "success");
      renderAdminPage();
    } catch (e) {
      showToast(e.message, "error");
    }
    setLoading("btn-gen-code", false, "Generate Code");
  });
}
