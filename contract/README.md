# BidShield contract

One Compact contract instance is one tender. Suppliers commit a private bid (amount, salt, document hash) before close; after the commit window they reveal; the organizer records an award after the reveal window.

Compiled with Compact **0.31.1** for Midnight Preview (ledger 8 / Midnight.js **4.1.1**).

## Layout

```
contract/
  src/bidshield.compact     Compact source
  src/witnesses.ts          localBidderSecret / localOrganizerSecret
  managed/bidshield/        compact compile output (keys, zkir, JS)
  scripts/deploy.ts         Preview deploy
  scripts/copy-to-frontend.ts
  deployed/                 public JSON + zk-assets (private/ is gitignored)
  docker-compose.yml        local proof server
  .env.example
```

After a successful deploy, `scripts/copy-to-frontend.ts` copies **public** artifacts into `frontend/src/contracts` and ZK keys into `frontend/public/zk/bidshield`. Organizer secrets stay in `deployed/private/` and are never copied.

## Prerequisites

- Node.js 22+
- Compact toolchain 0.31.1 on `PATH`

  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf \
    https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
  source "$HOME/.local/bin/env"
  compact update 0.31.1
  compact compile --version   # 0.31.1
  ```

- Docker, for the proof server (`midnightntwrk/proof-server:8.1.3`)
- A Preview wallet funded with tNIGHT (then registered for DUST)

## Deploy to Midnight Preview

From the **repository root**:

```bash
# 1. Install contract packages (this folder is not an npm workspace)
cd contract && npm install && cd ..

# 2. Compile Compact → contract/managed/bidshield
npm run compile

# 3. Proof server (must stay running; it sees witness data, so keep it local)
cd contract && docker compose up -d && cd ..
# or: npm run proof-server:start

# 4. Wallet seed — copy contract/.env.example → contract/.env
#    WALLET_SEED="<24-word BIP-39 phrase>"
#    or MIDNIGHT_WALLET_SEED=<32-128 hex chars>
#    Do not set both.

# 5. Deploy. The script prints an mn_addr_preview… address if the wallet
#    has no tNIGHT. Fund it at:
#    https://midnight-tmnight-preview.nethermind.dev/
#    then re-run. Registered NIGHT generates DUST for fees.
npm run deploy:preview
```

`npm run deploy:preview` will:

1. Sync the wallet against Preview
2. Register NIGHT for DUST if needed
3. Prove and submit the constructor (`organizerSecret`, `tenderId`, `policyHash`, commit/reveal windows)
4. Write `contract/deployed/preview.json` and related files
5. Copy public outputs into `frontend/src/contracts`

To copy again without redeploying:

```bash
npm run copy:frontend
```

## What the frontend receives

| Path | Import |
| --- | --- |
| `frontend/src/contracts/preview.json` | address, network, public tender windows |
| `frontend/src/contracts/frontend-config.json` | `VITE_*` keys |
| `frontend/src/contracts/circuits.json` | circuit signatures |
| `frontend/src/contracts/index.ts` | typed barrel (`preview`, `CONTRACT_ADDRESS`, `TENDER`) |
| `frontend/public/zk/bidshield` | prover/verifier keys + zkir |

## Optional constructor env

Set these in `contract/.env` before deploy (unix **seconds**):

```
COMMIT_START=
COMMIT_END=
REVEAL_END=
TENDER_ID=        # 64 hex chars, or any string hashed with SHA-256
POLICY_HASH=
```

Defaults: commit already open, commit ends in 7 days, reveal ends in 14 days.

## Security

- `contract/.env` and `contract/deployed/private/` are gitignored.
- Never put `WALLET_SEED` or `organizerSecret` in `frontend/src/contracts`.
- A commitment proves a later reveal matches; it does not prove the bid is truthful, the document is authentic, or the buyer chose fairly.
