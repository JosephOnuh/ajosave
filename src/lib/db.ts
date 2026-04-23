/**
 * Thin PostgreSQL client wrapper.
 *
 * ALL queries MUST go through `query()` or `transaction()`.
 * String interpolation into SQL is NEVER allowed — use $1, $2, … placeholders.
 *
 * Example (correct):
 *   await query('SELECT * FROM circles WHERE id = $1', [id])
 *
 * Example (WRONG — never do this):
 *   await query(`SELECT * FROM circles WHERE id = '${id}'`)
 */
import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { serverConfig } from "@/server/config";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: serverConfig.database.url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: serverConfig.stellar.network === "mainnet" ? { rejectUnauthorized: true } : false,
    });
  }
  return pool;
}

/**
 * Execute a parameterized query.
 * @param text  SQL with $1, $2, … placeholders — never interpolate user input
 * @param params  Values bound to placeholders
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Run multiple queries in a single transaction.
 * Rolls back automatically on error.
 */
export async function transaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const boundQuery = <R extends QueryResultRow>(text: string, params?: unknown[]) =>
      client.query<R>(text, params);
    const result = await fn(boundQuery as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
