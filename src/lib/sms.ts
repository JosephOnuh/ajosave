import axios from "axios";
import { serverConfig } from "@/server/config";

const client = axios.create({ baseURL: "https://api.ng.termii.com/api" });

export async function sendOtp(phone: string): Promise<string> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await client.post("/sms/send", {
    to: phone,
    from: serverConfig.termii.senderId,
    sms: `Your Ajosave verification code is: ${otp}. Valid for 10 minutes.`,
    type: "plain",
    channel: "generic",
    api_key: serverConfig.termii.apiKey,
  });
  return otp;
}
