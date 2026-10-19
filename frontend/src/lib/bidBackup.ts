// frontend/src/lib/bidBackup.ts

export interface BidBackupData {
  tenderIdHex: string;
  tenderTitle: string;
  bidderAddress: string;
  orgName: string;
  email: string;
  amountTDust: number;
  saltHex: string;
  commitmentHex: string;
  timestamp: string;
}

/**
 * Generate and trigger download of JSON backup for commitment secret salt & bid parameters
 */
export function saveBidBackup(data: BidBackupData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `BidShield-Commitment-${data.tenderIdHex.slice(-8)}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Utility to parse an uploaded JSON commitment backup file
 */
export async function loadBidBackup(file: File): Promise<BidBackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.saltHex || !data.amountTDust) {
          throw new Error('Invalid commitment backup format.');
        }
        resolve(data as BidBackupData);
      } catch (err) {
        reject(new Error('Failed to parse backup JSON file.'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading backup file.'));
    reader.readAsText(file);
  });
}