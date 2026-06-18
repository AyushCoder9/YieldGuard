FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/
RUN pip install --no-cache-dir -e . --no-deps

COPY models/ models/
COPY configs/ configs/

EXPOSE 8000

CMD ["uvicorn", "yieldguard.serving.api:app", "--host", "0.0.0.0", "--port", "8000"]
