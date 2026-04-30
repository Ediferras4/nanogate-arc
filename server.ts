import "dotenv/config";
import express from "express";
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS;

if (!SELLER_ADDRESS) {
  throw new Error("Missing SELLER_ADDRESS in environment variables.");
}

const facilitator = new BatchFacilitatorClient();

const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_GATEWAY_WALLET = "0x0077777dEBA4688BDeF3E311b846F25870A19B9";

// $0.001 USDC = 1000 base units because USDC has 6 decimals.
const PREMIUM_AMOUNT = "1000";

const premiumPaymentRequirement = {
  scheme: "exact",
  network: ARC_TESTNET_NETWORK,
  asset: ARC_TESTNET_USDC,
  amount: PREMIUM_AMOUNT,
  maxTimeoutSeconds: 345600,
  payTo: SELLER_ADDRESS,
  extra: {
    name: "GatewayWalletBatched",
    version: "1",
    verifyingContract: ARC_GATEWAY_WALLET,
  },
};

function encodePaymentRequired(payload: unknown) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });

  next();
});

app.get("/", (_req, res) => {
  res.json({
    app: "NanoGate Arc",
    status: "online",
    message:
      "Paid API access demo on Arc Testnet using x402 and Circle Gateway Nanopayments.",
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
    message: "This route is free. NanoGate is alive.",
  });
});

app.get("/premium-data", async (req, res) => {
  const signature =
    req.headers["payment-signature"] ||
    req.headers["PAYMENT-SIGNATURE".toLowerCase()];

  const paymentRequiredPayload = {
    x402Version: 2,
    accepts: [premiumPaymentRequirement],
  };

  if (!signature || typeof signature !== "string") {
    res.setHeader("payment-required", encodePaymentRequired(paymentRequiredPayload));

    return res.status(402).json(paymentRequiredPayload);
  }

  try {
    const paymentPayload = JSON.parse(
      Buffer.from(signature, "base64").toString("utf8")
    );

    const settlement = await facilitator.settle(
      paymentPayload,
      premiumPaymentRequirement
    );

    if (!settlement.success) {
      console.log("Settlement failed:", settlement);

      res.setHeader("payment-required", encodePaymentRequired(paymentRequiredPayload));

      return res.status(402).json({
        error: "Settlement failed",
        settlement,
      });
    }

    return res.json({
      ok: true,
      type: "paid",
      product: "NanoGate Premium Data",
      network: "arcTestnet",
      chain: ARC_TESTNET_NETWORK,
      price: "$0.001 USDC",
      message: "Payment accepted. Premium API response unlocked.",
      data: {
        signal: "Arc Nanopayments demo",
        useCase: "paid API access",
        model: "pay-per-call",
        proof: "NanoGate unlocked this response through x402.",
      },
    });
  } catch (error) {
    console.error("Payment handling error:", error);

    res.setHeader("payment-required", encodePaymentRequired(paymentRequiredPayload));

    return res.status(402).json({
      error: "Invalid payment signature or settlement error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`NanoGate server running on http://localhost:${PORT}`);
  console.log(`Health route: http://localhost:${PORT}/health`);
  console.log(`Free route: http://localhost:${PORT}/free`);
  console.log(`Paid route: http://localhost:${PORT}/premium-data`);
});
