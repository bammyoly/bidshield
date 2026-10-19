export type BidShieldPrivateState = {
  organizerSecret: Uint8Array;
  bidderSecret: Uint8Array;
};

export const witnesses = {
  localBidderSecret: ({ privateState }: { privateState: BidShieldPrivateState }) =>
    [privateState, privateState.bidderSecret] as const,
  localOrganizerSecret: ({ privateState }: { privateState: BidShieldPrivateState }) =>
    [privateState, privateState.organizerSecret] as const,
};
