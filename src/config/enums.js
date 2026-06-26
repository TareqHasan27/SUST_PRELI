export const EVIDENCE_VERDICTS = ["consistent", "inconsistent", "insufficient_data"];

export const CASE_TYPES = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other"
];

export const SEVERITIES = ["low", "medium", "high", "critical"];

export const DEPARTMENTS = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk"
];

export const LANGUAGES = ["en", "bn", "mixed"];

export const CHANNELS = [
  "in_app_chat",
  "call_center",
  "email",
  "merchant_portal",
  "field_agent"
];

export const USER_TYPES = ["customer", "merchant", "agent", "unknown"];

export const TRANSACTION_TYPES = [
  "transfer",
  "payment",
  "cash_in",
  "cash_out",
  "settlement",
  "refund"
];

export const TRANSACTION_STATUSES = ["completed", "failed", "pending", "reversed"];

export const CASE_TO_DEPARTMENT = {
  wrong_transfer: "dispute_resolution",
  payment_failed: "payments_ops",
  refund_request: "customer_support",
  duplicate_payment: "payments_ops",
  merchant_settlement_delay: "merchant_operations",
  agent_cash_in_issue: "agent_operations",
  phishing_or_social_engineering: "fraud_risk",
  other: "customer_support"
};
