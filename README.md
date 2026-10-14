# OutreachOS

OutreachOS is a full-stack email scheduling and delivery platform. It uses PostgreSQL as the source of truth, Redis and BullMQ for durable delayed jobs, Ethereal SMTP for test delivery, Google OAuth for authentication, Slack for rate-limit notifications, Elasticsearch for search, and React/Vite for the dashboard.

## Architecture

```text
apps/backend/src/
├── routes/          Express API, OAuth, search, and sender routes
├── services/        scheduling, SMTP, Slack, encryption, and Elasticsearch
├── queues/          BullMQ and Redis connections
├── workers/         delayed email processing and indexing recovery
├── middleware/      sessions, authorization, and origin checks
├── app.ts           Express application
├── server.ts        API process
└── worker.ts        background worker process

apps/frontend/src/
├── components/      layout, tables, compose modal, and UI states
├── context/         authenticated session state
├── pages/           login and dashboard
├── services/        typed Axios API client
└── utils/           recipient parsing
```

PostgreSQL stores users, sessions, senders, schedules, emails, Slack connections, and Elasticsearch outbox records. Redis stores BullMQ jobs, sender rate-limit state, and Slack notification deduplication. Elasticsearch is a non-authoritative search index.

## Prerequisites

- Node.js 22.11 or newer
- npm
- PostgreSQL 16
- Redis 7
- Elasticsearch 8.x for search
- Google OAuth credentials for login
- Slack OAuth credentials for Slack integration
- Ethereal SMTP credentials for actual test delivery

Docker is recommended for PostgreSQL and Redis:

```powershell
docker compose up -d
```

Start Elasticsearch separately if needed:

```powershell
docker run --name outreachos-elasticsearch -p 9200:9200 `
  -e discovery.type=single-node `
  -e xpack.security.enabled=false `
  docker.elastic.co/elasticsearch/elasticsearch:8.19.0
```

## Configuration

Copy the environment template:

```powershell
Copy-Item .env.example .env
```

Important variables include:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Sender-level minimum send spacing |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Effective sender hourly limit |
| `ETHEREAL_*` | SMTP delivery configuration |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `GOOGLE_REDIRECT_URI` | Google callback URL |
| `SESSION_SECRET` | Session configuration secret, at least 32 characters |
| `FRONTEND_ORIGIN` | Credentialed frontend origin |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack OAuth credentials |
| `SLACK_REDIRECT_URI` | Slack callback URL |
| `SLACK_NOTIFICATION_CHANNEL` | Slack channel for rate-limit notifications |
| `TOKEN_ENCRYPTION_KEY` | Encryption key for stored Slack tokens |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint |
| `BULL_BOARD_ADMIN_EMAILS` | Comma-separated Bull Board administrators |
| `VITE_API_URL` | Frontend API origin |

Never commit `.env`, OAuth secrets, SMTP credentials, Slack tokens, or encryption keys.

## Installation and database setup

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
```

The migrations are:

- `prisma/migrations/0001_init`: Phase 1 scheduling schema
- `prisma/migrations/0002_phase2`: users, sessions, OAuth state, Slack connections, ownership, and Elasticsearch outbox

Existing Phase 1 records are assigned to a `legacy-owner` account during the Phase 2 migration when necessary.

## Running the application

Run the API, worker, and frontend in separate terminals:

```powershell
npm run dev:api
npm run dev:worker
npm run dev:frontend
```

Default addresses:

- API: `http://localhost:4000`
- Frontend: `http://localhost:5173`
- Health: `GET http://localhost:4000/api/health`

## Authentication

Google login starts at:

```text
GET /api/auth/google
```

The callback is:

```text
GET /api/auth/google/callback
```

Configure the exact callback URL in Google Cloud Console. Sessions are opaque, stored as hashes in PostgreSQL, and sent in HTTP-only cookies. The frontend uses credentialed requests and does not store session tokens in local storage.

Authentication endpoints:

- `GET /api/auth/me`
- `POST /api/auth/logout`

All email, sender, search, and Slack management routes require authentication. Queries are scoped by the authenticated user's ownership ID.

## Email scheduling API

Schedule emails with:

```http
POST /api/emails/schedule
Content-Type: application/json
```

