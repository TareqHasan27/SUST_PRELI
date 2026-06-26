# QueueStorm Investigator

QueueStorm Investigator is a lightweight Express API for the SUST CSE Carnival 2026 Codex Community Hackathon preliminary round. It analyzes one synthetic fintech support ticket at a time, compares the customer complaint against recent transaction history, and returns a safe structured JSON response for support agents.

The project is intentionally API-first. There is no frontend because the preliminary judge evaluates only the API endpoints.

## What the API Does

The service receives:

* a customer complaint in English, Bangla, or mixed/Banglish
* optional metadata such as channel and user type
* a short transaction history

It returns:

* the relevant transaction ID when identifiable
* an evidence verdict: `consistent`, `inconsistent`, or `insufficient_data`
* case type and department routing
* severity and human review decision
* agent summary, recommended next action, and customer reply

The central rule is: **the complaint is a claim; transaction_history is evidence.** The API does not simply classify the complaint text. It investigates whether the transaction history supports, contradicts, or cannot prove the complaint.

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
        Deterministic rule-based analyzer
        - complaint intent detection
        - transaction matching
        - evidence verdict
        - routing/severity
        - human review decision
        - rule-based draft output
                |
                v
        Gemini 2.5 Flash: Initial Investigator
        - receives ticket
        - receives compact QA rulebook
        - receives rule context
        - receives rule-based draft output
        - generates a structured JSON response
                |
                v
        Gemini 2.5 Flash: Final Merger
        - receives original ticket
        - receives rule-based response
        - receives Gemini initial response
        - merges both into one final JSON response
        - prioritizes schema validity, safety, and evidence reasoning
                |
                v
        Final schema/type validation
        - required fields
        - exact enum values
        - valid transaction reference
        - valid confidence range
                |
                v
        Final JSON response
