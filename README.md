# Distributed AI Task Queue

Production-grade distributed task queue system with AI integration, real-time WebSocket monitoring, priority scheduling, and a React dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     FRONTEND                        │
│          React 18 + Vite + TailwindCSS              │
│   Dashboard | Jobs | Submit | Tasks | JobDetail     │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (Axios) + WebSocket
┌──────────────────────▼──────────────────────────────┐
│                     BACKEND                         │
│              FastAPI (Python 3.11)                  │
│  /auth  /tasks  /jobs  /metrics  /ws  /health       │
└──────┬──────────────────────────┬───────────────────┘
       │                          │
┌──────▼──────┐         ┌─────────▼────────┐
│  PostgreSQL │         │      Redis        │
│  (Supabase) │         │    (Upstash)      │
│  Users      │         │  queue:jobs (SS)  │
│  Tasks      │         │  queue:running    │
│  Jobs       │         │  queue:dead       │
└─────────────┘         │  job:{id}:status  │
                        │  job:{id}:lock    │
                        └─────────┬─────────┘
                                  │ Poll
                        ┌─────────▼─────────┐
                        │  WORKER PROCESS   │
                        │  (2 replicas)     │
                        │  ┌─────────────┐  │
                        │  │ Gemini AI   │  │
                        │  │ gemini-1.5  │  │
                        │  │   -flash    │  │
                        │  └─────────────┘  │
                        └───────────────────┘
```

## Tech Stack

| Layer        | Technology                                    |
|-------------|-----------------------------------------------|
| Backend      | Python 3.11 + FastAPI + Uvicorn              |
| Task Queue   | Redis Sorted Sets (Upstash free tier)         |
| Database     | PostgreSQL + SQLAlchemy async (Supabase)      |
| AI           | Google Gemini 1.5 Flash (google-generativeai) |
| Frontend     | React 18 + Vite + TailwindCSS v3 + Recharts  |
| Auth         | JWT (access 30min + refresh 7d) + bcrypt      |
| Containers   | Docker + Docker Compose                       |
| CI/CD        | GitHub Actions                                |
| Deployment   | Render.com (backend) + Vercel (frontend)      |

## Quick Start (Docker Compose)

### 1. Clone and configure

```bash
git clone <your-repo>
cd "major project"
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

### 2. Set required environment variables in `backend/.env`

```
GEMINI_API_KEY=your_key_here
JWT_SECRET_KEY=generate_a_secure_random_string
```

### 3. Start all services

```bash
docker-compose up --build
```

Services start in order: Postgres → Redis → Backend → Workers (×2) → Frontend

- **API:** http://localhost:8000
- **Dashboard:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

## Environment Variables

### Backend (`backend/.env`)

| Variable                    | Description                              | Example                                        |
|-----------------------------|------------------------------------------|------------------------------------------------|
| `DATABASE_URL`              | PostgreSQL async connection string       | `postgresql+asyncpg://user:pass@host/db`       |
| `REDIS_URL`                 | Redis connection URL                     | `redis://default:pass@host:6379`               |
| `GEMINI_API_KEY`            | Google Gemini API key                    | `AIza...`                                      |
| `JWT_SECRET_KEY`            | Secret for signing JWTs                  | `your-super-secret-key`                        |
| `JWT_ALGORITHM`             | JWT signing algorithm                    | `HS256`                                        |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL                       | `30`                                           |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL                        | `7`                                            |
| `CORS_ORIGINS`              | Comma-separated allowed origins          | `http://localhost:3000`                        |
| `ENVIRONMENT`               | Runtime environment                      | `development` or `production`                  |

### Frontend (`frontend/.env`)

| Variable       | Description              | Example                    |
|---------------|--------------------------|----------------------------|
| `VITE_API_URL` | Backend HTTP base URL   | `http://localhost:8000`    |
| `VITE_WS_URL`  | Backend WebSocket URL   | `ws://localhost:8000`      |

## API Documentation

All responses follow the envelope format:
```json
{ "success": true, "data": {...}, "error": null }
```

### Auth — `/auth`

