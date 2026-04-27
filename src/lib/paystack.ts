import axios from "axios";
import { serverConfig } from "@/server/config";
import type { SupportedCurrency } from "@/types";
import { toSmallestUnit } from "./currency";

const client = axios.create({
  baseURL: "https://api.paystack.co",
  headers: { Authorization: `Bearer ${serverConfig.paystack.secretKey}` },
});

// Map our currency codes to Paystack currency codes
const PAYSTACK_CURRENCY_MAP: Record<SupportedCurrency, string> = {
  NGN: "NGN",
  GBP: "GBP",
  USD: "USD",
  EUR: "EUR", // Note: Paystack may not support EUR directly, may need alternative provider
};

export async function initializePayment(params: {
  email: string;
  amount: number;
  currency: SupportedCurrency;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const amountInSmallestUnit = toSmallestUnit(params.amount, params.currency);
  const paystackCurrency = PAYSTACK_CURRENCY_MAP[params.currency];

  const { data } = await client.post("/transaction/initialize", {
    email: params.email,
    amount: amountInSmallestUnit,
    currency: paystackCurrency,
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
  });
  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

export async function verifyPayment(
  reference: string
): Promise<{
  status: "success" | "failed" | "pending";
  amount: number;
  currency: string;
}> {
  const { data } = await client.get(`/transaction/verify/${reference}`);
  return {
    status: data.data.status,
    amount: data.data.amount,
    currency: data.data.currency,
  };
}
