// Compact runtime interface & address stubs for frontend Vite bundle

export function checkRuntimeVersion(version) {
  return true;
}

export function dummyContractAddress() {
  return "0000000000000000000000000000000000000000000000000000000000000000";
}

export function dummyAddress() {
  return "0000000000000000000000000000000000000000000000000000000000000000";
}

export function encodeContractAddress(addr) {
  return addr;
}

export function decodeContractAddress(addr) {
  return addr;
}

export function encodeAddress(addr) {
  return addr;
}

export function decodeAddress(addr) {
  return addr;
}

export class BaseCompactType {
  constructor(...args) {
    this.args = args;
    this.alignment = 1;
    this.size = 32;
  }
  toValue(val) { return val; }
  fromValue(val) { return val; }
  asOpaque() { return this; }
}

export class CompactTypeBytes extends BaseCompactType {}
export class CompactTypeEnum extends BaseCompactType {}
export class CompactTypeStruct extends BaseCompactType {}
export class CompactTypeMap extends BaseCompactType {}
export class CompactTypeSet extends BaseCompactType {}
export class CompactTypeUnsignedInteger extends BaseCompactType {}
export class CompactTypeUint extends BaseCompactType {}
export class CompactTypeBoolean extends BaseCompactType {}
export class CompactTypeField extends BaseCompactType {}
export class CompactTypeVector extends BaseCompactType {}
export class CompactTypeArray extends BaseCompactType {}
export class CompactTypeCounter extends BaseCompactType {}
export class CompactTypeAddress extends BaseCompactType {}
export class CompactTypeOption extends BaseCompactType {}
export class CompactTypeTuple extends BaseCompactType {}
export class CompactTypeOpaque extends BaseCompactType {}
export class CompactTypeString extends BaseCompactType {}
export class CompactTypeVoid extends BaseCompactType {}

export class ContractState {
  constructor(state = {}, ...args) {
    this.state = state;
    this.data = state;
  }
  withLedgerState(ledger) {
    this.state = { ...this.state, ...ledger };
    return this;
  }
  getLedgerState() {
    return this.state;
  }
}

export class StateValue {
  constructor(val) { this.val = val; }
}

export class Contract {
  constructor(witnesses = {}) {
    this.witnesses = witnesses;
  }
  initialState(...args) {
    return new ContractState({
      organizer: new Uint8Array(32),
      tenderId: new Uint8Array(32),
      policyHash: new Uint8Array(32),
      commitStart: 0n,
      commitEnd: 0n,
      revealEnd: 0n,
      tenderState: 0,
      commitments: new Map(),
      revealedBidders: new Set(),
      revealedAmounts: new Map(),
      revealedDocumentHashes: new Map(),
      committedCount: 0n,
      revealCount: 0n,
      awardWinner: new Uint8Array(32),
      awardMemoHash: new Uint8Array(32)
    });
  }
}

export class WitnessContext {}
export class QueryContext {}
export class CircuitContext {}
export class ConstructorContext {}
export class LedgerContext {}
export class StateContext {}
export class LedgerState {}

export const CompactStandardLibrary = new Proxy({}, {
  get: () => () => ({})
});

export const __compactRuntimeVersion = "0.16.0";

export default {
  checkRuntimeVersion,
  dummyContractAddress,
  dummyAddress,
  encodeContractAddress,
  decodeContractAddress,
  encodeAddress,
  decodeAddress,
  BaseCompactType,
  CompactTypeBytes,
  CompactTypeEnum,
  CompactTypeStruct,
  CompactTypeMap,
  CompactTypeSet,
  CompactTypeUnsignedInteger,
  CompactTypeUint,
  CompactTypeBoolean,
  CompactTypeField,
  CompactTypeVector,
  CompactTypeArray,
  CompactTypeCounter,
  CompactTypeAddress,
  CompactTypeOption,
  CompactTypeTuple,
  CompactTypeOpaque,
  CompactTypeString,
  CompactTypeVoid,
  ContractState,
  StateValue,
  Contract,
  WitnessContext,
  QueryContext,
  CircuitContext,
  ConstructorContext,
  LedgerContext,
  StateContext,
  LedgerState,
  CompactStandardLibrary,
  __compactRuntimeVersion
};