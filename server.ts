import "dotenv/config";
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS;

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
});

app.get("/", (_req, res) => {
  res.json({
    app: "NanoGate Arc",
    status: "online",
    mode: "simple-circle-gateway-middleware-all-networks",
    sellerConfigured: true,
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

app.get("/premium-data", gateway.require("$0.001"), (req, res) => {
  const payment = (req as any).payment;

  res.json({
    ok: true,
    type: "paid",
    product: "NanoGate Premium Data",
    price: "$0.001 USDC",
    paid: true,
    payment: payment || null,
    data: {
      signal: "Arc Testnet x402 payment accepted.",
      useCase: "paid API access",
      model: "pay-per-request",
    },
  });
});

app.listen(PORT, () => {
  console.log(`NanoGate server running on http://localhost:${PORT}`);
  console.log(`Health route: http://localhost:${PORT}/health`);
  console.log(`Free route: http://localhost:${PORT}/free`);
  console.log(`Paid route: http://localhost:${PORT}/premium-data`);
});
