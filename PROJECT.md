# Solace — Project Reference

Technical documentation for developers, evaluators, and future contributors.  
For quick setup and demo walkthrough, start with **[README.md](./README.md)**.

---

## Table of contents

1. [Product overview](#product-overview)
2. [Architecture](#architecture)
3. [Repository layout](#repository-layout)
4. [Roles & terminology](#roles--terminology)
5. [Feature checklist](#feature-checklist)
6. [Ticket lifecycle](#ticket-lifecycle)
7. [Routes (frontend)](#routes-frontend)
8. [API reference](#api-reference)
9. [Real-time (Socket.IO)](#real-time-socketio)
10. [AI triage](#ai-triage)
11. [Authentication](#authentication)
12. [Database & seed data](#database--seed-data)
13. [Environment variables](#environment-variables)
14. [Scripts & commands](#scripts--commands)
15. [Testing](#testing)
16. [Design system](#design-system)
17. [Contributor rules](#contributor-rules)

---

## Product overview

**Solace** is an AI-assisted customer support desk with a worker-booking flow.

- **Customers** create tickets, select a worker (with ratings), chat in real time, and rate service after completion.
- **Workers** (DB role: `AGENT`) receive booking requests, accept/reject, triage with AI, update status, and resolve with a mandatory resolution note.
- **Admins** have a separate dashboard — overview of all queries, worker management, profiles, reviews, and assigned tickets.

**App name (UI):** Solace (`client/lib/brand.ts`)  
**Monorepo name:** `lumen-desk` (npm workspaces)

---

## Architecture

```
┌─────────────────┐     REST + JWT      ┌─────────────────┐
│  Next.js Client │ ◄──────────────────► │  Express API    │
│  localhost:3000 │     Socket.IO       │  localhost:4000 │
└─────────────────┘ ◄──────────────────► └────────┬────────┘
                                                    │
                                                    │ Prisma
                                                    ▼
                                           ┌─────────────────┐
                                           │  PostgreSQL 16  │
                                           │  localhost:5433 │
                                           └─────────────────┘
```

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15 · React 19 · TypeScript · Tailwind CSS 3 · lucide-react |
| Backend | Express 5 · TypeScript (ESM) · Zod · Helmet · rate limiting |
| ORM | Prisma 6 |
| Real-time | Socket.IO (server + client) |
| AI | OpenAI + Anthropic (`server/src/services/ai.ts`) — server-only |
| Auth | JWT access + httpOnly `lumen_refresh` cookie · bcrypt |
| Tests | Vitest + Supertest |

All API responses use: `{ success: boolean, data?: T, error?: string }`

---

## Repository layout

```
/client
  app/                    Next.js App Router pages
    customer/             Customer dashboard, tickets, profile
    worker/               Worker dashboard, tickets, bookings, profile
    admin/                Admin overview, workers, profile
    login/                Sign-in (+ demo account chips for evaluators)
    register/             Registration
    page.tsx              Public landing
  components/             Reusable UI (cards, panels, timeline, etc.)
  context/                AuthContext, SocketContext, NoticeContext, ToastContext
  lib/                    api.ts, routes.ts, nav.ts, mergeTicket.ts, types
  views/                  Page-level view components

/server
  prisma/
    schema.prisma         Models + enums
    migrations/           Versioned SQL
    seed.ts               Demo users + 4 tickets
  src/
    routes/               auth, tickets, workers, admin, stats, users
    services/             tickets, ratings, ai, admin, auth
    lib/                  io.ts (socket emits), prisma, jwt
  test/                   API integration tests

docker-compose.yml        db (5433) + optional server + client
README.md                 Setup guide for evaluators
PROJECT.md                This file
```

---

## Roles & terminology

| Database enum | UI label | Description |
| --- | --- | --- |
| `CUSTOMER` | Customer | Creates tickets, selects workers, chats, rates |
| `AGENT` | Worker | Accepts bookings, triages, resolves — **do not rename DB enum** |
| `ADMIN` | Admin | Full overview, worker management — separate from worker UI |

### Demo accounts (seed)

Password for all: **`password123`**

| Role | Email | Name |
| --- | --- | --- |
| Customer | `ava@lumen.dev` | Ava Patel |
| Customer | `noah@lumen.dev` | Noah Kim |
| Worker | `maya@lumen.dev` | Maya Okonkwo |
| Worker | `leo@lumen.dev` | Leo Hart |
| Admin | `admin@lumen.dev` | Aria Chen |

**Evaluator shortcut:** On `/login`, clickable chips under Customers / Workers / Admin auto-fill email and password — built for checker convenience.

---

## Feature checklist

### Customer

- [x] Register and login
- [x] Dashboard (open / in-progress / completed counts, recent tickets, rating prompt)
- [x] Create new ticket (AI triage on submit)
- [x] View own tickets with status filters
- [x] Ticket detail — timeline, conversation, AI summary
- [x] Worker selection panel (when `New` + unassigned) with ratings/reviews
- [x] Live messaging + typing indicator
- [x] Post-completion worker rating (stars + comment, optional AI draft)
- [x] Profile page

### Worker

- [x] Login and worker dashboard
- [x] Incoming booking requests — accept (with urgency) / reject (with reason)
- [x] Assigned tickets list with filters
- [x] Ticket detail — AI review card (approve/edit category, priority, summary)
- [x] Status transitions (Accepted → In Progress → Completed)
- [x] Resolution note required before complete
- [x] AI draft resolution
- [x] Real-time booking notifications
- [x] Profile page (ratings, reviews)

### Admin

- [x] Separate admin layout (not mixed with worker UI)
- [x] Overview dashboard — customer queries + summary stats
- [x] Workers list — clickable cards
- [x] Worker detail — profile, stats, reviews, assigned tickets
- [x] Profile page

### Platform

- [x] JWT auth + refresh cookie + role guards
- [x] Socket.IO real-time (messages, status, bookings, typing)
- [x] AI triage with timeout + keyword fallback
- [x] Targeted notifications (role-specific socket events)
- [x] API tests (16 passing)
- [x] Docker Compose for Postgres + full stack
- [x] Demo seed data
- [x] Sign-in page demo account chips for evaluators

---

## Ticket lifecycle

### Status flow

```
New
  └─► PendingWorkerResponse   (customer selected a worker)
        ├─► Accepted          (worker accepted)
        │     └─► InProgress  (worker started)
        │           └─► Completed  (requires resolutionNote)
        ├─► Rejected          (worker declined)
        └─► Cancelled
```

Illegal transitions return **409 Conflict**.

### Key rules

- AI writes **raw** fields only: `aiCategory`, `aiPriority`, `aiSummary`
- Official `category` / `priority` set after worker **AI review** (`PATCH /api/tickets/:id/ai-review`)
- Customer selects worker via `PATCH /api/tickets/:id/select-worker`
- Worker responds via `PATCH /api/tickets/:id/respond` (accept + urgency / reject + reason)
- Completion creates an automatic message to the customer + enables rating form
- `mergeTicketUpdate()` on client prevents socket/API from reverting status or clearing submitted reviews

---

## Routes (frontend)

### Public

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/login` | Sign in (+ demo account chips) |
| `/register` | Create account |

### Customer

| Path | Page |
| --- | --- |
| `/customer/dashboard` | Dashboard |
| `/customer/tickets` | My tickets |
| `/customer/tickets/new` | Create ticket |
| `/customer/tickets/[id]` | Ticket detail |
| `/customer/profile` | Profile |

### Worker

| Path | Page |
| --- | --- |
| `/worker/dashboard` | Dashboard (bookings + active tickets) |
| `/worker/tickets` | Assigned tickets |
| `/worker/tickets/[id]` | Ticket detail |
| `/worker/bookings` | Incoming bookings |
| `/worker/profile` | Profile |

### Admin

| Path | Page |
| --- | --- |
| `/admin/dashboard` | Overview |
| `/admin/workers` | Worker list |
| `/admin/workers/[id]` | Worker detail |
| `/admin/profile` | Profile |

---

## API reference

Base URL: `http://localhost:4000/api`

### Auth — `/api/auth`

| Method | Path | Access |
| --- | --- | --- |
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/refresh` | Cookie |
| POST | `/logout` | Cookie |

### Tickets — `/api/tickets`

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/mine` | Customer / Worker | Own tickets |
| GET | `/` | Worker / Admin | Desk queue |
| POST | `/` | Customer | Create + AI triage |
| GET | `/:id` | Owner / assigned / admin | Ticket + messages |
| POST | `/:id/messages` | Participants | Send message |
| PATCH | `/:id/select-worker` | Customer | Pick worker |
| PATCH | `/:id/respond` | Worker | Accept or reject booking |
| PATCH | `/:id/assign` | Worker | Claim unassigned |
| PATCH | `/:id/status` | Worker | Status transition |
| PATCH | `/:id/ai-review` | Worker | Approve AI triage |
| POST | `/:id/ai-rating-draft` | Customer | AI-suggested review text |
| POST | `/:id/rating` | Customer | Submit worker rating |

### Workers — `/api/workers`

| Method | Path | Access |
| --- | --- | --- |
| GET | `/` | Customer / Admin | List with ratings |

### Admin — `/api/admin`

| Method | Path | Access |
| --- | --- | --- |
| GET | `/overview` | Admin |
| GET | `/workers` | Admin |
| GET | `/workers/:id` | Admin |

### Other

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/stats` | Authenticated (role-scoped) |
| GET | `/api/users/me` | Authenticated |
| GET | `/health` | Public |

### HTTP status codes

| Code | When |
| --- | --- |
| 200 / 201 | Success |
| 400 | Validation error |
| 401 | Missing / invalid token |
| 403 | Wrong role |
| 404 | Not found / hidden |
| 409 | Illegal status transition |
| 429 | Rate limit (login/register) |
| 500 | Server error (safe message only) |

---

## Real-time (Socket.IO)

Namespace: `/tickets`

### Rooms

| Room | Who joins |
| --- | --- |
| `ticket:<id>` | Users viewing that ticket |
| `agent:dashboard` | Workers + admin on dashboard |

### Events (server → client)

| Event | Purpose |
| --- | --- |
| `message:new` | New chat message |
| `ticket:statusChanged` | Status update |
| `ticket:assigned` | Worker assigned |
| `worker:newBooking` | Booking request for specific worker |
| `admin:workerSelected` | Customer picked a worker |
| `typing` | Typing indicator |

---

## AI triage

- Location: `server/src/services/ai.ts`
- Providers: OpenAI (`OPENAI_API_KEY`) and/or Anthropic (`ANTHROPIC_API_KEY`)
- Timeout: `AI_TIMEOUT_MS` (default 8000ms)
- **No keys?** Keyword-based fallback still assigns category/priority
- Keys never exposed to client
- Used on: ticket creation, resolution draft, rating draft

---

## Authentication

- **Access token:** JWT in memory (client `AuthContext`)
- **Refresh token:** httpOnly cookie `lumen_refresh`
- **Passwords:** bcrypt (cost 12 in seed)
- **Guards:** `requireAuth`, `requireRole` on protected routes
- **Rate limit:** Login and register endpoints

---

## Database & seed data

- **Engine:** PostgreSQL 16 (Docker, port 5433)
- **ORM:** Prisma 6
- **Reset demo data:** `npm run seed` (deletes + re-creates users/tickets)

### Seed includes

- 5 users (2 customers, 2 workers, 1 admin)
- 4 tickets in various statuses (New, PendingWorkerResponse, InProgress, Completed)
- Sample messages and events
- Worker ratings on profiles

---

## Environment variables

### Server (`server/.env`)

Copy from `server/.env.example`:

```
DATABASE_URL          PostgreSQL connection string
JWT_ACCESS_SECRET     Min 32 chars
JWT_REFRESH_SECRET    Min 32 chars
ACCESS_TOKEN_TTL      Default 15m
REFRESH_TOKEN_TTL     Default 7d
CLIENT_ORIGIN         http://localhost:3000
PORT                  4000
OPENAI_API_KEY        Optional
ANTHROPIC_API_KEY     Optional
AI_TIMEOUT_MS         8000
```

### Client (`client/.env.local`)

Copy from `client/.env.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

---

## Scripts & commands

| Command | Description |
| --- | --- |
| `npm run dev` | Client + server concurrently |
| `npm run dev:client` | Next.js only |
| `npm run dev:server` | Express only |
| `npm run db:up` | Start Postgres container |
| `npm run db:down` | Stop containers |
| `npm run db:migrate` | Apply migrations |
| `npm run seed` | Seed demo data |
| `npm run db:reset` | Full DB reset + migrate + seed |
| `npm test` | Run Vitest suite |
| `npm run build` | Production build |
| `docker compose up --build` | Full stack in Docker |

---

## Testing

```bash
npm test
```

- **Framework:** Vitest + Supertest
- **Location:** `server/test/`
- **Coverage:** Auth, tickets, status transitions, role guards, AI review
- **Expected:** 16 tests pass

---

## Design system

| Token | Value |
| --- | --- |
| Background | `#0A0A0A` (ink) |
| Accent | `#FF5722` (warm orange) |
| Cards | Glass morphism (`Glass` component) |
| Nav | Pill-style tabs, mobile bottom nav |
| Typography | Semibold headings, muted secondary text |

Key components: `TopBar`, `Glass`, `StatCard`, `StatusBadge`, `PriorityChip`, `TicketTimeline`, `BookingRequestCard`, `WorkerSelectionPanel`, `WorkerRatingPanel`, `AiReviewCard`.

---

## Contributor rules

1. **Do not** rename `AGENT` in Prisma/API — use "Worker" in UI only.
2. **Do not** bypass backend rules (409 transitions, ownership checks, resolution note requirement, AI review separation).
3. **Do not** refactor unrelated files — minimal focused diffs.
4. **Ask before** Prisma migrations that alter seeded tables or enums.
5. **Never commit** `.env`, `.env.local`, or API keys.
6. Use existing API response helpers (`sendOk` / `sendFail`).
7. Git commits only when explicitly requested.

---

*Last updated: Aug 30, 2026*
