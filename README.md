# 🛡️ BidShield

**Privacy-preserving, zero-knowledge tender workflow on the Midnight Network.**

BidShield is a decentralized application (dApp) that uses zero-knowledge (ZK) proofs to create a tamper-proof, front-running-resistant procurement process. It allows suppliers to submit sealed bids that cannot be leaked, altered, or denied, while providing an unforgeable public audit trail.

---

## 🛑 The Problem: Broken Public Procurement
When governments or large corporations issue a tender (RFP), the procurement process requires extreme integrity. Unfortunately, traditional systems rely entirely on trusting the database administrator or procurement officers.

1. **Bid Leaking (Front-running):** Corrupt insiders secretly view submitted bids and leak the lowest price to a favored supplier before the deadline.
2. **Late Alterations:** Suppliers claim their "original" bid was actually lower after seeing competitors' numbers.
3. **Document Tampering:** Winning proposals are secretly swapped in the database to justify a biased award.
4. **No Audit Trail:** Years later, journalists or auditors cannot cryptographically prove who bid what, or when.

The OECD estimates that global public procurement fraud costs **$2 trillion per year**.

---

## 💡 The Solution: BidShield
BidShield introduces a **cryptographic commitment layer** over the standard procurement workflow. It does not replace human evaluation; rather, it forces all participants to cryptographically commit to their actions.

Using the **Midnight Network's Compact ZK circuits**, BidShield guarantees:
* **Pre-deadline Privacy:** Bids are sealed. Not even the buyer or the blockchain nodes can see the bid amount or document.
* **Post-deadline Integrity:** Suppliers must reveal the *exact* data they committed to. ZK proofs ensure a mathematically guaranteed match.
* **Permanent Auditability:** Every commitment timestamp, revealed price, and award rationale hash is permanently recorded on the Midnight ledger.

---

## 🎯 What Makes BidShield Unique? (Best Value vs. Auto-Lowest)
Most blockchain procurement concepts fail because they try to *automatically award the lowest bidder*. Real-world procurement doesn't work that way. Buyers must verify off-chain compliance (e.g., ISO certifications, safety records) before looking at price.

**BidShield solves this elegantly:**
1. Suppliers commit a Hash of their Price + Compliance Documents.
2. After revealing, the Buyer evaluates the actual documents off-chain.
3. The Buyer disqualifies non-compliant bids, and uses their cryptographic secret to call the `recordAward` circuit on Midnight, locking in the winner based on **Best Value**, not just lowest price.

---

## ⚙️ The Three-Phase Protocol

1. **Commit Window:** Suppliers upload documents offline, hash them, and generate a secret `Salt`. The dApp submits a ZK proof to Midnight containing `Hash(Amount + DocHash + Salt)`. **Nothing is public yet.**
2. **Reveal Window:** After bidding closes, suppliers input their Amount, DocHash, and Salt. The Midnight contract recomputes the hash. If it matches the ledger, the ZK proof passes, and the Amount and DocHash become **Public**.
3. **Award Phase:** The Organizer selects the winning revealed bid and records the award on-chain, closing the tender permanently.

---

## 🏗️ Architecture & Tech Stack

BidShield uses a **Hybrid Architecture** to ensure the blockchain only stores cryptographic truths, while a traditional database handles rich text for a blazing-fast UI.

* **Midnight Network (Source of Truth):** Stores the `policyHash` of the tender, timing windows, sealed commitments, revealed bids, and the final award.
* **Backend (Express + MongoDB):** The "Read Model". Stores human-readable RFP descriptions, titles, and requirements. If the DB is wiped, the integrity of the bids remains safe on Midnight.
* **Frontend (React + Vite):** Generates local salts, creates JSON backups for users, and integrates with the Lace wallet.

### File Structure
```text
bidshield/
├── backend/                  # Node.js + Express API (Tender Read Model)
│   ├── src/
│   │   ├── models/           # MongoDB Schemas (Tender, Bid)
│   │   ├── routes/           # REST endpoints
│   │   └── index.js          # Express Server
│   └── scripts/clear-db.js   # DB reset utility
│
├── contract/                 # Midnight ZK Smart Contracts
│   ├── src/bidshield.compact # The core ZK circuit logic (Compact 0.5.3)
│   ├── scripts/              # Compilation & Deployment scripts
│   └── shims/                # Local runtime shims
│
└── frontend/                 # React dApp (Tailwind v4)
    ├── src/pages/            # Tenders List, Tender Detail, My Bids
    ├── src/components/       # UI (Countdown, StatusBadges, GlassCards)
    └── src/lib/lace.ts       # Midnight Lace wallet integration
```

---

## 🚀 Getting Started (Local Setup)

### Prerequisites
* Node.js v20+
* [Lace Wallet Browser Extension](https://www.lace.io/) (configured to Midnight Preview)
* MongoDB Atlas Cluster (Free tier)

### 1. Backend Setup
```bash
cd backend
npm install

# Create a .env file and add your MongoDB connection string:
# MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/bidshield?retryWrites=true&w=majority
# PORT=8787

npm run dev
```

### 2. Contract Setup & Compilation
```bash
cd contract
npm install

# Compile the Compact ZK circuits (.compact -> .zkir & .js)
npm run compile
npm run copy-artifacts
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Create a .env file:
# VITE_API_URL=http://localhost:8787

# Start the Vite dev server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🛣️ Roadmap & Future Enhancements

While this MVP proves the cryptographic workflow and data architecture, future iterations will include:
1. **Live ZK Proving via SDK:** Transitioning the frontend from simulated circuit timeouts to executing live ZK proofs via `@midnight-ntwrk/midnight-js-contracts`.
2. **Decentralized Storage:** Integrating IPFS/Arweave + AES-GCM client-side encryption directly into the Commit form so documents are automatically uploaded and hashed.
3. **Live Indexer Integration:** Wiring the Tender page to query the Midnight GraphQL indexer for real-time ledger state updates, bypassing the MongoDB read model entirely for bid verification.

---

*Built for the Midnight Hackathon.*
```