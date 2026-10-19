import mongoose from 'mongoose';

const BidSchema = new mongoose.Schema(
  {
    tenderPublicId: { type: String, required: true, index: true },
    bidderAddress: { type: String, required: true, index: true },
    organizationName: { type: String, default: 'Anonymous Supplier' },
    email: { type: String, default: '' },
    status: {
      type: String,
      enum: ['committed', 'revealed', 'awarded'],
      default: 'committed',
    },
    revealedAmount: { type: Number, default: null },
    revealedDocumentHash: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } },
);

BidSchema.index({ tenderPublicId: 1, bidderAddress: 1 }, { unique: true });

BidSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

export const Bid = mongoose.models.Bid || mongoose.model('Bid', BidSchema);