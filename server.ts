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
const DEMO_PAYMENT_LIMIT = 30;

if (!SELLER_ADDRESS) {
  throw new Error("Missing SELLER_ADDRESS in environment variables.");
}

const BUYER_PRIVATE_KEY =
  RAW_BUYER_PRIVATE_KEY && RAW_BUYER_PRIVATE_KEY.startsWith("0x")
    ? RAW_BUYER_PRIVATE_KEY
    : RAW_BUYER_PRIVATE_KEY
      ? `0x${RAW_BUYER_PRIVATE_KEY}`
      : undefined;

type Usage = {
  count: number;
  lastPaymentAt: string | null;
};

const walletUsage = new Map<string, Usage>();

function normalizeWallet(value: unknown) {
  if (typeof value !== "string") return null;

  const wallet = value.trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return null;
  }

  return wallet.toLowerCase();
}

function getUsage(wallet: string) {
  const existing = walletUsage.get(wallet);

  if (existing) {
    return existing;
  }

  const fresh: Usage = {
    count: 0,
    lastPaymentAt: null,
  };

  walletUsage.set(wallet, fresh);

  return fresh;
}

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
    demoPaymentLimit: DEMO_PAYMENT_LIMIT,
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
    demoPaymentLimit: DEMO_PAYMENT_LIMIT,
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

app.post("/pay-premium-demo", async (req, res) => {
  const connectedWallet = normalizeWallet(req.body?.wallet);

  if (!connectedWallet) {
    return res.status(400).json({
      ok: false,
      stage: "wallet",
      error: "Missing or invalid connected wallet address.",
    });
  }

  const usage = getUsage(connectedWallet);

  if (usage.count >= DEMO_PAYMENT_LIMIT) {
    return res.status(429).json({
      ok: false,
      stage: "limit",
      error: `Demo payment limit reached for this wallet. Limit: ${DEMO_PAYMENT_LIMIT}.`,
      wallet: connectedWallet,
      used: usage.count,
      limit: DEMO_PAYMENT_LIMIT,
      remaining: 0,
    });
  }

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
    console.log("Connected wallet:", connectedWallet);
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

    usage.count += 1;
    usage.lastPaymentAt = new Date().toISOString();
    walletUsage.set(connectedWallet, usage);

    const remaining = Math.max(DEMO_PAYMENT_LIMIT - usage.count, 0);

    return res.json({
      ok: true,
      stage: "paid",
      product: "NanoGate Premium Response",
      targetUrl,
      price: PRICE,
      paid: true,
      connectedWallet,
      walletUsage: {
        used: usage.count,
        limit: DEMO_PAYMENT_LIMIT,
        remaining,
        lastPaymentAt: usage.lastPaymentAt,
      },
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
      wallet: connectedWallet,
      used: usage.count,
      limit: DEMO_PAYMENT_LIMIT,
      remaining: Math.max(DEMO_PAYMENT_LIMIT - usage.count, 0),
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
