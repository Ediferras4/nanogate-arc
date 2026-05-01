import "dotenv/config";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const API_URL = process.env.API_URL || "https://nanogate-arc.onrender.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.log("Missing PRIVATE_KEY in .env");
  process.exit(0);
}

const targetUrl = `${API_URL}/premium-data`;

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: PRIVATE_KEY as `0x${string}`
});

function safeJson(value: unknown) {
  return JSON.stringify(
    value,
    (_key, val) => (typeof val === "bigint" ? val.toString() : val),
    2
  );
}

console.log("NanoGate Buyer");
console.log("Target:", targetUrl);
console.log("Chain: arcTestnet");

console.log("\nChecking balances...");
const balances = await client.getBalances();
console.log(safeJson(balances));

console.log("\nChecking seller support...");
const support = await client.supports(targetUrl);
console.log(safeJson(support));

console.log("\nDiagnostic finished.");
