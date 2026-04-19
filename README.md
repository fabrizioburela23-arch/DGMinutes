# DGMinutes

DGMinutes is a web application for interpreter minute tracking, with authentication, role-based dashboards, record submission, and screenshot analysis powered by Gemini.

## Features

| Feature | Description |
|---|---|
| Authentication | Register and log in as interpreter or master |
| Interpreter dashboard | Upload a screenshot, extract values with Gemini, review them, and submit records |
| Master dashboard | Review interpreters, records, totals, and breakdowns |
| Record storage | SQLite-based persistence with configurable database path |
| Railway support | Production-ready start script, configurable port, and persistent database path |

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Create a local environment file if needed and configure the variables listed in `.env.example`.

## Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Server port. Defaults to `3000` |
| `JWT_SECRET` | Yes in production | Secret used to sign authentication tokens |
| `GEMINI_API_KEY` | Yes for image analysis | Gemini API key used by the backend image analysis endpoint |
| `DATABASE_PATH` | Recommended | Path to the SQLite database file |

## Railway deployment

To deploy correctly on Railway, configure the application with a persistent database path instead of relying on the container filesystem.

| Setting | Recommended value |
|---|---|
| Start command | `npm start` |
| Build command | `npm run build` |
| `JWT_SECRET` | A long random secret |
| `GEMINI_API_KEY` | Your Gemini API key |
| `DATABASE_PATH` | A file inside your mounted Railway volume, for example `/data/app.db` |

If you do not mount persistent storage, users and records stored in SQLite may be lost when the service is rebuilt or restarted.

## Production notes

The Gemini integration now runs on the backend through a protected API route, which means the API key is no longer exposed in the browser bundle. The interpreter can still upload an image from the dashboard, but the analysis is handled securely on the server.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server with Vite middleware |
| `npm run build` | Build frontend and backend for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run TypeScript type checking |
