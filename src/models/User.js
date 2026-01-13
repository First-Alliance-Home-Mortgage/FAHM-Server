const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    azureAdB2CId: { type: String, unique: true, sparse: true, index: true },
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    nmls: { type: String, trim: true },
    title: { type: String, trim: true },
    photo: { type: String },
    branch: {
      name: String,
      address: String,
      city: String,
      state: String,
      zip: String,
      phone: String
    },
    expoPushToken: { type: String, trim: true },
  },
  { timestamps: true }
);

// Indexes to support role-based filters and active user lookups
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ emailVerified: 1, isActive: 1 });

userSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);

