function isBanglaLike(language) {
  return language === "bn";
}

export function containsUnsafeCredentialRequest(text = "") {
  const t = String(text).toLowerCase();
  const unsafePatterns = [
    /(?:send|share|provide|give|submit|enter)\s+(?:your\s+)?(?:otp|pin|password|full card number|card number)/i,
    /(?:otp|pin|password|full card number|card number)\s+(?:for verification|to verify|for security)/i,
    /(?:আপনার|তোমার)?\s*(?:ওটিপি|পিন|পাসওয়ার্ড)\s*(?:দিন|দিবেন|শেয়ার করুন|জানান|পাঠান)/i,
    /(?:otp|pin|password)\s+(?:den|din|diben|share korun|pathan)/i
  ];
  return unsafePatterns.some((pattern) => pattern.test(t));
}

export function containsUnauthorizedPromise(text = "") {
  const t = String(text).toLowerCase();
  const unsafePatterns = [
    /we\s+will\s+refund\s+you/i,
    /we\s+will\s+reverse/i,
    /your\s+money\s+will\s+be\s+refunded/i,
    /your\s+money\s+will\s+be\s+returned/i,
    /refund\s+confirmed/i,
    /reversal\s+confirmed/i,
    /account\s+unblocked/i,
    /recovered\s+your\s+account/i,
    /guaranteed\s+refund/i,
    /টাকা\s+ফেরত\s+(?:দেওয়া হবে|পাবেন|দিচ্ছি)/i
  ];
  return unsafePatterns.some((pattern) => pattern.test(t));
}

export function containsSuspiciousThirdPartyInstruction(text = "") {
  const t = String(text).toLowerCase();
  return /contact\s+(?:the\s+)?(?:caller|sender|unknown person|that number|third party)/i.test(t);
}

export function isUnsafeText(text = "") {
  return containsUnsafeCredentialRequest(text) || containsUnauthorizedPromise(text) || containsSuspiciousThirdPartyInstruction(text);
}

export function safeCustomerReply(output, context) {
  const caseType = output.case_type;
  const txId = output.relevant_transaction_id;
  const language = context?.normalized?.language || "en";
  const bn = isBanglaLike(language);

  if (bn) {
    if (caseType === "phishing_or_social_engineering") {
      return "সতর্ক থাকার জন্য ধন্যবাদ। আমরা কখনোই আপনার পিন, ওটিপি বা পাসওয়ার্ড চাই না। অনুগ্রহ করে এগুলো কারো সাথে শেয়ার করবেন না। আমাদের ফ্রড রিস্ক দল বিষয়টি পর্যালোচনা করবে।";
    }
    if (caseType === "agent_cash_in_issue") {
      return `আপনার লেনদেন${txId ? ` ${txId}` : ""} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের এজেন্ট অপারেশন্স দল এটি যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
    }
    if (caseType === "other") {
      return "আপনাকে দ্রুত সহায়তা করতে অনুগ্রহ করে লেনদেন আইডি, টাকার পরিমাণ, আনুমানিক সময় এবং কী সমস্যা হয়েছে তা জানান। কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।";
    }
    return `আপনার অভিযোগ${txId ? ` ${txId}` : ""} সম্পর্কে আমরা অবগত হয়েছি। সংশ্লিষ্ট দল বিষয়টি যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
  }

  switch (caseType) {
    case "wrong_transfer":
      return `We have noted your concern${txId ? ` about transaction ${txId}` : ""}. Please do not share your PIN or OTP with anyone. Our dispute team will review the case and contact you through official support channels.`;
    case "payment_failed":
      return `We have noted that transaction${txId ? ` ${txId}` : ""} may have caused an unexpected balance issue. Our payments team will review the case, and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
    case "refund_request":
      return "Thank you for reaching out. Refund eligibility depends on the relevant merchant or service policy. Our support team will guide you through the official process. Please do not share your PIN or OTP with anyone.";
    case "duplicate_payment":
      return `We have noted the possible duplicate payment${txId ? ` for transaction ${txId}` : ""}. Our payments team will verify the case, and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
    case "merchant_settlement_delay":
      return `We have noted your settlement concern${txId ? ` about ${txId}` : ""}. Our merchant operations team will check the settlement status and update you through official channels.`;
    case "agent_cash_in_issue":
      return `We have noted your cash-in concern${txId ? ` about transaction ${txId}` : ""}. Our agent operations team will verify the transaction status and update you through official channels. Please do not share your PIN or OTP with anyone.`;
    case "phishing_or_social_engineering":
      return "Thank you for reaching out before sharing any information. We never ask for your PIN, OTP, or password under any circumstances. Please do not share these with anyone, even if they claim to be from us. Our fraud risk team will review this incident.";
    case "other":
    default:
      return "Thank you for reaching out. To help you faster, please share the transaction ID, amount, approximate time, and a short description of what went wrong. Please do not share your PIN or OTP with anyone.";
  }
}

export function safeRecommendedNextAction(output) {
  const txId = output.relevant_transaction_id;
  switch (output.case_type) {
    case "wrong_transfer":
      return txId
        ? `Verify ${txId} details with the customer using non-secret information and initiate the wrong-transfer dispute workflow per policy.`
        : "Ask for non-secret details needed to identify the correct transfer before initiating any dispute workflow.";
    case "payment_failed":
      return txId
        ? `Investigate ${txId} ledger status. If balance was deducted on a failed payment, follow the standard eligibility-based reversal flow.`
        : "Ask for transaction ID, amount, and approximate time so payments operations can identify the failed payment.";
    case "refund_request":
      return "Explain that refund eligibility depends on the relevant merchant or service policy and guide the customer through official support steps.";
    case "duplicate_payment":
      return txId
        ? `Verify the suspected duplicate transaction ${txId} with payments operations and follow the eligibility-based resolution workflow.`
        : "Ask for transaction details to identify the possible duplicate payment before starting verification.";
    case "merchant_settlement_delay":
      return txId
        ? `Route ${txId} to merchant operations to verify settlement batch status and communicate an official update.`
        : "Route to merchant operations and ask for settlement batch or transaction details if needed.";
    case "agent_cash_in_issue":
      return txId
        ? `Investigate ${txId} pending/non-reflected cash-in status with agent operations and resolve per standard SLA.`
        : "Ask for cash-in transaction ID, amount, agent information, and approximate time using non-secret details only.";
    case "phishing_or_social_engineering":
      return "Escalate to fraud_risk. Confirm that official support never asks for PIN, OTP, or password, and log reported suspicious details if provided.";
    case "other":
    default:
      return "Ask for specific non-secret details: transaction ID, amount, approximate time, and what went wrong.";
  }
}

export function sanitizeOutput(output, context) {
  const safe = { ...output };

  if (!safe.customer_reply || isUnsafeText(safe.customer_reply)) {
    safe.customer_reply = safeCustomerReply(safe, context);
  }

  if (!safe.recommended_next_action || isUnsafeText(safe.recommended_next_action)) {
    safe.recommended_next_action = safeRecommendedNextAction(safe, context);
  }

  return safe;
}
