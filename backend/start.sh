#!/bin/bash

echo "Starting Distributed AI Task Queue..."

# Start the worker in the background and redirect its verbose logs to a file
# so it doesn't clutter the main Render application logs
echo "Starting background worker... (Logs redirected to /tmp/worker.log)"
doppler run -- python -m app.worker > /tmp/worker.log 2>&1 &

# Start the FastAPI application in the foreground
echo "Starting FastAPI server..."
exec doppler run -- uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
