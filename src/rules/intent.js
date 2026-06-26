function hasAny(text, patterns) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(text);
    return text.includes(pattern);
  });
}

export function detectIntent(ticket, normalized) {
  const text = normalized.lowerComplaint;
  const userType = ticket.user_type || "unknown";
  const channel = ticket.channel || "";

  const phishingSignals = [
    "otp", "pin", "password", "full card", "card number", "account will be blocked",
    "account blocked", "security code", "verification code", "ওটিপি", "পিন", "পাসওয়ার্ড",
    "chaiche", "চাইছে", "চেয়েছে", "block kore", "blocked kore"
  ];
  const suspiciousContactSignals = ["called me", "sms", "message", "someone", "সন্দেহ", "কল", "মেসেজ", "unknown"];

  if (hasAny(text, phishingSignals) && (hasAny(text, suspiciousContactSignals) || hasAny(text, ["asked", "ask", "share", "provide", "দিতে", "share korte"]))) {
    return {
      case_type: "phishing_or_social_engineering",
      signals: ["phishing", "credential_protection"],
      confidenceHint: 0.95
    };
  }

  const duplicateSignals = [
    "deducted twice", "charged twice", "paid twice", "duplicate", "twice from my account",
    "দুইবার", "২ বার", "duibar", "dui bar", "twice", "double charged"
  ];
  if (hasAny(text, duplicateSignals)) {
    return { case_type: "duplicate_payment", signals: ["duplicate_payment"], confidenceHint: 0.86 };
  }

  const failedPaymentSignals = [
    "payment failed", "transaction failed", "failed", "app showed failed", "balance deducted",
    "deducted", "টাকা কেটে গেছে", "কেটে গেছে", "কাটা গেছে", "taka kete", "kete gese", "kete geche"
  ];
  if (hasAny(text, failedPaymentSignals) && !hasAny(text, duplicateSignals)) {
    return { case_type: "payment_failed", signals: ["payment_failed", "potential_balance_deduction"], confidenceHint: 0.82 };
  }

  const wrongTransferSignals = [
    "wrong number", "wrong person", "wrong recipient", "typed it wrong", "typed wrong",
    "sent by mistake", "by mistake", "ভুল নম্বর", "ভুল করে", "ভুল মানুষ", "bhul number",
    "vul number", "bhul kore", "vul kore", "wrongly sent"
  ];
  if (hasAny(text, wrongTransferSignals)) {
    return { case_type: "wrong_transfer", signals: ["wrong_transfer"], confidenceHint: 0.84 };
  }

  const agentCashInSignals = [
    "agent", "cash in", "cash-in", "cashin", "not reflected", "balance not", "balance didn't",
    "এজেন্ট", "ক্যাশ ইন", "ব্যালেন্সে", "টাকা আসেনি", "balance ashe nai", "balance ase nai"
  ];
  if (hasAny(text, agentCashInSignals) && hasAny(text, ["cash", "ক্যাশ", "cash in", "cash-in", "cashin", "agent", "এজেন্ট"])) {
    return { case_type: "agent_cash_in_issue", signals: ["agent_cash_in"], confidenceHint: 0.84 };
  }

  const merchantSettlementSignals = [
    "settlement", "settled", "sales", "merchant", "batch", "সেটেলমেন্ট"
  ];
  if ((userType === "merchant" || channel === "merchant_portal" || hasAny(text, ["merchant", "মার্চেন্ট"])) && hasAny(text, merchantSettlementSignals)) {
    return { case_type: "merchant_settlement_delay", signals: ["merchant_settlement"], confidenceHint: 0.87 };
  }

  const refundSignals = ["refund", "money back", "get my money back", "টাকা ফেরত", "ferot", "ফেরত"];
  if (hasAny(text, refundSignals)) {
    return { case_type: "refund_request", signals: ["refund_request"], confidenceHint: 0.72 };
  }

  return { case_type: "other", signals: ["vague_or_other"], confidenceHint: 0.6 };
}
