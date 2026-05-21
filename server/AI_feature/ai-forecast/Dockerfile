FROM python:3.11-slim

WORKDIR /app

COPY . .
RUN python -m pip install --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 7860

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
