FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt && useradd --create-home --uid 10001 konomi
COPY --chown=konomi:konomi backend /app/backend
COPY --chown=konomi:konomi frontend /app/frontend
RUN mkdir -p /app/backend/data && chown -R konomi:konomi /app/backend/data
USER konomi
WORKDIR /app/backend
VOLUME ["/app/backend/data"]
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
