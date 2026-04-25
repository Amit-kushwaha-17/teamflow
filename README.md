# TeamFlow — Real-Time Team Task Tracker

## Project Structure

```
teamflow/
├── public/                    ← Netlify serves this folder
│   ├── index.html             ← Main app (all screens)
│   └── src/
│       ├── css/
│       │   └── styles.css     ← All styles
│       └── js/
│           ├── firebase.js    ← 🔥 PUT YOUR CONFIG HERE
│           ├── app.js         ← Main orchestrator
│           ├── auth.js        ← Email / Google / Phone auth
│           ├── tasks.js       ← Task CRUD + real-time
│           ├── members.js     ← Members + join codes + approvals
│           ├── notifications.js ← In-app + email notifications
│           ├── activity.js    ← Activity log
│           └── ui.js          ← UI helpers, toast, avatars
├── functions/                 ← Firebase Cloud Functions (backend)
│   ├── index.js               ← Email notification functions
│   └── package.json
├── firestore.rules            ← Firestore security rules
├── firestore.indexes.json     ← Firestore query indexes
├── firebase.json              ← Firebase CLI config
├── netlify.toml               ← Netlify deploy config
└── README.md
```

---

## Step 1: Firebase Setup (15 minutes)

### 1.1 Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → give it a name → Create
3. **Disable Google Analytics** (not needed)

### 1.2 Enable Authentication
1. Firebase Console → **Authentication** → Get Started
2. Enable **Email/Password**
3. Enable **Google**
4. Enable **Phone**

### 1.3 Create Firestore Database
1. Firebase Console → **Firestore Database** → Create Database
2. Choose **Production mode** (we'll add rules)
3. Pick your region (e.g., `asia-south1` for India)

### 1.4 Get Your Config
1. Firebase Console → Project Settings (gear icon)
2. Scroll to **Your Apps** → Click the **</>** web icon if no app yet
3. Register the app → Copy the `firebaseConfig` object

### 1.5 Paste Config
Open `public/src/js/firebase.js` and replace the config:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
};
```

---

## Step 2: Deploy Firestore Rules

### Via Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init   # Select Firestore + Functions, link your project
firebase deploy --only firestore:rules,firestore:indexes
```

### Or manually in Firebase Console:
1. Firestore → **Rules** tab
2. Paste contents of `firestore.rules`
3. Click **Publish**

---

## Step 3: Deploy to Netlify

### Option A: Drag & Drop (easiest)
1. Go to [netlify.com](https://netlify.com) → Log in
2. Click **Add new site** → **Deploy manually**
3. Drag the entire `public/` folder onto the deploy zone
4. Done! You get a URL like `https://your-site.netlify.app`

### Option B: Git (recommended for updates)
1. Push this repo to GitHub
2. Netlify → **Import from Git** → Connect GitHub → Select repo
3. Build settings:
   - **Publish directory:** `public`
   - **Build command:** (leave empty)
4. Click **Deploy site**

---

## Step 4: Email Notifications (optional but recommended)

Email notifications use Firebase Cloud Functions + Gmail.

### 4.1 Set Up Gmail App Password
1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** if not already
3. Search for **App Passwords** → Create one for "Mail"
4. Copy the 16-character password

### 4.2 Set Firebase Secrets
```bash
firebase functions:secrets:set GMAIL_USER
# Enter: your-gmail@gmail.com

firebase functions:secrets:set GMAIL_PASS
# Enter: your-16-char-app-password
```

### 4.3 Deploy Functions
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## Step 5: First Login

1. Open your Netlify URL
2. You'll see the **auth screen**
3. Click **Register** → the very first registration automatically
   creates an admin (no join code needed for the first user)

   > **Wait** — actually, this is handled by `createFirstAdmin()` in auth.js.
   > The first user to register gets Admin role with `status: approved`.

4. Sign in with your admin account
5. You'll see the full app with the Admin panel

---

## How the Join Code System Works

```
Admin generates code  →  Admin shares code with new team member
         ↓
New member registers with the code
         ↓
Member's account is created with status: "pending"
         ↓
Admin gets notified (in-app + email)
         ↓
Admin approves in Admin Panel → Member gets notified → Member can now log in
```

**Join codes are:**
- Single-use (each code can only be used once)
- 7-day expiry
- Generated from Admin Panel → "Generate Code" button
- 6-character alphanumeric (e.g., `AB12CD`)

---

## Role Permissions

| Action | Member | Manager | Admin |
|--------|--------|---------|-------|
| View tasks | ✅ | ✅ | ✅ |
| Accept tasks | ✅ | ✅ | ✅ |
| Complete tasks | ✅ (own only) | ✅ (own only) | ✅ (own only) |
| Create tasks | ❌ | ✅ | ✅ |
| Delete tasks | ❌ | ✅ | ✅ |
| View members | ❌ | ✅ | ✅ |
| Change roles | ❌ | ❌ | ✅ |
| Approve members | ❌ | ✅ | ✅ |
| Generate join codes | ❌ | ✅ | ✅ |

---

## Auth Methods

| Method | How it works |
|--------|-------------|
| **Email/Password** | Standard registration with join code |
| **Google** | Sign in with Google → if new, prompted for join code |
| **Phone (OTP)** | Enter phone → receive SMS OTP → verify → if new, prompted for join code |

---

## Firestore Data Structure

```
users/{uid}
  - name, email, phone, role, status, createdAt

tasks/{taskId}
  - title, description, priority, status, dueDate
  - assigneeId, acceptedBy, createdBy
  - commentCount, createdAt, completedAt
  └── comments/{commentId}
  └── history/{historyId}

activity/{activityId}
  - type, text, authorId, createdAt

notifications/{notifId}
  - type, message, recipientId, read, createdAt

joinCodes/{codeId}
  - code, used, usedBy, createdBy, createdAt, expiresAt
```

---

## Local Development

```bash
# Serve the public folder locally
npx serve public

# Or with Python
python3 -m http.server 8080 --directory public
```

Open `http://localhost:8080`

---

## Troubleshooting

**"Permission denied" errors** → Check Firestore rules are deployed

**Google sign-in popup blocked** → Allow popups for your Netlify domain

**Phone OTP not sending** → Add your domain to Firebase Auth → Authorized Domains

**Email notifications not working** → Check Cloud Functions logs: `firebase functions:log`

**Firestore indexes error** → Deploy indexes: `firebase deploy --only firestore:indexes`
