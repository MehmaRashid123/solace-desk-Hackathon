# Solace

**AI-assisted real-time support desk** — customers open tickets, choose workers, chat live, and leave reviews. Workers accept bookings, triage with AI, and resolve. Admins oversee the full queue and worker performance.

## Live demo

- **App:** https://solace-desk-hackathon.vercel.app *(or your Vercel URL)*
- **API:** https://solace-desk-hackathon.onrender.com/health
- **Demo login:** Sign-in page one-click chips · password `password123`

> **For evaluators:** Everything below is written step-by-step so you can run and review the project in under 10 minutes. Demo accounts are pre-loaded and available as **one-click buttons on the sign-in page** — no need to copy-paste credentials.

---

## Table of contents

1. [What you are reviewing](#what-you-are-reviewing)
2. [Prerequisites](#prerequisites)
3. [Setup (step by step)](#setup-step-by-step)
4. [Verify the app is running](#verify-the-app-is-running)
5. [Demo credentials](#demo-credentials)
6. [Suggested demo walkthrough](#suggested-demo-walkthrough)
7. [Tech stack](#tech-stack)
8. [Project structure](#project-structure)
9. [Available scripts](#available-scripts)
10. [Environment variables](#environment-variables)
11. [Troubleshooting](#troubleshooting)
12. [Deployment notes](#deployment-notes)

---

## What you are reviewing

| Area | Highlights |
| --- | --- |
| **Customer** | Register/login, dashboard, create tickets, pick a worker (with ratings), live chat, ticket timeline, post-completion review |
| **Worker** | Incoming booking accept/reject, assigned tickets, AI triage review, status updates, resolution notes, real-time notifications |
| **Admin** | Separate admin dashboard, customer query overview, worker list + detail (stats, reviews, assigned tickets) |
| **Real-time, Email & Queue** | Socket.IO (live chat & status) + Nodemailer emails + Resilient Background Job Queue |
| **Performance & APIs** | Redis caching (with in-memory fallback) + REST & GraphQL (`/graphql`) endpoints |
| **AI** | Server-side triage (category, priority, summary). Keys optional — keyword fallback if none set |
| **Quality** | Role guards, JWT + refresh cookie, Zod validation, 29 API tests (Vitest) |

Full technical reference: **[PROJECT.md](./PROJECT.md)**

---

## Prerequisites

Install these before starting:

| Tool | Version | Why |
| --- | --- | --- |
| **Node.js** | 20 or newer | Runs client + server |
| **npm** | 10+ (bundled with Node) | Monorepo workspaces |
| **Docker Desktop** | Latest | PostgreSQL database (port **5433**) |

> If you already run PostgreSQL on port `5432`, that is fine — this project uses **5433** via Docker to avoid conflicts.

---

## Setup (step by step)

Open a terminal in the project root (`Hackathon 2026/`).

### Step 1 — Copy environment files

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

These defaults work out of the box for local development. AI keys are optional.

### Step 2 — Start the database

```bash
npm run db:up
```

Wait until Docker reports the `lumen-postgres` container as healthy (~10 seconds).

### Step 3 — Install dependencies

```bash
npm install
```

This installs both `/client` and `/server` via npm workspaces.

### Step 4 — Run database migrations

```bash
npm run db:migrate
```

Creates all tables in PostgreSQL via Prisma.

### Step 5 — Seed demo data

```bash
npm run seed
```

Loads 5 demo users, 4 sample tickets, messages, and worker ratings. Safe to re-run — it resets demo data cleanly.

### Step 6 — Start the app

```bash
npm run dev
```

Starts **API on port 4000** and **client on port 3000** concurrently.

### Step 7 — Open in browser

Go to: **http://localhost:3000**

You should see the Solace landing page. Click **Sign in** to continue.

---

## Verify the app is running

| Check | URL / command | Expected |
| --- | --- | --- |
| Frontend | http://localhost:3000 | Landing page loads |
| Sign-in | http://localhost:3000/login | Login form + demo account chips |
| API health | http://localhost:4000/health | `{ "ok": true }` |
| Tests | `npm test` | 16 tests pass |

---

## Demo credentials

**Password for every account:** `password123`

| Role | Name | Email |
| --- | --- | --- |
| Customer | Ava Patel | `ava@lumen.dev` |
| Customer | Noah Kim | `noah@lumen.dev` |
| Worker | Maya Okonkwo | `maya@lumen.dev` |
| Worker | Leo Hart | `leo@lumen.dev` |
| Admin | Aria Chen | `admin@lumen.dev` |

### Built into the sign-in page (for checker convenience)

On **http://localhost:3000/login**, demo accounts appear as clickable chips under three groups — **Customers**, **Workers**, and **Admin**. Click any chip and the email + password fields fill automatically (`password123` is pre-filled). Then press **Sign in**.

This was added specifically so evaluators can switch roles instantly without looking up credentials in this file.

---

## Suggested demo walkthrough

Follow this order to see the full flow in ~5 minutes.

### 1. Customer — open a ticket

1. Sign in as **Ava · customer** (one click on login page).
2. Go to **New Ticket** → fill subject + description → submit.
3. On the ticket detail page, pick a **worker** from the selection panel (ratings shown).
4. Send a message in the conversation thread.

### 2. Worker — accept and resolve

1. Sign out → sign in as **Maya · worker** (or Leo, depending on who was selected).
2. **Dashboard** → **Incoming bookings** → accept with urgency.
3. Open the ticket → review AI triage → approve category/priority.
4. **Start work** → add resolution note → **Mark completed**.

### 3. Customer — rate the worker

1. Sign in again as **Ava · customer**.
2. Open the completed ticket → submit a star rating + comment.
3. Rating appears on the worker profile.

### 4. Admin — overview

1. Sign in as **Admin**.
2. **Overview** — see all customer queries and summary stats.
3. **Workers** — click a worker card → profile, reviews, assigned tickets.

### 5. Real-time (optional, two browser windows)

1. Open ticket detail as customer in one window.
2. Open the same ticket as worker in another window (or incognito).
3. Send messages — they appear instantly without refresh.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS |
| State | React Context (auth, socket, notices) — no Redux |
| Backend | Express 5 · TypeScript · Zod validation |
| Database | PostgreSQL 16 · Prisma ORM |
| Auth | JWT access token + httpOnly refresh cookie · bcrypt |
| Real-time | Socket.IO (`/tickets` namespace) |
| AI | OpenAI / Anthropic (server-only, 8s timeout, keyword fallback) |
| Tests | Vitest + Supertest (server) |
| Deploy | Docker Compose (db + api + client) |

---

## Project structure

```
Hackathon 2026/
├── client/                 Next.js frontend
│   ├── app/                Routes (customer/, worker/, admin/, login)
│   ├── components/         UI, cards, panels
│   ├── context/            Auth, Socket, Toast, Notice
│   ├── lib/                API client, routes, helpers
│   └── views/              Page-level view components
├── server/                 Express API
│   ├── prisma/             Schema, migrations, seed
│   ├── src/routes/         REST endpoints
│   ├── src/services/       Business logic + AI
│   └── test/               API tests
├── docker-compose.yml      Postgres + optional full stack
├── README.md               Setup & demo guide (this file)
└── PROJECT.md              Technical reference for developers
```

---

## Available scripts

Run from the **repo root**:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start client (3000) + server (4000) |
| `npm run dev:client` | Client only |
| `npm run dev:server` | Server only |
| `npm run db:up` | Start Postgres container |
| `npm run db:down` | Stop containers |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run seed` | Reset + load demo data |
| `npm run db:reset` | Drop DB, migrate, seed (full reset) |
| `npm test` | Run server API tests |
| `npm run build` | Production build (client + server) |

---

## Environment variables

### Server — `server/.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection (default port 5433) |
| `JWT_ACCESS_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `CLIENT_ORIGIN` | CORS origin (`http://localhost:3000`) |
| `PORT` | API port (default `4000`) |
| `OPENAI_API_KEY` | Optional — enables OpenAI triage |
| `ANTHROPIC_API_KEY` | Optional — enables Anthropic triage |

### Client — `client/.env.local`

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend URL (`http://localhost:4000`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO URL (`http://localhost:4000`) |

Never commit `.env` or `.env.local`. Example files are provided.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `ECONNREFUSED` on API calls | Ensure `npm run dev` is running and port 4000 is free |
| Database connection failed | Run `npm run db:up` and confirm Docker is running |
| Port 5433 in use | Stop other Postgres instances or change port in `docker-compose.yml` + `DATABASE_URL` |
| Login fails after changes | Run `npm run seed` to restore demo users |
| Blank page / stale UI | Hard refresh (`Ctrl+Shift+R`). Do not run `npm run build` while `dev` is active |
| AI features empty | Normal without API keys — keyword fallback still categorizes tickets |

---

## Deployment notes

**Docker (full stack locally):**

```bash
docker compose up --build
```

**Split deploy (production):**

| Service | Platform | Root | Notes |
| --- | --- | --- | --- |
| Frontend | Vercel | `client/` | Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` |
| Backend | Render / Railway | `server/` | Run `npx prisma migrate deploy && npm start` |
| Database | Neon / Railway | — | Set `DATABASE_URL` + `CLIENT_ORIGIN` on server |

---

**Questions?** See [PROJECT.md](./PROJECT.md) for routes, API shape, ticket workflow, and socket events.
