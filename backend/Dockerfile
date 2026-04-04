FROM python:3.11-slim

WORKDIR /app

# Install system deps for asyncpg + gnupg (required by Doppler's GPG signature verification)
# Install Doppler CLI in the SAME layer so apt lists are still available
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl gpg gnupg apt-transport-https \
    && (curl -Ls --tlsv1.2 --proto "=https" --retry 3 https://cli.doppler.com/install.sh || wget -t 3 -qO- https://cli.doppler.com/install.sh) | sh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Force LF line endings on start.sh (safety net for Windows CRLF issues)
# and make it executable
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh

EXPOSE 8000

CMD ["./start.sh"]
