# Horizon Guard

**A bilingual, explainable DeFi risk assistant for HashKey Chain.**

Horizon Guard helps newcomers understand smart-contract and transaction risks before they act. It turns observable on-chain signals into a risk score, plain-language explanations, and safer next steps. The prototype combines live HashKey Chain RPC analysis, educational scenarios, a 72-hour strategy sandbox, wallet/network detection, and tamper-evident report fingerprints.

> Horizon Guard is an educational risk-assistance prototype, not a security audit or financial advice. Its analysis is deterministic and explainable; it does not claim to use external security feeds or an LLM in the current build.

## Hackathon track

Primary submission track: **AI** (AI-ready explainable risk assistance for on-chain finance).

## What works today

- Chinese/English interface
- Three explainable scenarios: unlimited approval, concentrated RWA exposure, and a lower-risk stablecoin interaction
- Live structural analysis using the HashKey Chain testnet RPC
- Detection of contract bytecode, code size, EIP-1967 proxy storage, common ERC-20 selectors, and near-unlimited approvals
- Read-only wallet connection and HashKey network switching
- 72-hour educational risk sandbox and safer-action guidance
- SHA-256 report fingerprint generation
- A non-custodial report registry deployed on HashKey Chain Mainnet

## Mainnet deployment

`HorizonRiskRegistry` is deployed on **HashKey Chain Mainnet (Chain ID 177)**.

- Contract: [`0xc0043c0ecdc68401366d92bb46fd5721a4096153`](https://hashkey.blockscout.com/address/0xc0043c0ecdc68401366d92bb46fd5721a4096153)
- Source: [`contracts/HorizonRiskRegistry.sol`](contracts/HorizonRiskRegistry.sol)

The registry stores report hashes and metadata only. It cannot hold tokens, grant approvals, or transfer user funds.

## Architecture

- React 19 + TypeScript
- vinext / Vite full-stack runtime
- HashKey Chain JSON-RPC
- Browser wallet provider for connection and network requests
- Solidity `^0.8.24` report registry

The live analyzer currently uses HashKey Chain **testnet (Chain ID 133)** for repeatable read-only analysis. The report registry is deployed on **mainnet**, satisfying the hackathon deployment requirement.

## Run locally

Requirements: Node.js `>=22.13.0`

```bash
npm install
npm run dev
```

Then open the local URL printed in the terminal (normally `http://localhost:3000`).

Verification:

```bash
npm run build
npm test
```

## Important limitations

- Structural RPC analysis is not a full smart-contract audit.
- The 72-hour sandbox is an educational scenario model, not a price prediction.
- GoPlus/PeckShield feeds, LLM-generated explanations, compliant-pool credentials, and one-click approval revocation are future work, not current features.
- HSP integration is not claimed in this version.

## Safety and privacy

The app never asks for a seed phrase or private key. The homepage is read-only. A transaction signature is requested only if the user deliberately uses the deployment page and confirms it in their wallet.

## License

MIT
