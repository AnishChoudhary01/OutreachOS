# OutreachOS Phase 1

Phase 1 provides the backend core for persistent email scheduling. It includes Express, PostgreSQL/Prisma, Redis/BullMQ delayed jobs, an independent worker, Ethereal SMTP delivery, idempotent schedule creation, sender-scoped Redis rate limiting, and restart reconciliation.

## Setup

1. Copy `.env.example` to `.env` and provide `DATABASE_URL`, Ethereal SMTP credentials, and any desired limits.
2. Install dependencies and generate the Prisma client: `npm install && npm run prisma:generate`.
3. Start services: `docker compose up -d`.
4. Apply the migration: `npm run prisma:migrate`.
5. Run API and worker separately: `npm run dev:api` and `npm run dev:worker`.

The API defaults to `http://localhost:4000`. Health is `GET /api/health`.

## Scheduling API

`POST /api/emails/schedule` accepts `senderId`, `recipients`, `subject`, `body`, an ISO `startTime` in the future, `delayBetweenEmailsMs`, `maxEmailsPerHour`, and an `idempotencyKey`. Recipients are normalized and deduplicated. The response returns the schedule ID, email IDs, and calculated execution times. Repeating an idempotent request returns the existing schedule.

`GET /api/emails/scheduled`, `GET /api/emails/sent`, and `GET /api/emails/:id` expose persisted records. List endpoints accept `page` and `limit`.

## Reliability notes

The API persists the schedule and email rows before adding stable BullMQ jobs. The worker reconciles scheduled rows at startup using deterministic job IDs, so pending rows survive API/worker restarts. Processing claims a row before SMTP submission and checks the persisted status first. Transient SMTP failures are retried with bounded exponential backoff; permanent failures are recorded. Rows found in `processing` after a worker restart are marked failed for manual review rather than automatically resent, because their SMTP outcome is uncertain.

Redis uses an atomic Lua script per sender to enforce both minimum spacing between actual attempts and a rolling one-hour window across workers. A denied reservation moves the BullMQ job to the next eligible time; it is not discarded. The effective hourly limit is capped by `MAX_EMAILS_PER_HOUR_PER_SENDER`.

SMTP acceptance and the PostgreSQL update are separate systems. Exactly-once delivery cannot be guaranteed if a process crashes after SMTP accepts a message but before PostgreSQL records `sent`; the persisted state checks, stable job IDs, and claim transition are practical duplicate-reduction safeguards, not a transactional guarantee.

Slack, Google OAuth, Elasticsearch, Bull Board, and the frontend are intentionally deferred to later phases.

## Verification

Run `npm run typecheck`, `npm test`, and `npm run build`. The default test run uses mocks/pure unit coverage; the PostgreSQL/Redis integration tests are skipped unless explicitly enabled. In PowerShell, run `$env:RUN_INTEGRATION_TESTS='true'; npm test -- apps/backend/tests/integration.test.ts` after the services are available. A live Ethereal delivery additionally requires configured credentials and running PostgreSQL/Redis.

Docker is the supported local service environment: `docker compose up -d`, followed by `npm run prisma:migrate`. If Docker is unavailable, provide PostgreSQL on `localhost:5432` with database `outreachos`, user `postgres`, password `postgres`, and Redis on `localhost:6379`, or update `.env` accordingly. Do not treat unit-test success as database, Redis, queue, or SMTP verification.
