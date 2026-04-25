// ═══════════════════════════════════════════════════
// ui.js — UI utilities: toast, screen management,
//          shared render helpers
// ═══════════════════════════════════════════════════

// ─────────────────────────────────────────────────
// Screen Management
// ─────────────────────────────────────────────────
export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => (s.style.display = "none"));
  const target = document.getElementById(screenId);
  if (!target) return;
  // app-screen needs flex + column layout
  target.style.display = "flex";
  if (screenId === "app-screen") {
    target.style.flexDirection = "column";
    target.style.height = "100vh";
  }
}

// ─────────────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────────────
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─────────────────────────────────────────────────
// Avatar utilities
// ─────────────────────────────────────────────────
const AVATAR_COLORS = [
  ["rgba(79,142,247,0.2)", "#4f8ef7"],
  ["rgba(62,207,142,0.2)", "#3ecf8e"],
  ["rgba(245,166,35,0.2)", "#f5a623"],
  ["rgba(242,92,92,0.2)", "#f25c5c"],
  ["rgba(124,95,245,0.2)", "#7c5ff5"],
  ["rgba(236,100,168,0.2)", "#ec64a8"],
];

export function getAvatarStyle(uid = "") {
  let hash = 0;
  for (const c of uid) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";
}

export function avatarHTML(uid, name, size = 28) {
  const [bg, fg] = getAvatarStyle(uid);
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.floor(size * 0.38)}px;background:${bg};color:${fg}">${initials(name)}</div>`;
}

// ─────────────────────────────────────────────────
// Time formatting
// ─────────────────────────────────────────────────
export function formatTimestamp(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return (
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

export function timeAgo(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return Math.floor(diff / 86400000) + "d ago";
}

// ─────────────────────────────────────────────────
// Status tag HTML
// ─────────────────────────────────────────────────
export function statusTag(status) {
  return `<span class="tag tag-${status}">${status}</span>`;
}

export function priorityDot(priority) {
  return `<div class="priority-dot p-${priority}" title="${priority} priority"></div>`;
}

// ─────────────────────────────────────────────────
// Role badge HTML
// ─────────────────────────────────────────────────
export function roleBadge(role) {
  return `<span class="role-badge role-${role}">${role}</span>`;
}

// ─────────────────────────────────────────────────
// Error display helper
// ─────────────────────────────────────────────────
export function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = message;
}

export function clearError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = "";
}

// ─────────────────────────────────────────────────
// Loading state helper
// ─────────────────────────────────────────────────
export function setLoading(buttonId, loading, originalText = "Submit") {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : originalText;
}
