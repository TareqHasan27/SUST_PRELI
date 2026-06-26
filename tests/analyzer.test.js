import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import samplePack from "./fixtures/sample-cases.json" assert { type: "json" };

const byId = Object.fromEntries(samplePack.cases.map((item) => [item.id, item]));

function expectValidOutput(body, input) {
  expect(body.ticket_id).toBe(input.ticket_id);
  expect(body).toHaveProperty("relevant_transaction_id");
  expect(["consistent", "inconsistent", "insufficient_data"]).toContain(body.evidence_verdict);
  expect([
    "wrong_transfer",
    "payment_failed",
    "refund_request",
    "duplicate_payment",
    "merchant_settlement_delay",
    "agent_cash_in_issue",
    "phishing_or_social_engineering",
    "other"
  ]).toContain(body.case_type);
  expect(["low", "medium", "high", "critical"]).toContain(body.severity);
  expect([
    "customer_support",
    "dispute_resolution",
    "payments_ops",
    "merchant_operations",
    "agent_operations",
    "fraud_risk"
  ]).toContain(body.department);
  expect(typeof body.agent_summary).toBe("string");
  expect(typeof body.recommended_next_action).toBe("string");
  expect(typeof body.customer_reply).toBe("string");
  expect(typeof body.human_review_required).toBe("boolean");

  if (body.relevant_transaction_id !== null) {
    expect(input.transaction_history.map((tx) => tx.transaction_id)).toContain(body.relevant_transaction_id);
  }
}

describe("QueueStorm Investigator API", () => {
  it("GET /health returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rejects missing complaint", async () => {
    const res = await request(app).post("/analyze-ticket").send({ ticket_id: "TKT-X" });
    expect(res.status).toBe(400);
  });

  it("rejects empty complaint", async () => {
    const res = await request(app).post("/analyze-ticket").send({ ticket_id: "TKT-X", complaint: "   " });
    expect(res.status).toBe(422);
  });

  it("handles sample wrong transfer", async () => {
    const input = byId["SAMPLE-01"].input;
    const res = await request(app).post("/analyze-ticket").send(input);
    expect(res.status).toBe(200);
    expectValidOutput(res.body, input);
    expect(res.body.relevant_transaction_id).toBe("TXN-9101");
    expect(res.body.evidence_verdict).toBe("consistent");
    expect(res.body.case_type).toBe("wrong_transfer");
    expect(res.body.department).toBe("dispute_resolution");
    expect(res.body.human_review_required).toBe(true);
  });

  it("detects phishing and never asks for credentials", async () => {
    const input = byId["SAMPLE-05"].input;
    const res = await request(app).post("/analyze-ticket").send(input);
    expect(res.status).toBe(200);
    expectValidOutput(res.body, input);
    expect(res.body.case_type).toBe("phishing_or_social_engineering");
    expect(res.body.department).toBe("fraud_risk");
    expect(res.body.severity).toBe("critical");
    expect(res.body.customer_reply.toLowerCase()).not.toMatch(/(?:send|share|provide|give)\s+(?:your\s+)?(?:otp|pin|password)/);
  });

  it("detects Bangla agent cash-in issue", async () => {
    const input = byId["SAMPLE-07"].input;
    const res = await request(app).post("/analyze-ticket").send(input);
    expect(res.status).toBe(200);
    expectValidOutput(res.body, input);
    expect(res.body.relevant_transaction_id).toBe("TXN-9701");
    expect(res.body.case_type).toBe("agent_cash_in_issue");
    expect(res.body.department).toBe("agent_operations");
    expect(res.body.evidence_verdict).toBe("consistent");
  });

  it("returns insufficient_data for ambiguous multiple matches", async () => {
    const input = byId["SAMPLE-08"].input;
    const res = await request(app).post("/analyze-ticket").send(input);
    expect(res.status).toBe(200);
    expectValidOutput(res.body, input);
    expect(res.body.relevant_transaction_id).toBeNull();
    expect(res.body.evidence_verdict).toBe("insufficient_data");
  });

  it("detects duplicate payment", async () => {
    const input = byId["SAMPLE-10"].input;
    const res = await request(app).post("/analyze-ticket").send(input);
    expect(res.status).toBe(200);
    expectValidOutput(res.body, input);
    expect(res.body.case_type).toBe("duplicate_payment");
    expect(res.body.department).toBe("payments_ops");
    expect(res.body.relevant_transaction_id).toBe("TXN-10002");
    expect(res.body.customer_reply.toLowerCase()).not.toMatch(/we\s+will\s+refund|refund\s+confirmed/);
  });
});
