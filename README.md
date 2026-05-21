# ReceiptSys

Monorepo structure for the receipt/document processing system:

## Directory Layout

- `frontend/`: Next.js 14 + TypeScript web app
- `backend/`: FastAPI + Gemini Python service

## Docker (Recommended)

Start both containers from repo root:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

Notes:

- Frontend container uses `PYTHON_BACKEND_URL=http://backend:8000`
- Backend reads secrets from `backend/.env`

## Local Development

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:3000`

### 2) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL: `http://localhost:8000`

## Environment Variables

### Frontend (`frontend/.env.local`)

```env
PYTHON_BACKEND_URL=http://localhost:8000
KIMI_API_KEY=your_kimi_api_key
OCR_PROVIDER=http
OCR_HTTP_URL=http://localhost:8000/api/ocr
```

### Backend (`backend/.env`)

```env
GEMINI_API_KEY=your_gemini_api_key
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
```

Do not use root `start.sh` if you are running with Docker.
