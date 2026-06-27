import { contract, Keypair, Networks } from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";
import { wrapWithFeeBump } from "@/lib/stellar";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { randomUUID } from "crypto";
import { query } from "@/lib/db";

const networkPassphrase =
  serverConfig.stellar.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

const rpcUrl = serverConfig.stellar.sorobanRpcUrl;
const networkFlag =
  serverConfig.stellar.network === "mainnet"
    ? `--network-passphrase "Public Global Stellar Network ; September 2015"`
    : `--network-passphrase "Test SDF Network ; September 2015"`;

/**
 * Fetch contract events from Soroban RPC for indexing and auditing.
 * Filters events by contract ID and optionally by start ledger.
 *
 * @param contractId - The contract to fetch events for
 * @param startLedger - Optional ledger number to start from (for pagination)
 * @param pageSize - Maximum number of events to return (default 100)
 * @returns Array of events with topic, value, and metadata
 */
export async function getContractEvents(
  contractId: string,
  startLedger?: number,
  pageSize: number = 100
): Promise<ContractEvent[]> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getEvents",
      params: {
        start: {
          ledger: startLedger ?? 0,
          pagingToken: "0",
        },
        filters: [
          {
            contractId,
            ...(startLedger ? { startLedger } : {}),
          },
        ],
        limit: pageSize,
      },
    }),
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }

  return result.result.events.map((e: any) => ({
    topic: e.topic,
    value: e.value,
    ledger: e.ledger,
    timestamp: e.timestamp,
    transactionHash: e.transactionHash,
  }));
}

/**
 * Process contract events for backend indexing.
 * Parses event topics and routes to appropriate handlers.
 */
export async function processContractEvents(
  contractId: string,
  lastProcessedLedger?: number
): Promise<void> {
  const events = await getContractEvents(contractId, lastProcessedLedger);

  for (const event of events) {
    const topic = event.topic?.[0];
    if (!topic) continue;

    switch (topic) {
      case "member_joined":
        await handleMemberJoined(event.value);
        break;
      case "contribution_made":
        await handleContributionMade(event.value, event.transactionHash);
        break;
      case "payout_sent":
        await handlePayoutSent(event.value, event.transactionHash);
        break;
      case "circle_completed":
        await handleCircleCompleted(event.value);
        break;
      case "member_defaulted":
        await handleMemberDefaulted(event.value);
        break;
    }
  }
}

async function handleMemberJoined(value: any): Promise<void> {
  if (!value?.circle_id || !value?.member_address) return;
  await query(
    `UPDATE members m
     SET status = 'active'
     FROM users u
     WHERE m.user_id = u.id
       AND m.circle_id = $1
       AND u.stellar_public_key = $2
       AND m.status != 'active'`,
    [value.circle_id, value.member_address]
  );
}

async function handleContributionMade(value: any, txHash: string): Promise<void> {
  if (!value?.circle_id) return;
  await query(
    `UPDATE contributions c
     SET status = 'confirmed', tx_hash = $1
     FROM members m
     WHERE c.member_id = m.id
       AND c.status = 'pending'
       AND (c.tx_hash = $1 OR (
             m.circle_id = $2
             AND ($3::int IS NULL OR c.cycle_number = $3)
             AND ($4::text IS NULL OR c.amount_usdc = $4)
           ))`,
    [txHash, value.circle_id, value.cycle ?? null, value.amount?.toString() ?? null]
  );
}

async function handlePayoutSent(value: any, txHash: string): Promise<void> {
  if (!value?.circle_id || !value?.cycle) return;
  const { rows: members } = await query<{ id: string }>(
    `SELECT m.id FROM members m
     JOIN users u ON u.id = m.user_id
     WHERE m.circle_id = $1
       AND u.stellar_public_key = $2`,
    [value.circle_id, value.recipient_address ?? null]
  );
  if (!members[0]) return;
  const memberId = members[0].id;
  await query(
    `INSERT INTO payouts
       (id, circle_id, recipient_member_id, cycle_number, amount_usdc, tx_hash, paid_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (circle_id, cycle_number) DO NOTHING`,
    [randomUUID(), value.circle_id, memberId, value.cycle, value.amount?.toString() ?? "0", txHash]
  );
  await query(
    "UPDATE members SET has_received_payout = true WHERE id = $1",
    [memberId]
  );
}

