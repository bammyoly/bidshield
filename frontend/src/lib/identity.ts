export function isOrganizer(address: string, deployer: string | undefined): boolean {
  if (!deployer) return false;
  return address.toLowerCase() === deployer.toLowerCase();
}