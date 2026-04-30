import "dotenv/config";
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS;

if (!SELLER_ADDRESS) {
  throw new Error("Missing SELLER_ADDRESS in environment variables.");
}

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
});

app.get("/", (_req, res) => {
  res.json({
    app: "NanoGate Arc",
    status: "online",
    message: "Paid API access demo on Arc Testnet using x402 and Circle Gateway Nanopayments.",
    routes: {
      free: "/free",
      premium: "/premium-data",
    },
  });
});

app.get("/free", (_req, res) => {
  res.json({
    ok: true,
    type: "free",
    message: "This route is free. NanoGate is alive.",
  });
});

app.get(
  "/premium-data",
  gateway.require("0.001"),
  (_req, res) => {
    res.json({
      ok: true,
      type: "paid",
      product: "NanoGate Premium Data",
      network: "arcTestnet",
      price: "0.001 USDC",
      message: "Payment accepted. Premium API response unlocked.",
      data: {
        signal: "Arc Nanopayments demo",
        useCase: "paid API access",
        model: "pay-per-call",
      },
    });
  }
);

app.listen(PORT, () => {
  console.log(`NanoGate server running on http://localhost:${PORT}`);
  console.log(`Free route: http://localhost:${PORT}/free`);
  console.log(`Paid route: http://localhost:${PORT}/premium-data`);
});
