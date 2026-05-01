# NanoGate Arc

Clean rebuild for a paid API access demo on Arc Testnet using Circle Gateway Nanopayments and x402.

## Goal

NanoGate is a simple usage-based API billing demo.

The intended flow is:

1. A free route works normally.
2. A protected route returns `402 Payment Required`.
3. The buyer checks payment support.
4. The buyer deposits USDC into Gateway if needed.
5. The buyer pays for the protected route.
6. The seller returns premium API data after payment.

## Arc Testnet reference

- Supported chain name: `arcTestnet`
- x402 network: `eip155:5042002`
- Chain ID: `5042002`
- Domain: `26`
- Arc USDC: `0x3600000000000000000000000000000000000000`

## Current status

This repo was reset for a clean rebuild.

Previous testing confirmed:

- Seller can run on Render
- Buyer can recognize Arc Testnet support
- Gateway deposit can work
- Final flow must be rebuilt cleanly from the official seller path

## Important

Do not commit private keys.

Use `.env.example` only for public placeholders.
Use `.env` only locally in Codespaces or your machine.
