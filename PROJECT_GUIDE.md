# Comprehensive Project Guide: Distributed AI Task Queue

This document explains the inner workings of the Distributed AI Task Queue system, including its architecture, data flow, and the precise steps you need to take to configure it for a live environment.

---

## 1. How Everything Works In Detail

The system is a classic **Producer-Consumer** architecture designed for heavy, asynchronous workloads (like AI processing), so that the main web server never blocks while waiting for AI responses.

### A. The Backend (FastAPI + Async SQLAlchemy)
- **FastAPI** handles incoming HTTP requests and WebSocket connections. Because it's fully asynchronous, it can handle thousands of concurrent requests/connections without slowing down.
- **SQLAlchemy (Async)** manages the PostgreSQL database. We use the `asyncpg` driver. All data (Users, Task Templates, Job History) is stored here. JSONB columns are used heavily so we can store arbitrary AI result schemas without needing to migrate the database every time we add a new AI task type.
- **Authentication**: JWT (JSON Web Tokens). When a user logs in, they get a short-lived Access Token (30 mins) and a long-lived Refresh Token (7 days). 

### B. The Queue (Redis Sorted Sets)
When a user submits a job via the API, the backend does **not** process it immediately. Instead:
1. It saves a `PENDING` job record to PostgreSQL.
2. It pushes the Job ID to a **Redis Sorted Set** named `queue:jobs`.
3. **The Score Formula**: Redis Sorted Sets order items by a "score". Our score is calculated as: `(priority * 1,000,000,000,000) - current_timestamp_ms`. 
   - This ensures that a Priority 10 job always has a higher score than a Priority 9 job. 
   - If two jobs have Priority 9, the one submitted *earlier* (smaller timestamp) will have a slightly mathematically larger score, ensuring **FIFO (First-In, First-Out)** execution for identical priorities.

### C. The Worker Process (Python Standalone Script)
The `worker.py` script runs independently from the FastAPI server. In our Docker setup, there are **two** worker containers running simultaneously.
1. **Polling**: Every 0.5 seconds, the workers ask Redis: "Give me the 1 job with the highest score" (using `ZPOPMAX`).
2. **Distributed Locking**: Because multiple workers might pull the same job in a split millisecond, the worker immediately tries to set a Redis key `job:{id}:lock` using `SET NX` (Set if Not eXists) with a 5-minute expiration. 
   - If it succeeds, it "owns" the job. If it fails, another worker beat it to the lock, so it goes back to polling.
3. **Execution**: The worker sends the payload to the **Google Gemini API**. 
   - It forces Gemini to return structured JSON.
   - If the API fails (e.g., rate limit), the worker uses exponential backoff to retry.
4. **Completion**: The worker saves the final AI result to PostgreSQL, removes the lock, and pushes the final status to Redis.

### D. Real-Time WebSockets
- **Per-Job Stream**: When viewing a specific job, the frontend connects to `ws://localhost:8000/ws/jobs/{id}`. The worker broadcasts progress to Redis Pub/Sub, and the WebSocket manager pushes it to the browser, instantly lighting up the UI progress tracker.
- **Dashboard Stream**: The dashboard connects to `/ws/dashboard`. A background task in FastAPI calculates queue depth and worker health every 5 seconds and pushes it to all connected dashboard clients.

### E. The Frontend (React + Vite + Zustand)
- **State Management**: `Zustand` keeps track of the logged-in user and tokens.
- **API Client**: Axios is configured with an interceptor. If an API call fails with a `401 Unauthorized` (Token Expired), Axios suspends the request, silently hits the `/auth/refresh` endpoint, gets a new token, and replays the original request entirely invisibly to the user.

---

## 2. What You Need To Do To Make It Functional

The codebase is 100% complete. You just need to provide the external free-tier services (Database, Redis, AI) and run it.

### Step 1: Get External Service Keys (All Free)

1. **Google Gemini API Key**:
   - Go to Google AI Studio (https://aistudio.google.com/)
   - Generate a new API key.
   
2. **PostgreSQL Database (Supabase)**:
   - Create a free account on Supabase (https://supabase.com).
   - Create a new Project.
   - Go to Project Settings -> Database.
   - Look for the **Connection string (URI)**. It looks like `postgresql://postgres:[YOUR-PASSWORD]@db.[REF].supabase.co:5432/postgres`.
   - **Crucial**: Because we use `asyncpg`, change the `postgresql://` part to `postgresql+asyncpg://`.

3. **Redis Database (Upstash)**:
   - Create a free account on Upstash (https://upstash.com).
   - Create a new Redis Database.
   - Scroll down to the **URL** section in the dashboard to copy the connection string. It looks like `rediss://default:[YOUR-PASSWORD]@[ENDPOINT]:[PORT]`.

### Step 2: Configure Environment Variables

In your code directory, go to `backend/` and copy `.env.example` to `.env`:

```env
# backend/.env

# Replace with your Supabase asyncpg string
DATABASE_URL=postgresql+asyncpg://postgres:YourPassword123@db.abcdefghijk.supabase.co:5432/postgres

# Replace with your Upstash Redis URL
REDIS_URL=rediss://default:YourPassword123@mighty-dragon-12345.upstash.io:32451

# Replace with your Gemini API Key
GEMINI_API_KEY=AIzaSyA...

# Generate a random string for JWT Security (e.g. mash your keyboard)
JWT_SECRET_KEY=super_secure_random_string_123456789
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ENVIRONMENT=development
```

*(Note: The `frontend/.env.example` does not strictly need to be changed if you are running locally via Docker, as it defaults to localhost:8000).*

### Step 3: Initialize the Database Tables

Because you just created a fresh database on Supabase, it is totally empty. We need to create the tables. I have configured SQLAlchemy to do this automatically on startup, but you can also run it manually if needed through a python shell, but running Docker will trigger it.

### Step 4: Run the System

The easiest way to run the entire system (Database connection, Redis connection, Web API, 2x Workers, and the Frontend UI) is using Docker Compose.

Make sure Docker Desktop is running on your Windows machine. Then, open a terminal in the root `d:\KIIT\eightsem\major project\` directory and run:

```bash
docker-compose up --build
```

**What to watch for in the terminal:**
1. Wait to see `backend-1` output: `Uvicorn running on http://0.0.0.0:8000` (API is ready).
2. Wait to see `frontend-1` output: Nginx server started.
3. Wait to see `worker-1` and `worker-2` output: `Worker <UUID> starting up...`

### Step 5: Start Using the App

1. Open your browser and go to **http://localhost:3000** (This is the Frontend).
2. Click "Create Account" and make a test user (e.g., `test@test.com` / `password123`).
3. You will land on the Dashboard.
4. Go to **Submit Job** -> Select "Custom Prompt" -> Type "Tell me a joke" -> Submit.
5. You will see the Job Detail page. Watch closely as the WebSocket lights up the progress bar from "Queued", to "Running", to "Done".

### Troubleshooting

- **If the frontend is blank or won't load**: Ensure Docker mapped port 3000 correctly. Alternatively, run the frontend locally without docker: `cd frontend` -> `npm install` -> `npm run dev` (It will open on port 5173).
- **If jobs are stuck in "PENDING"**: It means the Workers aren't connecting to Redis properly. Check the `REDIS_URL` in your `backend/.env`.
- **If jobs immediately fail**: It usually means the `GEMINI_API_KEY` is invalid, or the DB Connection string is wrong. Check the Docker logs for the `worker-1` output to see the exact python error.
