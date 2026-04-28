import {
  Horizon,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";

const server = new Horizon.Server(serverConfig.stellar.horizonUrl);
const USDC = new Asset(serverConfig.usdc.assetCode, serverConfig.usdc.issuer);
const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/** Error codes that are safe to retry (transient). */
function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    // Horizon 503 / network timeouts are retryable; bad sequence / auth errors are not
    if (msg.includes("bad_seq") || msg.includes("tx_bad_seq")) return false;
    if (msg.includes("network") || msg.includes("503") || msg.includes("timeout")) return true;
  }
  // Retry on unknown errors by default
  return true;
}

/**
 * Send USDC to `destination`.
 *
 * Issue #19: retries up to 3 times with exponential backoff on transient errors.
 * Issue #20: `loadAccount` is called inside the retry loop so each attempt uses
 *            a fresh sequence number — preventing tx_bad_seq on concurrent payouts.
 */
export async function sendUsdcPayment(destination: string, amount: string): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Issue #20: fetch fresh account (and sequence number) on every attempt
      const account = await server.loadAccount(keypair.publicKey());

      const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
        .addOperation(Operation.payment({ destination, asset: USDC, amount }))
        .setTimeout(30)
        .build();

      tx.sign(keypair);
      const result = await server.submitTransaction(tx);
      return result.hash;
    } catch (err) {
      const fatal = !isRetryable(err);
      console.error(`[stellar] sendUsdcPayment attempt ${attempt}/${MAX_RETRIES} failed:`, err);

      if (fatal || attempt === MAX_RETRIES) throw err;

      // Exponential backoff: 500 ms, 1000 ms, 2000 ms …
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("sendUsdcPayment: exhausted retries");
}

/**
 * Issue #17: Returns balance AND trustline existence for USDC on the given account.
 */
export async function getUsdcBalance(
  publicKey: string
): Promise<{ balance: string; hasTrustline: boolean }> {
  try {
    const account = await server.loadAccount(publicKey);
    const bal = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        (b as { asset_code: string; asset_issuer: string }).asset_code === USDC.getCode() &&
        (b as { asset_code: string; asset_issuer: string }).asset_issuer === USDC.getIssuer()
    );
    return { balance: bal?.balance ?? "0", hasTrustline: !!bal };
  } catch {
    return { balance: "0", hasTrustline: false };
  }
}

export { server as horizonServer, USDC, networkPassphrase };
