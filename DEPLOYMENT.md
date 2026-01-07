Deployment Guide — Frontend (Vercel) and Backend (Render)

This document explains the CORS configuration and required environment variables for deploying the frontend to Vercel and the backend to Render.

1) Overview
- Frontend: the React app located at `spin-and-win/` (deploy to Vercel).
- Backend: the Express + Mongoose API located at `backend/` (deploy to Render or similar).

2) CORS (Cross-Origin Resource Sharing)
- Purpose: allow browser clients hosted on Vercel (frontend) to call the backend API on Render.
- Implementation: the backend already has `cors` middleware configured in `backend/server.js`. It reads `CORS_ORIGINS` (comma-separated list) from environment variables and falls back to defaults for local development.

What to set for production:
- On Render (backend service) set `CORS_ORIGINS` to include your Vercel domain and any other clients, for example:
  - `https://your-app.vercel.app,https://admin.yourdomain.com,http://localhost:3000`
- The backend allows preflight `OPTIONS` and sets `credentials: true`. If you are not using cookies/session auth, credentials are optional.
- The backend also allows common custom headers used by the app: `clientid`, `wheelid`, `routename`, `Authorization`, etc.

3) Environment variables (recommended)
- Backend (Render service environment variables):
  - `MONGO_URI` — MongoDB connection string (required). Example: `mongodb+srv://<user>:<pass>@cluster0.mongodb.net/spin-and-win` (use a secure user/password and IP/whitelist config).
  - `PORT` — optional (Render provides a port automatically, typically you can omit or set to `5000`).
  - `CORS_ORIGINS` — comma-separated allowed origins (see above).
  - `NODE_ENV` — `production` (Render will set this automatically).
  - Any other secrets used by your app (e.g., `JWT_SECRET`, `SESSION_SECRET`) — do NOT commit these to Git.

- Frontend (Vercel project environment variables):
  - `REACT_APP_API_URL` — full URL to your backend API, e.g. `https://your-backend.onrender.com`.
  - `NODE_ENV` — `production` (Vercel sets this automatically during build).

4) Vercel build-ci notes
- Vercel sets `CI=true` during the build. When `CI=true`, Create React App treats lint warnings (ESLint) as build errors. Fix all ESLint warnings in the codebase or adjust your app configuration before deploying.
- We resolved earlier ESLint issues; ensure any new warnings are fixed or the build will fail.

5) Example Render setup steps
- In Render dashboard, create a new Web Service from GitHub repo and branch `main`.
- Build Command: `cd backend && npm install && node server.js` (or use `npm start` if defined in `backend/package.json`).
- Start Command: `node server.js`
- Set environment variables in Render > Environment > Add:
  - `MONGO_URI` = (your Mongo URI)
  - `CORS_ORIGINS` = `https://your-app.vercel.app,http://localhost:3000`
  - (any other secrets)

6) Example Vercel setup steps
- Import the repository on Vercel and set the build root to the `spin-and-win` folder.
- Build command: `npm run build` (Vercel will run install then build automatically).
- Output directory: `build`
- Add project env var:
  - `REACT_APP_API_URL` = `https://your-backend.onrender.com`
- Deploy; if you see a build error about ESLint, fix warnings locally and push changes.

7) Troubleshooting checklist
- If the browser shows CORS errors:
  - Confirm the domain in the browser matches an entry in `CORS_ORIGINS`.
  - Check that `Access-Control-Allow-Origin` is returned by the backend (it will return the origin if allowed).
  - For credentialed requests (cookies/auth), ensure `credentials: 'include'` is used client-side and `credentials: true` is on the server.
- If Vercel build fails with `Treating warnings as errors because process.env.CI = true`:
  - Run `npm run build` locally (with `CI=true`), fix all ESLint warnings, push changes.
- Logs: use Render logs for backend and Vercel build logs for frontend to find runtime/build errors.

8) Security notes
- Do not store secrets in `.env` committed to the repo. Use Render/Vercel environment settings.
- Prefer using a dedicated MongoDB Atlas user with limited privileges for production.

9) Quick checklist before deploy
- Backend: `MONGO_URI` set in Render, `CORS_ORIGINS` includes Vercel domain.
- Frontend (Vercel): `REACT_APP_API_URL` points to backend URL.
- Ensure ESLint warnings fixed (build passes locally with `npm run build`).

If you want, I can:
- Add a small `backend/.env.example` and `spin-and-win/.env.example` files with placeholders.
- Add the above guidance into the repository `README.md` or a new `DEPLOYMENT.md` (already added).
- Programmatically add any missing CORS origins to `backend/.env` if you tell me your Vercel URL.

Tell me which of the above you'd like me to do next (add examples, set specific origin, or update any file).