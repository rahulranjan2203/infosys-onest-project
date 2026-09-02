# ONEST Certification Platform - Cloud Deployment Guide (Render & Vercel)

This guide walks you through deploying the **ONEST Certification Platform & Moodle LMS Simulator** for live demonstration using **Render** (for the Node.js Express Backend) and **Vercel** (for Frontend static hosting).

---

## 🚀 Option 1: Full-Stack Single Deployment on Render (Easiest & Recommended)

Because our backend serves both the **ONEST Cert Hub UI** (`/`), the **Moodle LMS Simulator UI** (`/moodle`), and all cryptographic REST APIs (`/api/credentials` & `/mock-moodle`), you can deploy everything in **one click** on Render!

### Steps:
1. **Push your code to GitHub**.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set the deployment configuration:
   - **Name**: `onest-cert-hub`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add Environment Variables (optional, defaults to SQLite):
   - `DB_TYPE` = `sqlite`
   - `NODE_ENV` = `production`
7. Click **Deploy Web Service**.

Once deployed, Render gives you a URL like `https://onest-cert-hub.onrender.com`:
- **ONEST Cert Hub Portal**: `https://onest-cert-hub.onrender.com/`
- **Moodle LMS Simulator**: `https://onest-cert-hub.onrender.com/moodle`
- **API Endpoints**: `https://onest-cert-hub.onrender.com/api/credentials/sync`

---

## 🌐 Option 2: Split Deployment (Vercel Frontend + Render Backend)

If you prefer hosting the static frontend UI on Vercel's edge network:

### Step 1: Deploy Backend to Render
Follow the steps in **Option 1** above to get your Render backend URL (e.g. `https://onest-cert-backend.onrender.com`).

### Step 2: Deploy Frontend to Vercel
1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Framework Preset: **Other** (Static Site).
5. Click **Deploy**. Vercel will automatically use `vercel.json` to route `/` to `index.html` and `/moodle` to `moodle.html`.

---

## 🔒 Environment Variable Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` (or set by Render) | Main Express server listening port |
| `DB_TYPE` | `sqlite` | Database engine (`sqlite` or `mysql`) |
| `MOODLE_API_URL` | `http://localhost:${PORT}/mock-moodle` | Base REST endpoint for Moodle LMS integration |
| `MOODLE_TOKEN` | `MOCK_MOODLE_TOKEN_123` | Authorized access token for Moodle APIs |
| `NODE_ENV` | `development` | Deployment environment |

---

## 🧪 Testing your Deployment

Once deployed, verify the workflow:
1. Open the **Moodle LMS Simulator** (`/moodle`).
2. Adjust a student's final grade slider (e.g., set John Doe to 85%).
3. Click **Trigger Moodle Grade Sync**.
4. Open the **ONEST Cert Hub** (`/`).
5. Select **John Doe** to view the cryptographically signed W3C Verifiable Credential.
6. Click **Run ES256 Verification** to confirm signature validity!
