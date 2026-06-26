# QueueStorm Investigator Runbook

## Local run

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```bash
curl http://localhost:3000/health
```

Analyze a sample ticket:

```bash
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d @src/samples/sample-request.json
```

## Environment variables

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=development
PORT=3000
LLM_TIMEOUT_MS=12000
```

The service still works with deterministic fallback if `GEMINI_API_KEY` is absent.

## Vercel run

1. Push repository to GitHub.
2. Import repository in Vercel.
3. Add environment variables in Vercel dashboard.
4. Deploy.
5. Test `/health` and `/analyze-ticket`.
