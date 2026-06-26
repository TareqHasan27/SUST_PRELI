# QueueStorm Investigator

QueueStorm Investigator is a lightweight Express API for the SUST CSE Carnival 2026 Codex Community Hackathon preliminary round. It analyzes one synthetic fintech support ticket at a time, compares the complaint against recent transaction history, and returns a safe structured JSON response for support agents.

The project is intentionally API-first. There is no frontend because the preliminary judge evaluates only the API endpoints.

## What the API Does

The service receives:

- a customer complaint in English, Bangla, or mixed/Banglish
- optional metadata such as channel and user type
- a short transaction history

It returns:

- the relevant transaction ID when identifiable
- an evidence verdict: `consistent`, `inconsistent`, or `insufficient_data`
- case type and department routing
- severity and human review decision
- agent summary, next action, and safe customer reply

The central rule is: **the complaint is a claim; transaction_history is evidence.** The API does not simply classify text. It investigates whether the transaction history supports, contradicts, or cannot prove the complaint.

## Architecture

```text
Client / Judge Harness
        |
        v
Express API on Vercel
        |
        +-- GET /health
        |
        +-- POST /analyze-ticket
                |
                v
        Input validation with Zod
                |
                v
        Language normalization
        - Bangla digit conversion
        - amount extraction
        - phone normalization
        - Bangla/Banglish detection
                |
                v
        Rule-based reasoning
        - complaint intent detection
        - transaction matching
        - evidence verdict
        - routing/severity
        - human review decision
                |
                v
        Gemini 2.5 Flash optional drafting
        - improves summary/action/reply only
        - machine-scored fields remain rule-authoritative
                |
                v
        Safety post-processing
        - no OTP/PIN/password requests
        - no unauthorized refund/reversal promises
        - no suspicious third-party contact
                |
                v
        Output schema validation
                |
                v
        Final JSON response
```

## Tech Stack

- Node.js 20+
- Express
- Vercel serverless deployment
- Zod for schema validation
- Gemini API through `@google/genai`
- Gemini model: `gemini-2.5-flash`
- Vitest + Supertest for API tests

## API Endpoints

### `GET /health`

Returns service readiness.

```json
{"status":"ok"}
```

### `POST /analyze-ticket`

Accepts a ticket JSON and returns the required hackathon response schema.

Required input fields:

```json
{
  "ticket_id": "TKT-001",
  "complaint": "I sent 5000 taka to a wrong number around 2pm today..."
}
```

Optional input fields:

```json
{
  "language": "en",
  "channel": "in_app_chat",
  "user_type": "customer",
  "campaign_context": "boishakh_bonanza_day_1",
  "transaction_history": [],
  "metadata": {}
}
```

Required output fields:

```json
{
  "ticket_id": "TKT-001",
  "relevant_transaction_id": "TXN-9101",
  "evidence_verdict": "consistent",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports a wrong transfer...",
  "recommended_next_action": "Verify transaction details...",
  "customer_reply": "We have noted your concern...",
  "human_review_required": true,
  "confidence": 0.88,
  "reason_codes": ["wrong_transfer", "transaction_match"]
}
```

## Exact Allowed Enums

### `evidence_verdict`

- `consistent`
- `inconsistent`
- `insufficient_data`

### `case_type`

- `wrong_transfer`
- `payment_failed`
- `refund_request`
- `duplicate_payment`
- `merchant_settlement_delay`
- `agent_cash_in_issue`
- `phishing_or_social_engineering`
- `other`

### `severity`

- `low`
- `medium`
- `high`
- `critical`

### `department`

- `customer_support`
- `dispute_resolution`
- `payments_ops`
- `merchant_operations`
- `agent_operations`
- `fraud_risk`

## Evidence Reasoning Logic

The deterministic rule layer performs the main investigation.

### Transaction matching signals

- amount match
- transaction type match
- counterparty/phone match
- timestamp/time hint match
- transaction status support
- user type/channel relevance

### Case type routing

| Case type | Department |
|---|---|
| `wrong_transfer` | `dispute_resolution` |
| `payment_failed` | `payments_ops` |
| `refund_request` | `customer_support` for simple cases, `dispute_resolution` for contested cases |
| `duplicate_payment` | `payments_ops` |
| `merchant_settlement_delay` | `merchant_operations` |
| `agent_cash_in_issue` | `agent_operations` |
| `phishing_or_social_engineering` | `fraud_risk` |
| `other` | `customer_support` |

