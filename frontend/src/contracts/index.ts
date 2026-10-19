/** Auto-generated contract index */
import previewJson from './preview.json';
import frontendConfigJson from './frontend-config.json';
import circuitsJson from './circuits.json';
import contractInfoJson from './contract-info.json';
import * as managedContract from './managed/index.js';

export type BidShieldPreview = {
  name: string;
  network: string;
  networkId: string;
  contractAddress: string;
  deploymentTxHash: string | null;
  deployer: string;
  deployedAt: string;
  explorer: string;
  endpoints: {
    indexer: string;
    indexerWS: string;
    node: string;
    proofServer: string;
  };
  circuits: string[];
  witnesses: string[];
  privateStateId: string;
  zkAssetsPath: string;
  tender: {
    tenderId: string;
    policyHash: string;
    commitStart: string;
    commitEnd: string;
    revealEnd: string;
    timeUnit: string;
  };
};

export const preview = previewJson as BidShieldPreview;
export const frontendConfig = frontendConfigJson;
export const circuits = circuitsJson;
export const contractInfo = contractInfoJson;
export const Contract = managedContract.Contract;

export const CONTRACT_ADDRESS = preview.contractAddress;
export const NETWORK = preview.network;
export const TENDER = preview.tender;

