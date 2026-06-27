import { z } from "zod";

export const createCircleSchema = z.object({
  name: z.string().min(3, "Circle name must be at least 3 characters").max(100, "Circle name must be at most 100 characters"),
  description: z.string().max(500, "Circle description must be at most 500 characters").optional(),
  contributionAmount: z
    .number()
    .min(10, "Minimum contribution is 10 units")
    .max(5_000_000, "Maximum contribution is 5,000,000 units"),
  contributionCurrency: z.enum(["NGN", "GBP", "USD", "EUR"], {
    errorMap: () => ({ message: "Currency must be NGN, GBP, USD, or EUR" }),
  }),
  maxMembers: z.number().int().min(2, "Minimum 2 members").max(20, "Maximum 20 members"),
  cycleFrequency: z.enum(["weekly", "biweekly", "monthly"]),
  circleType: z.enum(["public", "private"]).default("public"),
  gracePeriodHours: z.number().int().min(0).max(168).default(24),
  payoutMethod: z.enum(["fixed", "randomized"]).default("fixed"),
  yieldStrategy: z.enum(["none", "blend"]).default("none"),
  penaltyPercent: z.number().int().min(0).max(100).default(10),
});

export const circleMessageSchema = z.object({
  content: z.string().min(1, "Message content must be at least 1 character").max(1000, "Message content must be at most 1000 characters"),
});

export const createDisputeSchema = z.object({
  reason: z.string().min(1, "Dispute reason must be at least 1 character").max(2000, "Dispute reason must be at most 2000 characters"),
  evidence: z.string().max(2000, "Dispute evidence must be at most 2000 characters").optional(),
  type: z.enum(["missed_payout", "wrong_amount", "other"]).default("other"),
});

export const resolveDisputeSchema = z.object({
  status: z.enum(["resolved", "rejected"]),
  resolutionNotes: z.string().max(2000, "Resolution notes must be at most 2000 characters"),
});

export const joinCircleSchema = z.object({
  circleId: z.string().uuid(),
  stellarPublicKey: z.string().length(56, "Invalid Stellar public key"),
  token: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  otp: z.string().length(6),
});

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number"),
});

export const smsPreferencesSchema = z.object({
  enabled: z.boolean({ invalid_type_error: "enabled must be a boolean" }),
});

export const horizonStreamSchema = z.object({
  action: z.enum(["start", "stop"]),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type CircleMessageInput = z.infer<typeof circleMessageSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type JoinCircleInput = z.infer<typeof joinCircleSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type SmsPreferencesInput = z.infer<typeof smsPreferencesSchema>;
export type HorizonStreamInput = z.infer<typeof horizonStreamSchema>;
