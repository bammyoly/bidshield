// frontend/src/lib/tenderMeta.ts
// Off-chain tender package. The on-chain policyHash must match SHA-256 of the
// canonical policy document. Update this when you deploy a new tender.

export type TenderMeta = {
  title: string;
  summary: string;
  description: string;
  category: string;
  buyerName: string;
  location: string;
  budgetHint?: string;
  currency: string;
  coverImage?: string; // public URL or /public asset
  requirements: string[];
  evaluation: string[];
  attachments: { name: string; note: string }[];
  contact?: string;
};

export const tenderMeta: TenderMeta = {
  title: 'Supply of Solar Microgrid Kits for Rural Clinics',
  summary:
    'The Ministry of Health invites sealed bids for the supply, delivery, and commissioning of solar microgrid kits across 40 rural primary-care clinics.',
  description: `This tender seeks qualified suppliers to provide turnkey solar microgrid solutions including PV arrays, battery storage, inverters, installation, and 24-month maintenance.

Bids must include:
• Itemized equipment list with manufacturer datasheets
• Delivery and installation schedule
• Warranty and after-sales support plan
• Total fixed price in tDUST (or equivalent quoted in the bid form)

Only complete, sealed commitments submitted through BidShield during the commit window will be considered. Late or altered bids are cryptographically rejected by the Midnight contract.`,
  category: 'Energy & Infrastructure',
  buyerName: 'Ministry of Health — Procurement Directorate',
  location: 'National (multi-site rural clinics)',
  budgetHint: 'Indicative envelope: 80,000 – 120,000 tDUST total',
  currency: 'tDUST',
  coverImage: '/tender-cover.svg', // optional; place asset in frontend/public
  requirements: [
    'Minimum 5 years experience supplying off-grid solar systems',
    'IEC-certified panels and lithium battery packs',
    'On-site installation within 90 days of award',
    '24-month warranty and spare-parts guarantee',
    'Bid bond / performance guarantee (off-chain legal requirement)',
  ],
  evaluation: [
    '40% — Total landed price (revealed on-chain)',
    '30% — Technical compliance & equipment quality',
    '20% — Delivery timeline and installation plan',
    '10% — After-sales support footprint',
  ],
  attachments: [
    { name: 'RFP-Solar-Clinics-v1.pdf', note: 'Full technical specification (hash bound on-chain)' },
    { name: 'Bill-of-Quantities.xlsx', note: 'Mandatory pricing schedule template' },
    { name: 'Draft-Contract.docx', note: 'Indicative terms; final award is off-chain legal process' },
  ],
  contact: 'procurement@health.example.gov',
};