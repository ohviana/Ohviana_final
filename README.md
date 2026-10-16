# Ohviana

Marketplace for dated trekking departures, plus commission-free direct booking links for organizers.
See [docs/RUNBOOK.md](docs/RUNBOOK.md) to run and test everything, [docs/PHASES.md](docs/PHASES.md) for the delivery plan and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to go live.

## Layout

```
apps/
  api/        Fastify REST API (/v1), Zod-validated, OpenAPI at /docs (non-prod);
              also the outbox worker (src/worker) and Dockerfile
  web/        Next.js marketplace + organizer dashboard
e2e/          Playwright browser tests (desktop + mobile)
packages/
  contracts/  Zod request/response schemas shared by API and clients
  db/         Drizzle schema, SQL migrations, seed data, DB client
  shared/     Domain enums, money (integer paise) helpers, error codes
```

Workspace packages export TypeScript source directly; the API bundles them with `tsup` and
Next.js compiles them via `transpilePackages`.

## Getting started

```bash
cp .env.example .env   # then set DATABASE_URL (Supabase Session pooler URI)
npm install
npm run db:migrate     # apply migrations
npm run db:seed        # sample treks/organizers/batches (safe to re-run)
npm run dev:api    # http://localhost:4000/v1/health, docs at /docs
npm run dev:web    # http://localhost:3000
npm run dev:worker # optional: delivers queued emails (logged unless RESEND_API_KEY is set)
```

## Scripts

| Command                          | What it does                                                |
| -------------------------------- | ----------------------------------------------------------- |
| `npm run check`                  | format check, lint, typecheck, tests                        |
| `npm run build`                  | build API (`apps/api/dist`) and web (`.next`)               |
| `npm test`                       | run all Vitest suites                                       |
| `npm run format`                 | apply Prettier                                              |
| `npm run db:generate`            | create a migration after editing `packages/db/src/schema`   |
| `npm run db:migrate`             | apply pending migrations to `DATABASE_URL`                  |
| `npm run db:seed`                | load sample data (refuses in production)                    |
| `npm run db:studio`              | browse the database in Drizzle Studio                       |
| `npm run e2e`                    | browser tests (needs seeded DB; reuses running dev servers) |
| `npm run admin:grant -- <email>` | make a signed-in user a platform admin                      |

## Conventions

- Money is always integer INR **paise**; timestamps are UTC ISO-8601; IDs are UUIDs.
- Every error response is `{ error: { code, message, requestId } }` with codes from
  `@ohviana/shared` (`ERROR_CODES`). Throw `AppError` in the API, never raw status codes.
- Every response carries `x-request-id`; an incoming safe `x-request-id` is propagated.
- Schema changes: edit `packages/db/src/schema`, run `npm run db:generate`, review the SQL,
  then `npm run db:migrate`. Never edit an applied migration.
- Every table has Row Level Security enabled with no policies: Supabase's public REST API sees
  nothing; only the API (connecting as `postgres`) reads and writes data.
- Business invariants are enforced in the database too (seat capacity, cutoff, zero commission
  on direct bookings, cross-organizer consistency) — see `packages/db/test/schema.test.ts`.
- DB tests run inside rolled-back transactions, so they are safe against a shared dev database.
- Logs redact auth headers, cookies and customer PII (phone, email, contact, guests).
