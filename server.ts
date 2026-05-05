import "dotenv/config";
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS;
const PRICE = "$0.001";

if (!SELLER_ADDRESS) {
  throw new Error("Missing SELLER_ADDRESS in environment variables.");
}

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
    mode: "manual-verify-settle-debug",
    sellerConfigured: true,
    sellerAddress: SELLER_ADDRESS,
    network: "eip155:5042002",
    facilitatorUrl: "https://gateway-api-testnet.circle.com",
    routes: {
      health: "/health",
      free: "/free",
      premium: "/premium-data",
    },
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nanogate-arc",
    status: "healthy",
  });
});

app.get("/free", (_req, res) => {
  res.json({
    ok: true,
    type: "free",
    message: "NanoGate free route is online.",
  });
});

app.get("/premium-data", async (req, res, next) => {
  const paymentHeader = req.headers["payment-signature"];

  console.log("----- /premium-data request -----");
  console.log("sellerAddress:", SELLER_ADDRESS);
  console.log("has payment-signature:", Boolean(paymentHeader));

  if (!paymentHeader) {
    console.log("No payment yet. Returning normal 402 challenge.");

    return gatewayAny.require(PRICE)(req, res, next);
  }

  try {
    const paymentRaw = Array.isArray(paymentHeader)
      ? paymentHeader[0]
      : paymentHeader;

    const decoded = JSON.parse(
      Buffer.from(String(paymentRaw), "base64").toString("utf8")
    );

    console.log("decoded payment payload:");
    console.log(JSON.stringify(decoded, null, 2));

    console.log("Running gateway.verify...");
    const verifyResult = await gatewayAny.verify(decoded);

    console.log("verifyResult:");
    console.log(JSON.stringify(verifyResult, null, 2));

    if (!verifyResult.valid) {
      console.log("Verification failed. Returning 402 with verifyResult.");

      return res.status(402).json({
        ok: false,
        stage: "verify",
        verifyResult,
      });
    }

    console.log("Verification passed. Running gateway.settle...");
    const settleResult = await gatewayAny.settle(decoded);

    console.log("settleResult:");
    console.log(JSON.stringify(settleResult, null, 2));

    if (!settleResult.success) {
      console.log("Settlement failed. Returning 402 with settleResult.");

      return res.status(402).json({
        ok: false,
        stage: "settle",
        settleResult,
      });
    }

    return res.json({
      ok: true,
      type: "paid",
      product: "NanoGate Premium Data",
      price: PRICE,
      paid: true,
      verifyResult,
      settleResult,
      data: {
        signal: "Arc Testnet x402 payment accepted.",
        useCase: "paid API access",
        model: "pay-per-request",
      },
    });
  } catch (error) {
    console.error("Payment handling error:");
    console.error(error);

    return res.status(402).json({
      ok: false,
      stage: "exception",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`NanoGate server running on http://localhost:${PORT}`);
  console.log(`Health route: http://localhost:${PORT}/health`);
  console.log(`Free route: http://localhost:${PORT}/free`);
  console.log(`Paid route: http://localhost:${PORT}/premium-data`);
});
