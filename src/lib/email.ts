import fs from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import { serverConfig } from "@/server/config";

// ─── Infrastructure ───────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(process.cwd(), "src/email-templates");
const cache = new Map<string, HandlebarsTemplateDelegate>();

let _transport: nodemailer.Transporter | undefined;

function transport(): nodemailer.Transporter {
  if (!_transport) {
    const { host, port, secure, user, pass } = serverConfig.email;
    _transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }
  return _transport;
}

async function compile(name: string): Promise<HandlebarsTemplateDelegate> {
  if (process.env.NODE_ENV === "production" && cache.has(name)) {
    return cache.get(name)!;
  }
  const src = await fs.readFile(path.join(TEMPLATES_DIR, `${name}.html`), "utf-8");
  const tpl = Handlebars.compile(src);
  if (process.env.NODE_ENV === "production") cache.set(name, tpl);
  return tpl;
}

async function send(
  to: string,
  subject: string,
  templateName: string,
  data: Record<string, unknown>
): Promise<void> {
  const tpl = await compile(templateName);
  const html = tpl({
    ...data,
    appName: serverConfig.app.name,
    appUrl: serverConfig.app.url,
    year: new Date().getFullYear(),
  });
  await transport().sendMail({
    from: `"${serverConfig.app.name}" <${serverConfig.email.from}>`,
    to,
    subject,
    html,
  });
}

const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-6)}`;

// ─── Data types ───────────────────────────────────────────────────────────────

export interface OtpData { otp: string }
export interface WelcomeData { displayName: string }
export interface CircleInviteData {
  displayName: string; circleName: string; inviterName: string;
  contributionNgn: number; frequency: string; maxMembers: number; joinUrl: string;
}
export interface CircleStartedData {
  displayName: string; circleName: string; totalPot: string;
  payoutDate: string; position: number; circleUrl: string;
}
export interface ContributionReminderData {
  displayName: string; circleName: string; amountNgn: number;
  dueDate: string; cycleNumber: number; contributeUrl: string;
}
export interface ContributionConfirmedData {
  displayName: string; circleName: string; amountNgn: number;
  amountUsdc: string; cycleNumber: number; txHash: string; circleUrl: string;
}
export interface PayoutReceivedData {
  displayName: string; circleName: string; amountUsdc: string;
  txHash: string; stellarUrl: string;
}
export interface CircleCompletedData { displayName: string; circleName: string; totalCycles: number }
export interface MissedContributionData {
  displayName: string; circleName: string; cycleNumber: number;
  amountNgn: number; circleUrl: string;
}

// ─── Public send functions ────────────────────────────────────────────────────

export const sendOtpEmail = (to: string, d: OtpData) =>
  send(to, `Your ${serverConfig.app.name} verification code`, "otp", d);

export const sendWelcomeEmail = (to: string, d: WelcomeData) =>
  send(to, `Welcome to ${serverConfig.app.name}!`, "welcome", d);

export const sendCircleInviteEmail = (to: string, d: CircleInviteData) =>
  send(to, `You've been invited to join ${d.circleName}`, "circle-invite", d);

export const sendCircleStartedEmail = (to: string, d: CircleStartedData) =>
  send(to, `${d.circleName} is now active!`, "circle-started", d);

export const sendContributionReminderEmail = (to: string, d: ContributionReminderData) =>
  send(to, `Action required: Contribute to ${d.circleName}`, "contribution-reminder", d);

export const sendContributionConfirmedEmail = (to: string, d: ContributionConfirmedData) =>
  send(to, `Contribution confirmed for ${d.circleName}`, "contribution-confirmed", {
    ...d,
    txHashShort: short(d.txHash),
  });

export const sendPayoutReceivedEmail = (to: string, d: PayoutReceivedData) =>
  send(to, `Payout received from ${d.circleName}!`, "payout-received", {
    ...d,
    txHashShort: short(d.txHash),
  });

export const sendCircleCompletedEmail = (to: string, d: CircleCompletedData) =>
  send(to, `${d.circleName} savings circle complete!`, "circle-completed", d);

export const sendMissedContributionEmail = (to: string, d: MissedContributionData) =>
  send(to, `Missed contribution alert — ${d.circleName}`, "missed-contribution", d);