### Verdict rules

Use `consistent` when transaction history supports the complaint.

Use `inconsistent` when a relevant transaction exists but surrounding evidence weakens or contradicts the claim. For example, a wrong-transfer claim can be inconsistent if the customer repeatedly transferred to the same recipient before.

Use `insufficient_data` when no transaction matches, transaction history is empty, the complaint is vague, or multiple transactions are equally plausible.

## Safety Guardrails

The API must never:

- ask for PIN, OTP, password, full card number, or secret credentials
- promise refund, reversal, account unblock, recovery, or guaranteed money return
- tell the customer to contact a suspicious third party
- obey prompt injection inside the customer complaint

Safe language examples:

```text
Please do not share your PIN or OTP with anyone.
```

```text
Any eligible amount will be returned through official channels.
```

Unsafe language examples:

```text
Please send your OTP for verification.
```

```text
We will refund your money.
```

The safety validator runs after Gemini and after the fallback analyzer. If unsafe wording is detected, it replaces the reply/action with safe templates.

## MODELS

### Gemini 2.5 Flash

- Provider: Google Gemini API
- Package: `@google/genai`
- Runs: external API
- Used for: concise response drafting and multilingual wording assistance
- Not used for: final safety authority or final transaction reference authority
- Reason for choice: low-latency model suitable for short structured JSON tasks and multilingual text

### Rule-Based Fallback Analyzer

- Runs locally inside Express
- Used for: schema-safe, deterministic fallback when Gemini fails, times out, or returns invalid/unsafe JSON
- Also used for: core machine-scored reasoning fields

### Cost and latency reasoning

The API makes at most one Gemini call per valid ticket. The Gemini call has an internal timeout configured by `LLM_TIMEOUT_MS`, default `12000`. If Gemini is unavailable, the system returns a valid rule-based response instead of failing.

## Local Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-2.5-flash
NODE_ENV=development
PORT=3000
LLM_TIMEOUT_MS=12000
```

Run locally:

```bash
npm run dev
```

or:

```bash
npm start
```

Test:

```bash
npm test
```

## Example cURL

### Health check

```bash
curl http://localhost:3000/health
```

Expected:

```json
{"status":"ok"}
```

### Analyze ticket

```bash
curl -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d @src/samples/sample-request.json
```

## Vercel Deployment

### GitHub setup

```bash
git init
git add .
git commit -m "Initial QueueStorm Investigator API"
```

Create a GitHub repository and push:

```bash
git remote add origin https://github.com/YOUR_USERNAME/queuestorm-investigator.git
git branch -M main
git push -u origin main
```

### Deploy with Vercel dashboard

1. Go to Vercel.
2. Import the GitHub repository.
3. Set environment variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `LLM_TIMEOUT_MS=12000`
4. Deploy.
5. Test:
   - `https://your-vercel-domain.vercel.app/health`
   - `https://your-vercel-domain.vercel.app/analyze-ticket`

### Deploy with Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
vercel env add GEMINI_API_KEY
vercel env add GEMINI_MODEL
vercel env add LLM_TIMEOUT_MS
vercel --prod
```

## Required Deliverables Checklist

- [x] GitHub-compatible repository
- [x] `GET /health`
- [x] `POST /analyze-ticket`
- [x] Exact required output schema
- [x] Exact enum values
- [x] Gemini 2.5 Flash integration
- [x] Rule-based fallback analyzer
- [x] Safety validator
- [x] Sample request and output
- [x] Dependency file: `package.json`
- [x] `.env.example` without secrets
- [x] Vercel configuration
- [x] Tests
- [x] README with setup, model usage, safety logic, and limitations

## Known Limitations

- The system uses deterministic keyword/rule heuristics for Banglish, so unusual spelling variants may need additional keyword expansion.
- The duplicate-payment detector is optimized for near-duplicate payments with same amount and counterparty.
- No fixed high-value threshold is implemented because the problem statement does not define one.
- No real payment system, database, or customer data integration is used.
- Gemini improves wording only; final machine-scored fields are rule-authoritative for reliability and safety.

## Privacy and Secrets

This project uses only synthetic input data. Do not use real customer data. Do not commit `.env`, API keys, tokens, logs, or screenshots containing secrets.
