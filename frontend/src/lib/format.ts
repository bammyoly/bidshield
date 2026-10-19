export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats Midnight (mn_test1...), Bech32 (addr_test1...), or Hex addresses
 * cleanly without forcing EVM 0x prefixes on non-hex addresses.
 */
export function shortAddress(addr: string | undefined | null, start = 8, end = 6): string {
  if (!addr) return '—';
  const clean = addr.trim();
  if (clean.length <= start + end + 3) return clean;
  return `${clean.slice(0, start)}…${clean.slice(-end)}`;
}

// Retain alias for backwards compatibility
export const shortHex = shortAddress;