# DGMinutes

DGMinutes is a web application for interpreter minute tracking, with authentication, role-based dashboards, record submission, and screenshot analysis powered by Gemini.

The project is split into two independently deployable services:

- **`/frontend`** — React + Vite + Tailwind UI (browser).
- **`/backend`** — Express API server (Node.js) backed by **PostgreSQL**.

```
Browser ──► Frontend (Vite) ──► Backend API (Express) ──► PostgreSQL
```

The frontend never talks to the database directly. All data access goes through the backend.

## Features

| Feature | Description |
|---|---|
| Authentication | Register and log in as interpreter or master |
| Interpreter dashboard | Upload a screenshot, extract values with Gemini, review them, and submit records |
| Master dashboard | Review interpreters, records, totals, and breakdowns |
| Record storage | PostgreSQL persistence via `DATABASE_URL` |
| Date-range mismatch detection | Warns when a record type doesn't match the date range span |

## Project structure

```
.
├── backend/                   Node.js + Express + pg API server
│   ├── src/
│   │   ├── server.ts          Express app and all /api routes
│   │   └── db.ts              PostgreSQL pool + schema bootstrap
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.json
│   └── .env.example
└── frontend/                  React + Vite SPA
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css
    │   ├── contexts/AuthContext.tsx
    │   ├── lib/api.ts         apiFetch helper using VITE_API_URL
    │   ├── lib/dateRangeMismatch.ts
    │   ├── lib/utils.ts
    │   └── pages/             Login, Register, Interpreter & Master dashboards
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── railway.json
    └── .env.example
```

## Local development

You need PostgreSQL running locally (or any reachable Postgres instance).

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET, GEMINI_API_KEY
npm install
npm run dev
```

The API runs on `http://localhost:3000`. Health check: `GET /api/health`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# .env should contain: VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

The UI runs on `http://localhost:5173`.

## Environment variables

### Backend (`/backend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. On Railway, reference the Postgres plugin: `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | **Yes** | Long random secret used to sign authentication tokens |
| `GEMINI_API_KEY` | Yes (for image analysis) | Google Gemini API key |
| `PORT` | No | Defaults to `3000`. Railway sets it automatically. |
| `CORS_ORIGIN` | Recommended | Public URL of the frontend service (or comma-separated list). Defaults to `*`. |
| `NODE_ENV` | No | Set to `production` on Railway. |

### Frontend (`/frontend/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_URL` | **Yes** | Public URL of the backend service. Locally `http://localhost:3000`, in production the Railway public URL. |

## Railway deployment

You will create **three** services in a single Railway project:

1. **PostgreSQL** (Railway plugin)
2. **Backend** (Node service from this repo, root `/backend`)
3. **Frontend** (Node service from this repo, root `/frontend`)

### Step 1 — Add the PostgreSQL plugin

In your Railway project, click **+ New → Database → Add PostgreSQL**.
Railway will expose it as `${{Postgres.DATABASE_URL}}` to other services.

### Step 2 — Deploy the backend

Create a new service from this GitHub repo and configure:

| Setting | Value |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` (Nixpacks default — leave blank if Railway auto-detects) |
| **Start Command** | `npm start` |
| **Healthcheck Path** | `/api/health` |

**Required environment variables** (Service → Variables):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference syntax) |
| `JWT_SECRET` | Any long random string (e.g. `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `CORS_ORIGIN` | The public URL of the frontend service (set after step 3) |
| `NODE_ENV` | `production` |

After the backend deploys, click **Settings → Networking → Generate Domain** to get its public URL. You'll need it for the frontend.

### Step 3 — Deploy the frontend

Create another service from the same repo and configure:

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run preview` |

**Required environment variables**:

| Variable | Value |
|---|---|
| `VITE_API_URL` | The public URL of the backend service from Step 2 (e.g. `https://dgminutes-backend.up.railway.app`) |

> **Note:** Vite inlines `VITE_*` variables at build time. If you change `VITE_API_URL` later, you must redeploy the frontend so the new value gets baked into the bundle.

Click **Settings → Networking → Generate Domain** to get the frontend's public URL, then go back to the **backend** service and set:

```
CORS_ORIGIN=https://<your-frontend-domain>.up.railway.app
```

Redeploy the backend.

### Final checks

1. Visit the frontend URL — you should see the login page.
2. Open the browser's network tab — API calls should target the backend domain, not `localhost`.
3. Hit `<backend-url>/api/health` — should return `{ "ok": true, "databaseConfigured": true, ... }`.
4. Register the first user (interpreter or master) and confirm it persists across redeploys.

## Scripts reference

### Backend (`/backend`)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start API in watch mode (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled production server |
| `npm run lint` | TypeScript type checking |

### Frontend (`/frontend`)

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build production bundle to `dist/` |
| `npm run preview` | Serve the built bundle (used by Railway) |
| `npm run lint` | TypeScript type checking |

## Production notes

- The Gemini API key lives only on the backend. The frontend never sees it.
- The frontend uses the `apiFetch` helper in `frontend/src/lib/api.ts` which prefixes every request with `VITE_API_URL`. Avoid hardcoding `localhost` anywhere.
- Database schema is created automatically by `initializeSchema()` on first boot. No manual migration step is needed for the current schema.