```json
{
  "senderId": "sender-id",
  "recipients": ["person@example.com"],
  "subject": "OutreachOS test email",
  "body": "This is a test email.",
  "startTime": "2026-12-20T10:00:00.000Z",
  "delayBetweenEmailsMs": 2000,
  "maxEmailsPerHour": 100,
  "idempotencyKey": "unique-request-key"
}
```

Other endpoints:

- `GET /api/senders`
- `GET /api/emails/scheduled?page=1&limit=25`
- `GET /api/emails/sent?page=1&limit=25`
- `GET /api/emails/:id`

Recipients are normalized and deduplicated. BullMQ job IDs are deterministic. PostgreSQL records are written before queue jobs are created, and the worker reconciles pending scheduled records after restart.

Exactly-once SMTP delivery cannot be guaranteed because SMTP acceptance and PostgreSQL updates cannot share one transaction. If a worker crashes after SMTP acceptance but before recording `sent`, the record is marked for conservative manual review after restart rather than being blindly resent.

## Slack integration

Slack connection endpoints:

- `GET /api/auth/slack`
- `GET /api/auth/slack/callback`
- `GET /api/auth/slack/connection`
- `DELETE /api/auth/slack/:id`

The application requests the `chat:write` scope. Configure a channel that the installed Slack bot can access using `SLACK_NOTIFICATION_CHANNEL`. When an hourly sender limit is reached, a Redis `SET NX` key deduplicates notifications across workers. Slack failures never block email scheduling.

## Search and indexing

Search emails through Elasticsearch:

```text
GET /api/search/emails?q=example.com&status=sent&page=1&limit=25
```

Search covers recipient and subject fields and is scoped to the authenticated user. Elasticsearch outages return a service-unavailable response while PostgreSQL records remain intact.

Reindex the current user's records with:

```text
POST /api/search/emails/reindex
```

New records create PostgreSQL outbox rows. The worker retries pending outbox entries on startup. `POST /api/search/emails/reindex` is available for recovery and consistency repair.

## Bull Board

Bull Board is available at:

```text
http://localhost:4000/admin/queues
```

Access requires an authenticated user whose email appears in `BULL_BOARD_ADMIN_EMAILS`. The dashboard exposes the real BullMQ queue, including waiting, delayed, active, completed, and failed jobs. Keep the allowlist empty unless queue monitoring is intentionally enabled.

## Frontend

The React dashboard provides:

- Google sign-in and session restoration
- Scheduled and sent email tabs
- Server-backed search and pagination
- Responsive email tables with loading and empty states
- CSV/text recipient upload and validation
- Sender selection
- Scheduling controls for start time, delay, and hourly limits
- Slack connection status and disconnect controls
- Protected Bull Board access

The compose form accepts whitespace-, comma-, and semicolon-separated addresses. CSV files should include a column containing recipient email addresses. The browser never sends email directly; it submits schedules to the backend.

## Testing and verification

Backend checks:

```powershell
npm run lint
npm run typecheck
npm run build
npm test
```

Frontend checks:

```powershell
npm run typecheck:frontend
npm run build:frontend
```

Prisma checks:

```powershell
npx prisma validate
npm run prisma:generate
```

Service-backed integration tests are opt-in:

```powershell
$env:RUN_INTEGRATION_TESTS='true'
npm test -- apps/backend/tests/integration.test.ts
```

The deterministic test suite covers scheduling validation, recipient normalization, stable job IDs, SMTP failure classification, encryption helpers, authentication middleware, and frontend recipient parsing. PostgreSQL, Redis, Elasticsearch, OAuth, Slack, and SMTP tests require the corresponding services and valid credentials.

## Known limitations

- Live Google OAuth, Slack delivery, Elasticsearch, PostgreSQL, Redis, BullMQ, and Ethereal delivery require external configuration and were not verified in this environment.
- The supplied Figma URL was inaccessible through the available inspection tool, so the frontend is a polished approximation rather than a pixel-verified reproduction.
- Bull Board requires the administrator email allowlist to be configured explicitly.
- Elasticsearch indexing is eventually consistent and depends on worker startup recovery or manual reindexing.
- The frontend uses pagination and does not attempt to render thousands of email rows at once. Actual delivery of 1,000 emails through Ethereal is not required.
