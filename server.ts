import "dotenv/config";
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

const app = express();

const PORT = Number(process.env.PORT || 3000);

const SELLER_ADDRESS = process.env.SELLER_ADDRESS;
const RAW_BUYER_PRIVATE_KEY =
  process.env.BUYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

const API_URL = process.env.API_URL || "https://nanogate-arc.onrender.com";
const PRICE = "$0.001";

if (!SELLER_ADDRESS) {
  throw new Error("Missing SELLER_ADDRESS in environment variables.");
}

const BUYER_PRIVATE_KEY =
  RAW_BUYER_PRIVATE_KEY && RAW_BUYER_PRIVATE_KEY.startsWith("0x")
    ? RAW_BUYER_PRIVATE_KEY
    : RAW_BUYER_PRIVATE_KEY
      ? `0x${RAW_BUYER_PRIVATE_KEY}`
      : undefined;

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-PAYMENT, payment-signature, payment-required"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-PAYMENT, payment-signature, payment-required"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });

  next();
});

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: "https://gateway-api-testnet.circle.com",
  networks: ["eip155:5042002"],
});

const gatewayAny = gateway as any;

function safeJson(value: unknown) {
  return JSON.stringify(
    value,
    (_key, val) => (typeof val === "bigint" ? val.toString() : val),
    2
  );
}

function cleanForResponse(value: unknown) {
  return JSON.parse(safeJson(value));
}

app.get("/", (_req, res) => {
  res.json({
    app: "NanoGate Arc",
    status: "online",
    mode: "seller-and-demo-buyer",
    sellerConfigured: true,
    buyerConfigured: Boolean(BUYER_PRIVATE_KEY),
    sellerAddress: SELLER_ADDRESS,
    network: "eip155:5042002",
    facilitatorUrl: "https://gateway-api-testnet.circle.com",
    price: PRICE,
    routes: {
      health: "/health",
      free: "/free",
      premium: "/premium-data",
      demoPay: "/pay-premium-demo",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nanogate-arc",
    status: "healthy",
    network: "eip155:5042002",
    sellerAddress: SELLER_ADDRESS,
    buyerConfigured: Boolean(BUYER_PRIVATE_KEY),
    price: PRICE,
  });
});

app.get("/free", (_req, res) => {
  res.json({
    ok: true,
    type: "free",
    message: "NanoGate free route is online.",
  });
});

app.get(
  "/premium-data",
  gatewayAny.require(PRICE),
  (_req, res) => {
    res.json({
      ok: true,
      type: "paid",
      product: "NanoGate Premium Response",
      price: PRICE,
      paid: true,
      data: {
        signal: "Arc Testnet x402 payment accepted.",
        useCase: "paid API access",
        model: "pay-per-request",
      },
    });
  }
);

app.post("/pay-premium-demo", async (_req, res) => {
  if (!BUYER_PRIVATE_KEY) {
    return res.status(500).json({
      ok: false,
      stage: "config",
      error: "Missing BUYER_PRIVATE_KEY in Render environment variables.",
    });
  }

  try {
    const cleanApiUrl = API_URL.replace(/\/$/, "");
    const targetUrl = `${cleanApiUrl}/premium-data`;

    const client = new GatewayClient({
      chain: "arcTestnet",
      privateKey: BUYER_PRIVATE_KEY as `0x${string}`,
    });

    console.log("Running demo buyer payment...");
    console.log("Target:", targetUrl);

    const balancesBefore = await client.getBalances();

    console.log("Balances before:");
    console.log(safeJson(balancesBefore));

    const paymentResult = await client.pay(targetUrl);

    console.log("Demo payment result:");
    console.log(safeJson(paymentResult));

    const balancesAfter = await client.getBalances();

    console.log("Balances after:");
    console.log(safeJson(balancesAfter));

    return res.json({
      ok: true,
      stage: "paid",
      product: "NanoGate Premium Response",
      targetUrl,
      price: PRICE,
      paid: true,
      result: cleanForResponse(paymentResult),
      balancesBefore: cleanForResponse(balancesBefore),
      balancesAfter: cleanForResponse(balancesAfter),
    });
  } catch (error) {
    console.error("Demo payment failed:");
    console.error(error);

    return res.status(402).json({
      ok: false,
      stage: "payment",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`NanoGate server running on port ${PORT}`);
  console.log(`Health route: /health`);
  console.log(`Free route: /free`);
  console.log(`Paid route: /premium-data`);
  console.log(`Demo pay route: /pay-premium-demo`);
});
