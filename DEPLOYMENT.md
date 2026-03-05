# Deployment Guide — Vercel + Supabase

This guide walks through deploying **Email History** with:

- **Vercel** — hosts the Node.js/Express API and static frontend
- **Supabase** — PostgreSQL database (free tier available)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Supabase Setup](#2-supabase-setup)
3. [Vercel Setup](#3-vercel-setup)
4. [Environment Variables](#4-environment-variables)
5. [Deploy](#5-deploy)
6. [Post-Deployment Steps](#6-post-deployment-steps)
7. [Troubleshooting](#7-troubleshooting)
8. [Updating the App](#8-updating-the-app)

---

## 1. Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **Node.js** (v18+) | Local development/testing | https://nodejs.org |
| **Git** | Version control | https://git-scm.com |
| **Vercel CLI** (optional) | Deploy from terminal | `npm i -g vercel` |
| **Supabase account** | Database hosting | https://supabase.com (free) |
| **GitHub account** | Connect repo to Vercel | https://github.com |

---

## 2. Supabase Setup

### 2.1 Create a Supabase Project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Choose an **Organization**, give it a name (e.g. `emailhistory`), set a **database password**, and select a **region** close to your users.
4. Click **Create new project** and wait for provisioning (~2 minutes).

### 2.2 Get Your Credentials

Once the project is ready:

1. Go to **Project Settings → API** (left sidebar → gear icon → API).
2. Copy these two values (you'll need them later):
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **service_role key** (under "Project API keys") — the **secret** key, NOT the `anon` key

> **Warning:** The `service_role` key bypasses Row Level Security. Never expose it in client-side code.

### 2.3 Create Database Tables

Go to **SQL Editor** in the Supabase dashboard (left sidebar) and run the following SQL statements **one at a time**:

#### Table: `users`

```sql
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table: `records`

```sql
CREATE TABLE IF NOT EXISTS records (
  id              BIGSERIAL PRIMARY KEY,
  data            JSONB DEFAULT '{}'::jsonb,
  region          TEXT DEFAULT '',
  source_file     TEXT DEFAULT '',
  row_index       INTEGER DEFAULT 0,
  last_visit_date DATE,
  uploaded_by     BIGINT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_region ON records (region);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON records (created_at DESC);
```

#### Table: `communications`

```sql
CREATE TABLE IF NOT EXISTS communications (
  id                                     BIGSERIAL PRIMARY KEY,
  record_id                              BIGINT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  visit_date                             DATE NOT NULL,
  sales_officer_visit_date               DATE,
  major_minor_irregularities             TEXT DEFAULT '',
  deviation_noticed_no                   TEXT DEFAULT '',
  deviation_noticed_no_and_date          TEXT DEFAULT '',
  deviation_noticed_date                 DATE,
  reply_received_by_dealer_date          DATE,
  reply_satisfactory_yes_no              TEXT DEFAULT '',
  imposition_of_mdg_penalty_notice_date  DATE,
  reminder1_date                         DATE,
  reminder1_reply_date                   DATE,
  reminder2_date                         DATE,
  reminder2_reply_date                   DATE,
  penalty_recover_by                     TEXT DEFAULT '',
  penalty_rtgs_dd_no_and_date            TEXT DEFAULT '',
  emi_dates                              TEXT DEFAULT '',
  transition_complete                    TEXT DEFAULT '',
  created_at                             TIMESTAMPTZ DEFAULT now(),
  updated_at                             TIMESTAMPTZ DEFAULT now(),

  UNIQUE (record_id, visit_date)
);
```

> **Important:** The `UNIQUE (record_id, visit_date)` constraint is required for the communication upsert to work. If you already have this table without the constraint, run:
> ```sql
> ALTER TABLE communications ADD CONSTRAINT communications_record_visit_unique UNIQUE (record_id, visit_date);
> ```

### 2.4 Verify Tables

In the SQL Editor, run:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see: `communications`, `records`, `users`.

---

## 3. Vercel Setup

### 3.1 Push Code to GitHub

If your project is not already in a Git repository:

```bash
cd emailhistory
git init
git add -A
git commit -m "Initial commit"
```

Create a new GitHub repository (https://github.com/new), then push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/emailhistory.git
git branch -M main
git push -u origin main
```

> **Important:** Make sure `.env` is in `.gitignore` so your secrets are not pushed!

Create a `.gitignore` in the project root if it doesn't exist:

```
node_modules/
backend/node_modules/
backend/.env
backend/uploads/
.env
```

### 3.2 Connect to Vercel

**Option A — Vercel Dashboard (recommended):**

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New → Project**.
3. Import your `emailhistory` GitHub repository.
4. In the configuration screen:
   - **Framework Preset:** Select `Other`
   - **Root Directory:** Leave as `.` (project root)
   - **Build Command:** Leave empty (no build step needed)
   - **Output Directory:** Leave empty
5. Add environment variables (see Section 4 below).
6. Click **Deploy**.

**Option B — Vercel CLI:**

```bash
cd emailhistory
npm i -g vercel
vercel login
vercel
```

Follow the prompts. When asked, select "Link to existing project" or create new.

---

## 4. Environment Variables

Set these in the **Vercel Dashboard → Project → Settings → Environment Variables**:

| Variable | Value | Example |
|----------|-------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role secret key | `eyJhbGciOiJIUzI...` |
| `JWT_SECRET` | A strong random string for JWT signing | `my-super-secret-jwt-key-2024` |
| `MAX_FILE_SIZE_MB` | Maximum upload file size in MB | `10` |

### Generating a strong JWT_SECRET

Run this in your terminal:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use the output as your `JWT_SECRET`.

> **Important:** Set variables for **all environments** (Production, Preview, Development) or at least for Production.

---

## 5. Deploy

### First Deployment

After connecting to Vercel and setting environment variables:

1. Vercel will automatically deploy when you push to `main`.
2. Or trigger a manual deploy from Vercel Dashboard → **Deployments → Redeploy**.

### How It Works

The `vercel.json` configuration:
- Routes `/api/*` requests to the Express serverless function (`api/index.js`)
- Serves static files (HTML, CSS, JS) directly from the `frontend/` directory
- The root URL `/` serves `frontend/index.html`

### Verify the Deployment

After deployment, Vercel gives you a URL like `https://emailhistory-abc123.vercel.app`. Test:

1. Visit the URL — you should see the login page
2. Visit `https://your-app.vercel.app/api/regions` — should return a JSON array of regions
3. Sign up, log in, and test the full flow

---

## 6. Post-Deployment Steps

### 6.1 Create Your First User

Navigate to the signup page at `https://your-app.vercel.app/signup.html` and create an account.

Alternatively, you can seed a user via the Supabase SQL Editor:

```sql
-- Password is 'admin123' (bcrypt hash)
INSERT INTO users (email, password) VALUES (
  'admin@example.com',
  '$2a$10$6ixiGfMKsLssSrQ5x8kxGuQlGFe8sFxHRQExkJbsMfPo1PqLWWG2e'
);
```

### 6.2 Custom Domain (Optional)

1. Go to Vercel Dashboard → Project → **Settings → Domains**.
2. Add your custom domain (e.g. `emailhistory.yourdomain.com`).
3. Update your DNS records as instructed by Vercel.

### 6.3 Upload File Size for Vercel

Vercel serverless functions have a **4.5 MB request body limit** on the free/Hobby plan. If you need larger Excel uploads:
- Upgrade to Vercel Pro (50 MB limit)
- Or handle uploads directly to Supabase Storage

---

## 7. Troubleshooting

### "Failed to fetch records" or empty dashboard

- Check that Supabase tables exist (run the CREATE TABLE statements from Section 2.3)
- Check Vercel Function Logs: **Dashboard → Project → Deployments → (latest) → Functions tab**
- Verify environment variables are set correctly in Vercel

### "Failed to save" on communication form

- Ensure the `communications` table has the `UNIQUE (record_id, visit_date)` constraint
- Check Vercel logs for the specific error

### 401 Unauthorized errors

- Your JWT_SECRET in Vercel must match what was used to sign tokens
- If you changed JWT_SECRET after users logged in, they need to log in again

### File uploads fail

- Vercel has a 4.5 MB body size limit (free plan). Check file size.
- Ensure `multer` and `xlsx` dependencies are installed

### CORS errors in browser

- The Express app includes `cors()` middleware which allows all origins
- If you're using a custom domain, the CORS should work automatically

### Build/deploy errors

- Make sure `backend/node_modules` is committed OR dependencies are listed in a root `package.json`
- Vercel installs dependencies from the root `package.json` automatically

### Dependencies not found

If Vercel can't find backend dependencies, add them to the root `package.json`:

```bash
cd emailhistory
npm init -y
npm install @supabase/supabase-js bcryptjs cors dotenv express jsonwebtoken multer xlsx
```

---

## 8. Updating the App

### Automatic deploys

Push changes to `main` and Vercel deploys automatically:

```bash
git add -A
git commit -m "Update feature"
git push origin main
```

### Rollback

In Vercel Dashboard → Deployments, click the three dots on any previous deployment and select **Promote to Production** to rollback.

---

## Project Structure Reference

```
emailhistory/
├── api/
│   └── index.js            ← Vercel serverless entry point
├── backend/
│   ├── .env                ← Local env vars (NOT deployed)
│   ├── package.json
│   ├── server.js           ← Local dev server
│   ├── config/
│   │   ├── supabase.js     ← Supabase client
│   │   └── regions.js      ← Region list
│   ├── middleware/
│   │   ├── auth.js         ← JWT auth middleware
│   │   └── upload.js       ← Multer file upload config
│   ├── routes/
│   │   ├── auth.js         ← Login/signup endpoints
│   │   ├── records.js      ← CRUD for records
│   │   ├── communications.js ← Communication forms
│   │   └── upload.js       ← Excel upload/parse
│   └── scripts/
│       └── seed-user.js    ← Utility to seed users
├── frontend/
│   ├── index.html          ← Landing/redirect page
│   ├── login.html          ← Login page with region selector
│   ├── signup.html         ← Registration page
│   ├── dashboard.html      ← Records table with region filter
│   ├── record.html         ← Single record detail
│   ├── communication.html  ← Communication form per visit date
│   ├── upload.html         ← Excel file upload
│   ├── css/style.css
│   └── js/auth.js          ← Client-side auth helpers
├── vercel.json             ← Vercel deployment config
├── package.json            ← Root package.json
└── .gitignore
```

---

## Quick Reference — Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role secret |
| `JWT_SECRET` | Yes | Random string for signing auth tokens |
| `MAX_FILE_SIZE_MB` | No | Max upload size (default: 5) |
| `PORT` | No | Local dev port (default: 3000, ignored on Vercel) |
