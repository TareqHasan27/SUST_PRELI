import { normalizePhone } from "./normalize.js";

function validTransactions(transactions = []) {
  return transactions.filter((tx) => tx && typeof tx.transaction_id === "string" && tx.transaction_id.trim());
}

function typePreference(caseType) {
  return {
    wrong_transfer: ["transfer"],
    payment_failed: ["payment"],
    duplicate_payment: ["payment"],
    merchant_settlement_delay: ["settlement"],
    agent_cash_in_issue: ["cash_in"],
    refund_request: ["payment", "refund"],
    phishing_or_social_engineering: [],
    other: []
  }[caseType] || [];
}

function statusSupport(caseType, tx) {
  if (!tx?.status) return 0;
  if (caseType === "payment_failed" && tx.status === "failed") return 2;
  if (caseType === "agent_cash_in_issue" && tx.status === "pending") return 2;
  if (caseType === "merchant_settlement_delay" && tx.status === "pending") return 2;
  if (caseType === "wrong_transfer" && tx.status === "completed") return 2;
  if (caseType === "refund_request" && ["completed", "refund", "reversed"].includes(tx.status)) return 1;
  return 0;
}

function timestampHour(tx) {
  if (!tx?.timestamp) return null;
  const date = new Date(tx.timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours();
}

function timeScore(normalized, tx) {
  const hour = timestampHour(tx);
  if (hour === null || !normalized.hourHints.length) return 0;

  for (const hint of normalized.hourHints) {
    if (hint.type === "hour" && Math.abs(hour - hint.hour) <= 1) return 2;
    if (hint.type === "range" && hour >= hint.startHour && hour < hint.endHour) return 1;
  }
  return 0;
}

function counterpartyScore(normalized, tx) {
  if (!tx?.counterparty || !normalized.phones.length) return 0;
  const txPhone = normalizePhone(tx.counterparty);
  if (!txPhone) return 0;
  return normalized.phones.includes(txPhone) ? 4 : 0;
}

function amountScore(normalized, tx) {
  if (!normalized.amounts.length || typeof tx.amount !== "number") return 0;
  return normalized.amounts.includes(Number(tx.amount)) ? 4 : 0;
}

function hasRepeatedCounterparty(transactions, selectedTx) {
  if (!selectedTx?.counterparty) return false;
  const selectedCounterparty = normalizePhone(selectedTx.counterparty) || selectedTx.counterparty;
  const priorMatches = transactions.filter((tx) => {
    if (!tx || tx.transaction_id === selectedTx.transaction_id) return false;
    if (tx.type !== "transfer") return false;
    const cp = normalizePhone(tx.counterparty || "") || tx.counterparty;
    return cp === selectedCounterparty;
  });
  return priorMatches.length >= 2;
}

function findDuplicatePair(transactions = []) {
  const txs = validTransactions(transactions)
    .filter((tx) => tx.type === "payment" && tx.status === "completed" && typeof tx.amount === "number" && tx.counterparty)
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  for (let i = 0; i < txs.length; i += 1) {
    for (let j = i + 1; j < txs.length; j += 1) {
      const a = txs[i];
      const b = txs[j];
      if (a.amount !== b.amount) continue;
      if (a.counterparty !== b.counterparty) continue;

      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      const bothHaveValidTime = Number.isFinite(ta) && Number.isFinite(tb) && ta > 0 && tb > 0;
      const secondsApart = bothHaveValidTime ? Math.abs(tb - ta) / 1000 : 0;

      // The public sample shows two identical completed payments seconds apart. For robustness,
      // prefer close duplicates but still accept same counterparty/amount pairs if no time is available.
      if (!bothHaveValidTime || secondsApart <= 300) {
        return { original: a, duplicate: b, secondsApart };
      }
    }
  }
  return null;
}

export function matchTransactions(ticket, normalized, intent) {
  const transactions = validTransactions(ticket.transaction_history || []);
  const caseType = intent.case_type;

  if (!transactions.length) {
    return {
      relevant_transaction_id: null,
      selectedTransaction: null,
      ambiguous: false,
      duplicatePair: null,
      repeatedRecipientPattern: false,
      reason: "no_transaction_history",
      scored: []
    };
  }

  if (caseType === "phishing_or_social_engineering") {
    return {
      relevant_transaction_id: null,
      selectedTransaction: null,
      ambiguous: false,
      duplicatePair: null,
      repeatedRecipientPattern: false,
      reason: "safety_only_case",
      scored: []
    };
  }

  if (caseType === "duplicate_payment") {
    const duplicatePair = findDuplicatePair(transactions);
    if (duplicatePair) {
      return {
        relevant_transaction_id: duplicatePair.duplicate.transaction_id,
        selectedTransaction: duplicatePair.duplicate,
        ambiguous: false,
        duplicatePair,
        repeatedRecipientPattern: false,
        reason: "duplicate_pair_match",
        scored: []
      };
    }
  }

  const preferredTypes = typePreference(caseType);
  const scored = transactions.map((tx) => {
    let score = 0;
    const reasons = [];

    const aScore = amountScore(normalized, tx);
    if (aScore) { score += aScore; reasons.push("amount_match"); }

    if (preferredTypes.includes(tx.type)) { score += 3; reasons.push("type_match"); }

    const cScore = counterpartyScore(normalized, tx);
    if (cScore) { score += cScore; reasons.push("counterparty_match"); }

    const sScore = statusSupport(caseType, tx);
    if (sScore) { score += sScore; reasons.push("status_support"); }

    const tScore = timeScore(normalized, tx);
    if (tScore) { score += tScore; reasons.push("time_hint_match"); }

    return { tx, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < 5) {
    return {
      relevant_transaction_id: null,
      selectedTransaction: null,
      ambiguous: false,
      duplicatePair: null,
      repeatedRecipientPattern: false,
      reason: "no_plausible_match",
      scored
    };
  }

  const tied = scored.filter((item) => item.score === top.score);
  const ambiguous = tied.length > 1;
  if (ambiguous) {
    return {
      relevant_transaction_id: null,
      selectedTransaction: null,
      ambiguous: true,
      duplicatePair: null,
      repeatedRecipientPattern: false,
      reason: "multiple_plausible_matches",
      scored
    };
  }

  const repeatedRecipientPattern = caseType === "wrong_transfer" && hasRepeatedCounterparty(transactions, top.tx);

  return {
    relevant_transaction_id: top.tx.transaction_id,
    selectedTransaction: top.tx,
    ambiguous: false,
    duplicatePair: null,
    repeatedRecipientPattern,
    reason: "transaction_match",
    scored
  };
}
