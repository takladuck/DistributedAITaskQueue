# Distributed AI Task Queue - Production Deployment Guide (Free Tier)

This guide walks you through deploying your entire system using modern DevOps practices. By utilizing a "Single-Container Unified Process" strategy, we can host the Database, Queue, Web Server, and Background Worker completely on free tiers.

This setup is ideal to showcase on your resume as it demonstrates Infrastructure as Code (IaC), Continuous Deployment (CI/CD), Containerization, and Cost-Aware Architecture.

---

## 1. Prerequisites (The External Databases)

Before deploying the code, you need connection keys for your free external databases. (These match the instructions in `PROJECT_GUIDE.md`).

1. **Supabase (PostgreSQL)**
   - Go to [Supabase](https://supabase.com). Create a free project.
   - Go to Project Settings -> Database.
   - Get the Connection String (URI). Replace `postgresql://` with `postgresql+asyncpg://`.
2. **Upstash (Redis)**
   - Go to [Upstash](https://upstash.com). Create a Redis database.
   - Copy the "URL" connection string (Looks like `rediss://default:PASSWORD@ENDPOINT:PORT`).
3. **Google Gemini API Key**
   - Grab this from [Google AI Studio](https://aistudio.google.com/).
4. **Doppler (Secret Management)**
   - Go to [Doppler](https://doppler.com). Create a project (e.g., `ai-queue`).
   - Add the following secrets to the `prd` (Production) environment in Doppler:
     - `DATABASE_URL` (From Supabase)
     - `REDIS_URL` (From Upstash)
     - `GEMINI_API_KEY` (From Google)
     - `JWT_SECRET_KEY` (Generate a random string)
     - `CORS_ORIGINS` (Will be your Vercel URL, you can edit this later)
   - Go to "Access" -> "Service Tokens" and generate a Service Token. Copy it! You will need this for Render.

---

## 2. Deploying the Backend (API + Worker) natively on Render

We've bundled the FastAPI server and your AI background worker into a single Docker image via `backend/start.sh`.

1. Go to [Render.com](https://render.com) and log in with your GitHub account.
2. In the Render Dashboard, click **New +** and select **Blueprint**.
3. Connect your GitHub repository (`DistributedAITaskQueue`).
4. Render will automatically detect the `render.yaml` file we created and propose creating a single Web Service called `distributed-ai-task-queue`.
5. Click **Apply**.
6. While it builds, click on the newly created web service in your dashboard and go to **Environment**.
7. Because we are using Doppler for Secret Management, you only need to provide *one* Environment Variable in Render:
   - `DOPPLER_TOKEN` (Paste the Service Token you generated in step 1.4 here).
8. Wait for the build to finish. Your API will be live at a URL like `https://distributed-ai-task-queue.onrender.com`.

> [!TIP]
> Make note of your exact Render URL (e.g., `https://distributed-ai-task-queue.onrender.com`). You will need this to connect your frontend!

---

## 3. Deploying the Frontend on Vercel

Vercel is the industry standard for React apps and is completely free.

1. Go to [Vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New...** -> **Project**.
3. Import your `DistributedAITaskQueue` repository.
4. Expand **Root Directory** and select `frontend`.
5. Expand **Environment Variables** and add the following two variables mapping to your Render Backend:
   - `VITE_API_URL` : `https://distributed-ai-task-queue.onrender.com` (Use your actual Render URL)
   - `VITE_WS_URL` : `wss://distributed-ai-task-queue.onrender.com` (Use `wss://` for secure WebSockets! Important!)
6. Click **Deploy**.

> [!CAUTION]
> WebSockets require the explicit `wss://` protocol when hosted on HTTPS domains.

---

## 4. Final Security Step (CORS)

Right now, your Backend doesn't know about your Vercel Frontend's domain, so it will block it.

1. Go to your **Doppler Dashboard** -> Project -> `prd` environment.
2. Add or modify the `CORS_ORIGINS` secret. Set its value to your newly created Vercel URL (e.g., `https://your-app-name.vercel.app`).
3. Save the changes.
4. Go to your **Render Dashboard**, find your Web Service, and click **Manual Deploy** to restart your container. When it restarts, Doppler will instantly inject the new CORS URL!

---

## 5. Enable CI/CD Action (Optional, for Resume)

You have a GitHub Actions file (`.github/workflows/ci.yml`) set up. 

If you want pushes to `main` to automatically trigger deployments without using Vercel's/Render's direct GitHub integrations, you can:
1. Turn off "Auto-Deploy" in Render settings.
2. Get a Render Deploy Hook URL (Settings -> Deploy Hook).
3. Add `RENDER_DEPLOY_HOOK_URL` to your GitHub Repo Secrets (Settings -> Secrets and variables -> Actions).
4. Get your Vercel Org ID, Project ID, and Token (Instructions [here](https://vercel.com/guides/how-can-i-use-github-actions-with-vercel)). Add them to Repo Secrets as `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and `VERCEL_TOKEN`.

> **Resume Talking Point**: "Implemented Continuous Deployment (CD) pipeline using GitHub Actions, pushing automated builds to Render and Vercel while orchestrating background workers within single lightweight Docker containers."
