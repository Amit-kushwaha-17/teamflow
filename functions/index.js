// ═══════════════════════════════════════════════════
// functions/index.js — Firebase Cloud Functions
// Backend: Email notifications via Nodemailer + Gmail
//
// Deploy with: firebase deploy --only functions
// ═══════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();

// ─────────────────────────────────────────────────
// Email transporter — uses Gmail App Password
// Setup: Google Account → Security → App Passwords
//
// Set these in Firebase environment config:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_PASS
// ─────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,  // App password, not your real password
    },
  });
}

// ─────────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────────
function getEmailTemplate(type, data) {
  const base = (content) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0d0f14; margin: 0; padding: 20px; }
        .card { background: #13161e; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; max-width: 480px; margin: 0 auto; }
        .logo { font-size: 20px; font-weight: 600; color: #e8eaf0; margin-bottom: 24px; }
        .logo span { color: #4f8ef7; }
        .content { color: #e8eaf0; line-height: 1.6; }
        .task-name { background: #1a1e2a; border-left: 3px solid #4f8ef7; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; font-weight: 500; color: #e8eaf0; }
        .tag { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-family: monospace; }
        .tag-green { background: rgba(62,207,142,0.15); color: #3ecf8e; }
        .tag-amber { background: rgba(245,166,35,0.15); color: #f5a623; }
        .tag-blue { background: rgba(79,142,247,0.15); color: #4f8ef7; }
        .footer { margin-top: 32px; font-size: 12px; color: #7a8099; border-top: 1px solid rgba(255,255,255,0.07); padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Team<span>Flow</span></div>
        <div class="content">${content}</div>
        <div class="footer">TeamFlow — Your team task tracker. This is an automated notification.</div>
      </div>
    </body>
    </html>`;

  const templates = {
    task_assigned: base(`
      <p>Hi there 👋</p>
      <p><strong>${data.senderName}</strong> assigned you a new task:</p>
      <div class="task-name">${data.taskTitle}</div>
      <p>Log in to <strong>TeamFlow</strong> to accept and get started.</p>
    `),

    task_accepted: base(`
      <p>Hi there 👋</p>
      <p><span class="tag tag-amber">Accepted</span> &nbsp;<strong>${data.senderName}</strong> has accepted your task:</p>
      <div class="task-name">${data.taskTitle}</div>
      <p>They're on it! You'll be notified when it's completed.</p>
    `),

    task_completed: base(`
      <p>Hi there 👋</p>
      <p><span class="tag tag-green">Completed ✓</span> &nbsp;<strong>${data.senderName}</strong> completed your task:</p>
      <div class="task-name">${data.taskTitle}</div>
      <p>Great work by the team! Log in to review the completed task.</p>
    `),

    new_comment: base(`
      <p>Hi there 👋</p>
      <p><strong>${data.senderName}</strong> left a comment on:</p>
      <div class="task-name">${data.taskTitle}</div>
      <p>Log in to TeamFlow to see the comment and reply.</p>
    `),

    account_approved: base(`
      <p>Hi there 👋</p>
      <p>Your request to join the team has been <span class="tag tag-green">Approved ✓</span></p>
      <p><strong>${data.senderName}</strong> approved your account. You can now sign in and start working on tasks!</p>
    `),

    join_request: base(`
      <p>👋 New join request!</p>
      <p><strong>${data.senderName}</strong> wants to join your team on TeamFlow.</p>
      <p>Log in to the Admin Panel to approve or reject their request.</p>
    `),
  };

  return templates[type] || base(`<p>${data.message}</p>`);
}

function getEmailSubject(type, taskTitle) {
  const subjects = {
    task_assigned: `📋 New task assigned: ${taskTitle}`,
    task_accepted: `✅ Task accepted: ${taskTitle}`,
    task_completed: `🎉 Task completed: ${taskTitle}`,
    new_comment: `💬 New comment on: ${taskTitle}`,
    account_approved: `✅ Your TeamFlow account is approved!`,
    join_request: `👋 New team join request on TeamFlow`,
  };
  return subjects[type] || `TeamFlow notification`;
}

// ─────────────────────────────────────────────────
// Callable: sendEmailNotification
// Called from frontend notifications.js
// ─────────────────────────────────────────────────
exports.sendEmailNotification = onCall(
  { secrets: ["GMAIL_USER", "GMAIL_PASS"] },
  async (request) => {
    const { type, taskId, taskTitle, recipientId, senderName, message } = request.data;

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    // Fetch recipient email from Firestore
    const recipientSnap = await db.collection("users").doc(recipientId).get();
    if (!recipientSnap.exists) {
      throw new HttpsError("not-found", "Recipient user not found.");
    }

    const recipientEmail = recipientSnap.data().email;
    if (!recipientEmail) {
      // Phone-only users have no email — skip silently
      return { success: true, skipped: true };
    }

    const transporter = createTransporter();

    await transporter.sendMail({
      from: `"TeamFlow" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: getEmailSubject(type, taskTitle),
      html: getEmailTemplate(type, { senderName, taskTitle, message }),
    });

    return { success: true };
  }
);

// ─────────────────────────────────────────────────
// Trigger: Notify admins when new join request arrives
// Auto-fires when a user doc is created with status=pending
// ─────────────────────────────────────────────────
exports.notifyAdminsOnJoinRequest = onDocumentCreated(
  { document: "users/{userId}", secrets: ["GMAIL_USER", "GMAIL_PASS"] },
  async (event) => {
    const newUser = event.data.data();
    if (newUser.status !== "pending") return;

    // Get all admins
    const adminsSnap = await db
      .collection("users")
      .where("role", "==", "admin")
      .where("status", "==", "approved")
      .get();

    if (adminsSnap.empty) return;

    const transporter = createTransporter();

    const emailPromises = [];
    adminsSnap.forEach((adminDoc) => {
      const admin = adminDoc.data();
      if (!admin.email) return;

      emailPromises.push(
        transporter.sendMail({
          from: `"TeamFlow" <${process.env.GMAIL_USER}>`,
          to: admin.email,
          subject: `👋 New team join request: ${newUser.name}`,
          html: getEmailTemplate("join_request", {
            senderName: newUser.name,
            taskTitle: null,
            message: `${newUser.name} wants to join your team.`,
          }),
        })
      );
    });

    await Promise.allSettled(emailPromises);
  }
);
