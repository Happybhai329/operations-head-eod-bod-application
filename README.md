# 🌟 The Prime Classes — Branch Head & Super Admin Full-Stack Platform

Enterprise full-stack web application converting the legacy Google Apps Script Branch Head / Super Admin system into a high-performance **PostgreSQL Primary Database** architecture with **Outbox Google Sheets Synchronization**.

---

## 🏛️ System Architecture

```
                                  +------------------------------------+
                                  |    React 18 + TypeScript + Vite    |
                                  | (Tailwind CSS / Lucide / html2pdf) |
                                  +------------------+-----------------+
                                                     |
                                                     | REST API (JWT Session)
                                                     v
                                  +------------------------------------+
                                  |       Node.js + Express + TS       |
                                  |  (Scoring Engine, Auditing, Auth)  |
                                  +---------+----------------+---------+
                                            |                |
                     Primary Read & Write   |                | Outbox Enqueue (sync_jobs)
                                            v                v
                          +--------------------+   +--------------------+
                          | PostgreSQL 16 (DB) |   |  sync_jobs (Queue) |
                          |   (Prisma ORM)     |   +---------+----------+
                          +--------------------+             |
                                                             | Sync Worker (Exponential Backoff)
                                                             v
                                                   +--------------------+
                                                   | Google Sheets API  |
                                                   | (Secondary Backup) |
                                                   +--------------------+
```

---

## 📋 Feature Parity Matrix

| Feature | Legacy Apps Script (`D:\prime\eod and bod head`) | New Full-Stack Architecture | PostgreSQL Table | Status |
|---|---|---|---|---|
| **Admin Login** | `verifyAdmin(code)` | `POST /api/auth/admin/login` | `admin_users`, `audit_logs` | ✅ Fully Implemented |
| **Organization Score** | `fetchAdminDashboard` (in-memory sheet loops) | `GET /api/admin/dashboard` | `daily_reports`, `employees` | ✅ Fully Implemented |
| **Top & Bottom Employees** | In-memory slice(-5)/slice(0,5) | `GET /api/admin/dashboard` | `daily_reports`, `employees` | ✅ Fully Implemented |
| **Top & Bottom Heads** | In-memory sort on active departments | `GET /api/admin/dashboard` | `departments`, `head_ratings` | ✅ Fully Implemented |
| **Department Grid** | In-memory grid with color codes | `GET /api/admin/dashboard` | `departments`, `daily_reports` | ✅ Fully Implemented |
| **Department Scrutiny** | `fetchDepartmentDetails(dept, filter)` | `GET /api/admin/departments/:dept/scrutiny` | `daily_reports`, `employees`, `head_ratings` | ✅ Fully Implemented |
| **Super Admin Head Rating** | `saveSuperAdminRating` (direct Sheets edit) | `PUT /api/admin/departments/:dept/head-rating` | `head_ratings`, `sync_jobs` | ✅ Fully Implemented |
| **BOD / EOD Task Viewer** | `viewRawData(bodStr, eodStr)` | `RawTaskReportModal.tsx` | `daily_reports` (`bodData`, `eodData` JSONB) | ✅ Fully Implemented |
| **Date Range Filters** | Daily, Weekly, Monthly, Custom | Server-side `calculateDateRange` | Index on `dateTimestamp` | ✅ Fully Implemented |
| **PDF Download** | `downloadDashboardPDF()` via html2pdf | `exportDashboardToPDF()` | Frontend Client | ✅ Fully Implemented |
| **Google Sheets Sync** | Direct Sheet calls from browser | Background Worker + Outbox table | `sync_jobs` | ✅ Fully Implemented |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker** (optional, for local PostgreSQL): Docker Desktop

### 2. Start PostgreSQL via Docker (or use your local/cloud PostgreSQL)
```bash
docker compose up -d
```

### 3. Install Dependencies
```bash
# Install Server dependencies
cd server
npm.cmd install

# Install Client dependencies
cd ../client
npm.cmd install
```

### 4. Database Setup & Seeding
```bash
cd ../server

# Generate Prisma client
npx.cmd prisma generate

# Push database schema to PostgreSQL
npx.cmd prisma db push

# Seed realistic initial data (Departments, Employees, Reports, Admin)
npm.cmd run seed
```

### 5. Start Development Servers
```bash
# Terminal 1: Start Backend API (Port 5000)
cd server
npm.cmd run dev

# Terminal 2: Start React Frontend (Port 5173)
cd client
npm.cmd run dev
```

Open **`http://localhost:5173`** in your browser.

**Super Admin Access Code:** `TPC-SUPER-2026`

---

## 🔄 Google Sheets Migration & Synchronization

### 1. Import Live Data from Google Sheets
```bash
cd server
npm.cmd run migrate:sheets
```
This script reads Master DB (`MASTER_DB_SPREADSHEET_ID`) and App DB (`APP_DB_SPREADSHEET_ID`), normalizes data, validates foreign keys, and imports all historical records into PostgreSQL while generating an audit report in `server/logs/`.

### 2. Trigger Manual Google Sheets Outbox Sync
```bash
cd server
npm.cmd run sync:google-sheets
```

---

## 🧪 Running Automated Tests

```bash
cd server
npm.cmd test
```
Tests cover:
- Scoring engine calculations (`parseScoreHelper`, 24-hr auto-approval rule, multiplier math, org averages).
- Date utilities & range filters.
- API authentication and health endpoints.

---

## ☁️ Deploying on Render (Web Service)

This repository includes a pre-configured [`render.yaml`](render.yaml) blueprint and unified production scripts to deploy both the Express backend and React frontend as a single, high-performance web service on Render.

### Option 1: 1-Click Blueprint Deploy
1. In your **Render Dashboard**, click **New +** > **Blueprint**.
2. Connect the GitHub repository: `https://github.com/Happybhai329/operations-head-eod-bod-application`.
3. Render will read `render.yaml` and configure the web service automatically.
4. Fill in the required secret environment variables (`DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CREDENTIALS_JSON`).
5. Click **Apply** to deploy!

### Option 2: Standard Web Service Setup
1. In **Render Dashboard**, click **New +** > **Web Service**.
2. Connect repository: `Happybhai329/operations-head-eod-bod-application`.
3. Configure the following settings:
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm run render-build`
   - **Start Command**: `npm run render-start`
   - **Health Check Path**: `/health`
4. Add the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `CORS_ORIGIN`: `*`
   - `DATABASE_URL`: *(Your Supabase PostgreSQL IPv4 Pooler URL)*
   - `DIRECT_URL`: *(Your Supabase PostgreSQL Direct URL)*
   - `SUPER_ADMIN_CODE`: `TPC-SUPER-2026`
   - `SUPER_ADMIN_USERNAME`: `superadmin`
   - `JWT_SECRET`: *(A random 32+ character secret)*
   - `JWT_EXPIRES_IN`: `7d`
   - `MASTER_DB_SPREADSHEET_ID`: `1AxdiOpaij8Lnx0TV5iMhgVlADfN0LeXzwOdmbzmrlGA`
   - `APP_DB_SPREADSHEET_ID`: `1IFGc0kvv9LpbZUfEGroY8PevevJ8axdPApVrLjidlw8`
   - `GOOGLE_CREDENTIALS_JSON`: *(Optional - contents of your GCP Service Account JSON key)*
   - `SYNC_WORKER_ENABLED`: `true`
5. Click **Deploy Web Service**. Once the build finishes, you can access your dashboard via your live `https://[your-service-name].onrender.com` link.

