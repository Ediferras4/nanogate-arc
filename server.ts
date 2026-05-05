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
    mode: "middleware-protected-route",
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

app.get(
  "/premium-data",
  gatewayAny.require(PRICE),
  (_req, res) => {
    res.json({
      ok: true,
      type: "paid",
      product: "NanoGate Premium Data",
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

app.listen(PORT, () => {
  console.log(`NanoGate server running on port ${PORT}`);
  console.log(`Health route: /health`);
  console.log(`Free route: /free`);
  console.log(`Paid route: /premium-data`);
});