| Method | Endpoint         | Auth | Description                        |
|--------|-----------------|------|------------------------------------|
| POST   | /auth/register  | No   | Register new user, returns tokens  |
| POST   | /auth/login     | No   | Login (rate limited: 5/min/IP)     |
| POST   | /auth/refresh   | No   | Refresh access token               |
| GET    | /auth/me        | Yes  | Get current user info              |

**Register/Login Request:**
```json
{ "email": "user@example.com", "password": "securepass123" }
```

**Register/Login Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": { "id": "uuid", "email": "user@example.com", "created_at": "...", "is_active": true }
}
```

### Tasks — `/tasks`

| Method | Endpoint      | Auth | Description                         |
|--------|--------------|------|-------------------------------------|
| POST   | /tasks        | Yes  | Create task template                |
| GET    | /tasks        | Yes  | List tasks (paginated, 20/page)     |
| GET    | /tasks/{id}   | Yes  | Get single task                     |
| PUT    | /tasks/{id}   | Yes  | Update task                         |
| DELETE | /tasks/{id}   | Yes  | Soft delete task                    |

**Create Task Request:**
```json
{
  "name": "My Summarizer",
  "task_type": "TEXT_SUMMARIZE",
  "payload": { "text": "...", "max_length": 100 }
}
```

### Jobs — `/jobs`

| Method | Endpoint            | Auth | Description                          |
|--------|---------------------|------|--------------------------------------|
| POST   | /jobs               | Yes  | Submit job (enqueues immediately)    |
| GET    | /jobs               | Yes  | List jobs (filter: status, sort, page) |
| GET    | /jobs/{id}          | Yes  | Get job details + result             |
| POST   | /jobs/{id}/cancel   | Yes  | Cancel PENDING/QUEUED job            |
| POST   | /jobs/{id}/retry    | Yes  | Retry FAILED/CANCELLED job           |
| DELETE | /jobs/{id}          | Yes  | Delete job record                    |

**Submit Job Request:**
```json
{ "task_id": "uuid", "priority": 7 }
```

**Job Response:**
```json
{
  "id": "uuid", "task_id": "uuid", "user_id": "uuid",
  "status": "QUEUED", "priority": 7, "retry_count": 0, "max_retries": 3,
  "result": null, "error_message": null,
  "queued_at": "2024-01-01T00:00:00Z", "started_at": null, "completed_at": null,
  "created_at": "2024-01-01T00:00:00Z", "execution_time_ms": null
}
```

**List Jobs Query Params:**
- `?status=COMPLETED` — filter by status
- `?sort_by=priority` — sort by (created_at | priority | execution_time_ms)
- `?page=2` — page number

### Metrics — `/metrics`

| Method | Endpoint                 | Auth | Description                       |
|--------|--------------------------|------|-----------------------------------|
| GET    | /metrics/summary         | Yes  | Aggregated stats                  |
| GET    | /metrics/timeseries      | Yes  | Jobs/hour last 24h (for chart)    |
| GET    | /metrics/worker-health   | Yes  | Active workers + queue stats      |

### WebSocket — `/ws`

| Path                   | Description                                  |
|------------------------|----------------------------------------------|
| `/ws/jobs/{job_id}`    | Stream status for one job                    |
| `/ws/dashboard`        | Aggregated queue metrics every 5 seconds     |

**WebSocket Message:**
```json
{
  "event": "status_update",
  "job_id": "uuid",
  "status": "COMPLETED",
  "progress": 100,
  "result": { ... },
  "error": null,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## AI Task Types

| Type                 | Input Fields                               | Output                                         |
|---------------------|---------------------------------------------|------------------------------------------------|
| `TEXT_SUMMARIZE`     | `text`, `max_length` (int)                 | `{ summary, original_length, summary_length }` |
| `SENTIMENT_ANALYSIS` | `text`                                     | `{ sentiment, confidence, key_phrases, ... }`  |
| `CODE_REVIEW`        | `code`, `language`                         | `{ issues, suggestions, score, summary }`      |
| `DATA_EXTRACTION`    | `text`, `fields` (string[])                | `{ field1: value, field2: value, ... }`        |
| `CUSTOM`             | `prompt`                                   | `{ response: string }`                         |

## Priority Queue Design

The queue uses a **Redis Sorted Set** (`queue:jobs`) with score:

```
score = (priority × 10¹²) - timestamp_ms
```

- **Higher priority = higher score = processed first** (ZPOPMAX)
- **Same priority**: earlier submission has smaller timestamp, so smaller subtraction → higher score → processed first (FIFO tie-breaking)

Example:
- `priority=9, t=1000` → score = `9e12 - 1000 = 8999999999000`
- `priority=9, t=2000` → score = `9e12 - 2000 = 8999999998000` ← lower, processed after

Queue keys:
- `queue:jobs` — Sorted Set of pending job IDs
- `queue:running` — Set of actively running job IDs
- `queue:dead` — Sorted Set of permanently failed jobs (inspectable via API)
- `job:{id}:status` — Hash with live `{status, progress}` fields
- `job:{id}:lock` — String with TTL (distributed lock)

## Worker Scaling & Distributed Locking

Two worker replicas run simultaneously:

```
worker-1 polls queue → ZPOPMAX → get job-42 → SETNX job:42:lock → ✅ locked → process
worker-2 polls queue → ZPOPMAX → queue empty → sleep(0.5s) → poll again
```

If both workers poll simultaneously (rare race):
```
worker-1: ZPOPMAX → job-42 → SETNX lock → True  → process
worker-2: ZPOPMAX → empty  → None       → sleep
```

The lock uses Redis `SET key value NX EX 300` — atomic, expires after 5 minutes preventing deadlocks if a worker crashes mid-job.

Scale to more workers: `docker-compose up --scale worker=N`

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Tests use mocked Redis and Gemini — no external services required.

```
tests/test_queue_service.py   — priority ordering, locking, dead letter queue
tests/test_ai_service.py      — all task types, JSON fallback, retry logic
tests/test_jobs_api.py        — API auth guards, endpoint responses
```

## Deployment

### Backend → Render.com

1. Create a new **Web Service** on Render
2. Connect your GitHub repo, set root to `backend/`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add all environment variables from `.env.example`
6. Add a second **Background Worker** service for the worker:
   - Start command: `python -m app.worker`

### Frontend → Vercel

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_API_URL` → your Render backend URL
- `VITE_WS_URL` → `wss://your-backend.onrender.com`

### CI/CD Secrets (GitHub Actions)

| Secret                | Description                         |
|----------------------|-------------------------------------|
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL          |
| `VERCEL_TOKEN`        | Vercel API token                   |
| `VERCEL_ORG_ID`       | Vercel organization ID             |
| `VERCEL_PROJECT_ID`   | Vercel project ID                  |

## System Design Decisions

### Why Redis Sorted Sets for priority queue?
Redis Sorted Sets provide O(log N) atomic ZPOPMAX — perfect for a priority queue. No locks needed for the dequeue itself. Supports thousands of concurrent jobs. The score formula encodes both priority and arrival time in one float.

### Why separate worker process?
FastAPI is async I/O-bound; AI calls are slow CPU/network-bound. Separating the worker prevents Gemini API calls from blocking request handling. Workers can scale independently without scaling the API server.

### Why WebSocket for status updates?
Polling would require clients to send requests every second. WebSocket pushes updates the millisecond status changes — zero latency, no wasted requests. The ConnectionManager maintains a per-job subscription map for targeted pushes.

### Why JWT refresh tokens?
Access tokens expire in 30 minutes for security. Silent refresh in the Axios interceptor re-issues a new access token without the user re-logging in. Refresh tokens are stored in DB making them revocable server-side.

### Why PostgreSQL + SQLAlchemy async?
Async SQLAlchemy with asyncpg gives true non-blocking DB queries that don't block FastAPI's event loop. JSONB columns store AI results natively without schema migrations for each new output format.

### Why distributed locking on workers?
With 2+ worker replicas all polling the same Redis queue, ZPOPMAX is atomic but the subsequent job processing is not. Without locking, two workers could both dequeue the same job ID (in edge cases). The Redis SETNX lock ensures exactly-once processing.
