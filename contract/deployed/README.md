# BidShield deployment outputs

This folder is the frontend-facing record of a Midnight Preview deploy.

| File | Safe to ship to the frontend? | Contents |
| --- | --- | --- |
| `preview.json` | Yes | Contract address, network, explorer URL, public tender parameters, circuit names |
| `frontend-config.json` | Yes | Vite/Next env-style keys (`VITE_CONTRACT_ADDRESS`, indexer, node, proof server) |
| `circuits.json` | Yes | Exported circuit names and constructor args (public only) |
| `zk-assets/` | Yes | Compiler `keys/` + `zkir/` for the proof server / `FetchZkConfigProvider` |
| `private/` | **No** | Organizer secret and constructor witness data. Gitignored. |

The wallet seed never lands here.

After a successful `npm run deploy:preview`, point the frontend at `preview.json` / `frontend-config.json` and serve `zk-assets/` as static files (for example `/zk/bidshield`).
