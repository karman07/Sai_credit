# Insurance CRM — Admin + Sales Portals

Operational CRM for an insurance brokerage: customers, vehicles, policies,
renewals, follow-ups, documents. Two web apps (Admin/Operations + Sales),
one API, email+password auth, role-based access.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| API | **NestJS 11** (Express) | Guards = RBAC, Interceptors = audit/envelope |
| DB | **MongoDB + Mongoose** | Single `masters` collection for all 13 lookups |
| Auth | JWT access + JWT refresh w/ rotation | bcrypt(12), session collection w/ TTL |
| Validation | **Zod** | One schema = DTO type + runtime validation |
| Admin app | **Next.js 16** (App Router, React 19) | `admin/` — port 3000/3001 |
| Sales app | **Next.js 16** | `frontend/` — scaffold |
| Styling | **Tailwind v4** | Warm-neutral light + deep-slate dark, class toggle |

> **DB note:** The original design proposed PostgreSQL; this build uses
> **MongoDB** per project direction. The relational model maps to documents
> with `ObjectId` references and a unified master-data collection.

## Run it

```bash
# 1. MongoDB (any local instance on :27017)
mongod --dbpath /tmp/mongo-crm --port 27017

# 2. API
cd backend
cp .env.example .env          # adjust secrets for prod
npm install
npm run seed                  # master data + bootstrap owner
npm run build && npm run start:prod   # or: npm run start:dev
# → http://localhost:4000/api/v1   (health: /api/v1/health)

# 3. Admin portal
cd ../admin
npm install
npm run dev                   # → http://localhost:3000 (or 3001 if taken)
```

**Bootstrap login:** `admin@insurancecrm.local` / `Admin@12345`
(override via `BOOTSTRAP_ADMIN_*` in `backend/.env`).

## What's implemented (verified end-to-end)

**Backend**
- `POST /auth/login|refresh|logout|forgot-password|reset-password`, `GET /auth/me`
  — portal access checks, refresh-token rotation, max-3-sessions eviction.
- **RBAC** — global `JwtAuthGuard` + `PermissionsGuard`; per-role permission
  matrix in [`backend/src/rbac/permissions.ts`](backend/src/rbac/permissions.ts).
- **Scope injection** — sales roles are restricted to their own records in the
  service layer ([`customers.service.ts`](backend/src/customers/customers.service.ts)),
  not bypassable from any route.
- **Customers** — scoped CRUD, text search, pagination, auto code `CUS-2026-00001`,
  soft-delete, reassign.
- **Users** — admin CRUD, toggle status, force password reset.
- **Masters** — uniform CRUD for all 13 lookups via `/master/:resource`.
- **Audit** — every mutation writes a field-level diff to `audit_logs`.
- Response envelope `{ success, data, meta }` + normalized error shape.

**Admin frontend**
- Design system (tokens, Button/Input/Card/Badge), light/dark toggle (no-flash).
- Login + forgot-password (live against API), transparent token refresh.
- Authenticated shell: sidebar + topbar + route guard.
- Dashboard (live customer count + renewal-pipeline stages).
- Customers list: live, debounced search, pagination, create drawer.

## Remaining (designed, not yet built)

Vehicles · Policies (premium breakdown, endorsements) · Renewals pipeline
(Kanban, auto-creation on policy save) · Follow-ups · Documents (R2 presigned
uploads) · Reports · Notifications + reminder jobs · Sales portal screens
(`frontend/`). Schemas/enums and the API route plan for these are already
specified; build order is Phase 2→4 in the system design.

## Project layout

```
backend/   NestJS API
  src/auth        login/refresh/reset, sessions
  src/rbac        permission matrix + guards
  src/common      enums, audit, counter, pipes, decorators, filters
  src/masters     unified master-data CRUD
  src/users       user management
  src/customers   scoped customer CRUD
admin/     Next.js Admin portal (lib/ = api+auth+theme, components/, app/)
frontend/  Next.js Sales portal (scaffold)
```