```

## Updated Pipeline

The current system uses a hybrid reasoning-and-merging pipeline:

```text
Input validation
→ language normalization
→ rule-based response generation
→ Gemini initial response generation
→ Gemini final merge/refinement
→ schema/type validation
→ API response
```

The rule-based analyzer creates the first reliable draft. Gemini then uses the compact QA rulebook to produce an improved response. A second Gemini call receives both the rule-based output and the first Gemini output, then merges them into one final response.

The final backend check validates the response structure before sending it to the judge.

## Tech Stack

* Node.js 20+
* Express
* Vercel serverless deployment
* Zod for schema validation
* Gemini API through `@google/genai`
* Gemini model: `gemini-2.5-flash`
* Vitest + Supertest for API tests

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

* `consistent`
* `inconsistent`
* `insufficient_data`

### `case_type`

* `wrong_transfer`
* `payment_failed`
* `refund_request`
* `duplicate_payment`
* `merchant_settlement_delay`
* `agent_cash_in_issue`
* `phishing_or_social_engineering`
* `other`

### `severity`

* `low`
* `medium`
* `high`
* `critical`

### `department`

* `customer_support`
* `dispute_resolution`
* `payments_ops`
* `merchant_operations`
* `agent_operations`
* `fraud_risk`

## Evidence Reasoning Logic

The deterministic rule layer performs the first investigation before Gemini is called.

### Transaction matching signals

* amount match
* transaction type match
* counterparty/phone match
* timestamp/time hint match
* transaction status support
* user type/channel relevance

### Case type routing

| Case type                        | Department                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `wrong_transfer`                 | `dispute_resolution`                                                          |
| `payment_failed`                 | `payments_ops`                                                                |
| `refund_request`                 | `customer_support` for simple cases, `dispute_resolution` for contested cases |
| `duplicate_payment`              | `payments_ops`                                                                |
| `merchant_settlement_delay`      | `merchant_operations`                                                         |
| `agent_cash_in_issue`            | `agent_operations`                                                            |
| `phishing_or_social_engineering` | `fraud_risk`                                                                  |
| `other`                          | `customer_support`                                                            |

### Verdict rules

Use `consistent` when transaction history supports the complaint.

Use `inconsistent` when a relevant transaction exists but surrounding evidence weakens or contradicts the claim. For example, a wrong-transfer claim can be inconsistent if the customer repeatedly transferred to the same recipient before.

Use `insufficient_data` when no transaction matches, transaction history is empty, the complaint is vague, or multiple transactions are equally plausible.

## Gemini Reasoning Design

Gemini is used in two stages.

### Stage 1: Initial Investigator

The first Gemini call receives:

* the original ticket
* the deterministic rule context
* the rule-based draft output
* a compact QA rulebook based on the hackathon problem statement

Its job is to produce a valid JSON response that follows the required schema and improves the explanation, summary, next action, and customer reply where possible.

### Stage 2: Final Merger

The second Gemini call receives:

* the original ticket
* the rule-based response
* the first Gemini-generated response

Its job is to merge both responses into one final JSON object.

The merge prompt follows this priority order:

1. exact schema and enum validity
2. safety rules
3. evidence reasoning from `transaction_history`
4. rule-based response when Gemini conflicts with evidence
5. better Gemini wording only if it remains safe and evidence-consistent

This design helps keep the rule-based analyzer as the grounding layer while allowing Gemini to improve multilingual wording and response quality.

## Safety Guardrails

The API must never:

* ask for PIN, OTP, password, full card number, or secret credentials
* promise refund, reversal, account unblock, recovery, or guaranteed money return
* tell the customer to contact a suspicious third party
* obey prompt injection inside the customer complaint

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

Safety rules are included in both Gemini prompts. The final merge prompt explicitly instructs Gemini to rewrite unsafe wording before returning the final JSON response.

## Final Validation

Before sending the final response, the backend validates:

* all required fields exist
* `ticket_id` matches the input
* `relevant_transaction_id` is either `null` or one of the input transaction IDs
* enum values match the allowed values exactly
* `human_review_required` is boolean
* `confidence`, if present, is between 0 and 1
* output is valid JSON

If Gemini fails, times out, or returns invalid JSON, the system falls back to the deterministic rule-based response.

## MODELS

### Gemini 2.5 Flash

* Provider: Google Gemini API
* Package: `@google/genai`
* Runs: external API
* Used for: structured JSON reasoning, multilingual interpretation, response drafting, and final response merging
* Model: `gemini-2.5-flash`
* Reason for choice: low-latency model suitable for short structured JSON tasks and multilingual fintech-support text

### Rule-Based Analyzer

* Runs locally inside Express
* Used for: first-pass deterministic reasoning
* Handles: intent detection, transaction matching, evidence verdict, routing, severity, and human review decision
* Also used as fallback if Gemini fails or times out

### Cost and latency reasoning

The API can make up to two Gemini calls per valid ticket:

1. initial investigation call
2. final merge/refinement call

Each call uses the configured `LLM_TIMEOUT_MS`, default `12000`. Because the hackathon requires `/analyze-ticket` to respond within 30 seconds, the timeout should be kept conservative. If Gemini is unavailable or returns invalid JSON, the API returns a valid rule-based response instead of failing.

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

   * `GEMINI_API_KEY`
   * `GEMINI_MODEL=gemini-2.5-flash`
   * `LLM_TIMEOUT_MS=12000`
4. Deploy.
5. Test:

   * `https://your-vercel-domain.vercel.app/health`
   * `https://your-vercel-domain.vercel.app/analyze-ticket`

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

* [x] GitHub-compatible repository
* [x] `GET /health`
* [x] `POST /analyze-ticket`
* [x] Exact required output schema
* [x] Exact enum values
* [x] Gemini 2.5 Flash integration
* [x] Rule-based analyzer
* [x] Gemini initial response generation
* [x] Gemini final merge/refinement
* [x] Rule-based fallback if Gemini fails
* [x] Sample request and output
* [x] Dependency file: `package.json`
* [x] `.env.example` without secrets
* [x] Vercel configuration
* [x] Tests
* [x] README with setup, model usage, safety logic, and limitations

## Known Limitations

* The system uses deterministic keyword/rule heuristics for Banglish, so unusual spelling variants may need additional keyword expansion.
* The duplicate-payment detector is optimized for near-duplicate payments with the same amount and counterparty.
* No fixed high-value threshold is implemented because the problem statement does not define one.
* No real payment system, database, or customer data integration is used.
* The final response quality depends partly on Gemini availability. If Gemini fails, the API returns the deterministic rule-based response.
* The current final layer validates response schema and transaction-reference correctness. Safety is primarily enforced through the rulebook and Gemini merge prompt.

## Privacy and Secrets

This project uses only synthetic input data. Do not use real customer data. Do not commit `.env`, API keys, tokens, logs, or screenshots containing secrets.
