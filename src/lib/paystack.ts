import axios from "axios";
import { serverConfig } from "@/server/config";

const client = axios.create({
  baseURL: "https://api.paystack.co",
  headers: { Authorization: `Bearer ${serverConfig.paystack.secretKey}` },
});

export async function initializePayment(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  const { data } = await client.post("/transaction/initialize", {
    email: params.email,
    amount: params.amountKobo,
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
  });
  return { authorizationUrl: data.data.authorization_url, reference: data.data.reference };
}

export async function verifyPayment(
  reference: string
): Promise<{ status: "success" | "failed" | "pending"; amountKobo: number }> {
  const { data } = await client.get(`/transaction/verify/${reference}`);
  return { status: data.data.status, amountKobo: data.data.amount };
}

export const ngnToKobo = (ngn: number) => Math.round(ngn * 100);
