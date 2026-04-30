import "dotenv/config";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const API_URL = process.env.API_URL || "https://nanogate-arc.onrender.com";
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;

if (!BUYER_PRIVATE_KEY) {
  throw new Error("Missing BUYER_PRIVATE_KEY in environment variables.");
}

const client = new GatewayClient({
  chain: "arcTestnet",
  privateKey: BUYER_PRIVATE_KEY,
});

const premiumUrl = `${API_URL.replace(/\/$/, "")}/premium-data`;

console.log("NanoGate Buyer");
console.log(`Paying route: ${premiumUrl}`);

const { data, status } = await client.pay(premiumUrl);

console.log(`Status: ${status}`);
console.log("Data:", data);
