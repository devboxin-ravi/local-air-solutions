# Local Air Solutions — Monorepo

| App | Path | Run |
|---|---|---|
| REST API (Node, Express, Prisma, MySQL 8) | `backend-node/` | `npm run dev` → http://localhost:8000 (Swagger: `/api/docs`) |
| Admin web panel (React + Vite) | `admin-react/` | `npm run dev` → http://localhost:5173 |
| Customer & technician app (Flutter, role-based) | `app-flutter/` | `flutter run` |

Quick start, production deployment and security checklist: [`../docs/DEPLOYMENT_GUIDE.md`](../docs/DEPLOYMENT_GUIDE.md).
Status and blocked integrations: [`../DEVELOPMENT_STATUS.md`](../DEVELOPMENT_STATUS.md).
API reference: [`../docs/API_DOCUMENTATION.md`](../docs/API_DOCUMENTATION.md) · Schema: [`../docs/DATABASE_SCHEMA.md`](../docs/DATABASE_SCHEMA.md).

Each app keeps its own `.env` (never committed) created from `.env.example`.
