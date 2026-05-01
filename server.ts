import "dotenv/config";
import express from "express";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const SELLER_ADDRESS = process.env.SELLER_ADDRESS || "not-configured";

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
    mode: "clean-rebuild",
    sellerConfigured: SELLER_ADDRESS !== "not-configured",
    routes: {
      health: "/health",
      free: "/free",
      premium: "/premium-data"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "nanogate-arc",
    status: "healthy"
  });
});

app.get("/free", (_req, res) => {
  res.json({
    ok: true,
    type: "free",
    message: "NanoGate free route is online."
  });
});

app.get("/premium-data", (_req, res) => {
  res.status(501).json({
    ok: false,
    type: "premium",
    message: "Premium x402 route will be rebuilt cleanly from the official seller flow."
  });
});

app.listen(PORT, () => {
  console.log(`NanoGate server running on http://localhost:${PORT}`);
  console.log(`Health route: http://localhost:${PORT}/health`);
  console.log(`Free route: http://localhost:${PORT}/free`);
  console.log(`Premium route: http://localhost:${PORT}/premium-data`);
});
