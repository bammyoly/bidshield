# BidShield frontend

React + TypeScript + Vite + Tailwind. Routed glass console for the Preview tender, with a Lace / DApp Connector wallet.

This folder is a **standalone npm package**:

```bash
cd frontend
npm install
npm run dev
```

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/tender` | Live audit + indexer |
| `/commit` | Seal a bid (Lace-bound identity) |
| `/reveal` | Open the sealed packet |
| `/award` | Organizer award (deployer gate) |
| `/protocol` | Interactive protocol walkthrough |
| `/privacy` | Data classification and limits |

`src/contracts` is filled by `npm run copy:frontend` at the repo root.
