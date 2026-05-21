# Frontend (Next.js)

## Setup

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Build / Start

```bash
npm run build
npm run start
```

## Environment

Create `frontend/.env.local`:

```env
PYTHON_BACKEND_URL=http://localhost:8000
KIMI_API_KEY=your_kimi_api_key
OCR_PROVIDER=http
OCR_HTTP_URL=http://localhost:8000/api/ocr
```

## Notes

- API routes are in `src/app/api`
- Pages are in `src/app`
- Feature modules are in `src/features`
- Shared utilities are in `src/shared`
- Server-only AI adapters are in `src/server`
- Test scripts are in `tests/scripts`
