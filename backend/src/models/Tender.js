import mongoose from 'mongoose';

const TenderSchema = new mongoose.Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },

    title: { type: String, required: true, trim: true, unique: true }, // Enforce uniqueness
    description: { type: String, required: true, trim: true },
    category: { type: String, default: 'Technology', trim: true },
    location: { type: String, default: '', trim: true },
    
    // Price Guardrails
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'tDUST' },
    
    // Images
    imageUrl: { type: String, default: '' },

    // Merged reqs/eval
    requirements: { type: [String], default: [] },
    contact: { type: String, default: '' },

    // Cryptographic / chain binding
    policyHash: { type: String, required: true, index: true },
    tenderIdHex: { type: String, required: true, index: true },

    // Schedule (Unix seconds, but UI will send ISO strings or Unix)
    commitStart: { type: Number, required: true },
    commitEnd: { type: Number, required: true },
    revealEnd: { type: Number, required: true },

    awardWinnerAddress: { type: String, default: '' },
    awardWinnerOrg: { type: String, default: '' },
    awardNote: { type: String, default: '' },
    awardedAt: { type: Date, default: null },

    contractAddress: { type: String, default: '' },
    network: { type: String, default: 'preview' },
    organizerAddress: { type: String, default: '', index: true },

    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'awarded'],
      default: 'published',
      index: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

TenderSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret.publicId;
    delete ret._id;
    delete ret.publicId;
    return ret;
  },
});

export const Tender = mongoose.models.Tender || mongoose.model('Tender', TenderSchema);