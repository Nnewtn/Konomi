FROM python:3.11-slim

WORKDIR /app

# Копируем зависимости и устанавливаем
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь бэкенд
COPY backend/ .

# Запуск приложения на порту из переменной окружения
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
