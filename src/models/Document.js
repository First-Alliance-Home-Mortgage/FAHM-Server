const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['pdf', 'png', 'jpg', 'jpeg'], default: 'pdf' },
    url: { type: String, required: true },
    status: { type: String, enum: ['pending', 'synced'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', documentSchema);

