import "dotenv/config";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const API_URL = process.env.API_URL || "https://nanogate-arc.onrender.com";
const PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  throw new Error("Missing BUYER_PRIVATE_KEY or PRIVATE_KEY in .env");
}

const targetUrl = `${API_URL}/premium-data`;

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: PRIVATE_KEY as `0x${string}`,
});

console.log("NanoGate Buyer");
console.log("Target:", targetUrl);
console.log("Chain: arcTestnet");

console.log("\nChecking Gateway support...");
const support = await client.supports(targetUrl);

console.log("Support result:");
console.log(JSON.stringify(support, null, 2));

if (!support.supported) {
  console.log("\nThis seller response is not supported by the buyer yet.");
  console.log("The seller is online, but the payment options do not match arcTestnet.");
  console.log("Stop here. Do not pay yet.");
  process.exit(0);
}

console.log("\nChecking balances...");
const balances = await client.getBalances();

console.log("Balances:");
console.log(JSON.stringify(balances, null, 2));

console.log("\nTrying to pay protected route...");
const result = await client.pay(targetUrl);

console.log("Payment result:");
console.log(JSON.stringify(result, null, 2));