async function handleCircleCompleted(value: any): Promise<void> {
  if (!value?.circle_id) return;
  await query(
    "UPDATE circles SET status = 'completed', updated_at = NOW() WHERE id = $1 AND status != 'completed'",
    [value.circle_id]
  );
}

async function handleMemberDefaulted(value: any): Promise<void> {
  if (!value?.circle_id || !value?.member_address) return;
  await query(
    `UPDATE members m
     SET status = 'defaulted'
     FROM users u
     WHERE m.user_id = u.id
       AND m.circle_id = $1
       AND u.stellar_public_key = $2`,
    [value.circle_id, value.member_address]
  );
}

export interface ContractEvent {
  topic: string[];
  value: any;
  ledger: number;
  timestamp: number;
  transactionHash: string;
}

/**
 * Deploy a new Ajo contract instance via the Stellar CLI.
 * Returns the deployed contract ID.
 *
 * Estimated deploy cost: ~0.01 XLM in transaction fees on testnet.
 * On mainnet, expect ~0.01–0.05 XLM depending on network congestion.
 */
export async function deployAjoContract(): Promise<string> {
  const wasmPath = path.resolve(
    process.cwd(),
    "contracts/target/wasm32-unknown-unknown/release/ajosave_ajo.wasm"
  );

  if (!fs.existsSync(wasmPath)) {
    throw new Error(
      "Ajo contract WASM not found. Run `npm run contract:build` first."
    );
  }

  const sourceKey = serverConfig.stellar.serverSecretKey;
  if (!sourceKey) {
    throw new Error("STELLAR_SERVER_SECRET_KEY is not set.");
  }

  const output = execSync(
    `stellar contract deploy --wasm ${wasmPath} --source-account $STELLAR_SECRET_KEY --rpc-url ${rpcUrl} ${networkFlag}`,
    {
      encoding: "utf-8",
      env: { ...process.env, STELLAR_SECRET_KEY: sourceKey },
    }
  );

  const contractId = output.trim();
  if (!contractId) {
    throw new Error("Contract deployment returned empty contract ID.");
  }

  console.info(`[Soroban] Deployed new Ajo contract: ${contractId}`);
  return contractId;
}

/**
 * Invoke AjoContract.payout() via Soroban RPC.
 * The contract handles the token transfer; the backend only triggers it.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @returns The Soroban transaction hash
 */
export async function invokeContractPayout(contractId: string): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // payout() takes no args — admin auth is checked inside the contract
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.payout();
  
  // Wrap the inner transaction in a platform fee bump so users need no XLM
  const innerXdr: string = assembled.toXDR();
  return wrapWithFeeBump(innerXdr);
}

/**
 * Invoke AjoContract.set_payout_order() via Soroban RPC.
 * Sets the randomized payout order on the smart contract.
 *
 * @param contractId - The deployed Ajo contract address for this circle
 * @param payoutOrder - Array of member indices in desired payout order
 * @returns The Soroban transaction hash
 */
export async function invokeContractSetPayoutOrder(
  contractId: string,
  payoutOrder: number[]
): Promise<string> {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const signer = contract.basicNodeSigner(keypair, networkPassphrase);

  const client = await contract.Client.from({
    contractId,
    networkPassphrase,
    rpcUrl: serverConfig.stellar.sorobanRpcUrl,
    publicKey: keypair.publicKey(),
    ...signer,
  });

  // set_payout_order(order: Vec<u32>)
  // @ts-expect-error — method generated from contract ABI at runtime
  const assembled = await client.set_payout_order({ order: payoutOrder });
  
  // Wrap the inner transaction in a platform fee bump so users need no XLM
  const innerXdr: string = assembled.toXDR();
  return wrapWithFeeBump(innerXdr);
}
