# -----------------------------
# Base image: Linux + Python
# -----------------------------
FROM python:3.10-slim

# -----------------------------
# Python runtime settings
# -----------------------------
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# -----------------------------
# Working directory inside container
# -----------------------------
WORKDIR /app

# -----------------------------
# Copy dependency list first
# (enables Docker layer caching)
# -----------------------------
COPY requirements.txt .

# -----------------------------
# Install Python dependencies
# -----------------------------
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# -----------------------------
# Copy backend source code
# (includes app/ and email_classifier_pytorch/)
# -----------------------------
COPY . .

# -----------------------------
# Expose FastAPI port
# -----------------------------
EXPOSE 8000

# -----------------------------
# Start FastAPI server
# -----------------------------
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
