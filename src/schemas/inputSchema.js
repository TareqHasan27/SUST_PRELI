import { z } from "zod";
import {
  CHANNELS,
  LANGUAGES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  USER_TYPES
} from "../config/enums.js";

export const transactionSchema = z.object({
  transaction_id: z.string().min(1).optional(),
  timestamp: z.string().optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  amount: z.number().optional(),
  counterparty: z.string().optional(),
  status: z.enum(TRANSACTION_STATUSES).optional()
}).passthrough();

export const inputSchema = z.object({
  ticket_id: z.string().min(1, "ticket_id is required"),
  complaint: z.string({ required_error: "complaint is required" }),
  language: z.enum(LANGUAGES).optional(),
  channel: z.enum(CHANNELS).optional(),
  user_type: z.enum(USER_TYPES).optional(),
  campaign_context: z.string().optional(),
  transaction_history: z.array(transactionSchema).optional().default([]),
  metadata: z.record(z.unknown()).optional()
}).passthrough();
