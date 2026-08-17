const mongoose = require('mongoose');

/**
 * A "Request Organization Onboarding" submission from the public Landing
 * Page modal — an unregistered company asking the Super Admin to set them
 * up as a tenant. Distinct from SupportTicket (which is for already-
 * onboarded HR admins) and from Tenant (which doesn't exist yet for this
 * company until a Super Admin approves the request).
 */
const onboardingRequestSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, default: null },
    message: { type: String, default: null }, // e.g. team size, use case, timeline

    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },

    // Populated only once approved — links this request to the Tenant it created.
    approvedTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

onboardingRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('OnboardingRequest', onboardingRequestSchema);
