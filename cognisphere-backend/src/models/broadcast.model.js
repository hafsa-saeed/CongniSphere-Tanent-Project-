const mongoose = require('mongoose');

/**
 * Multi-tier targeted broadcast/announcement.
 *
 * Routing matrix (enforced in broadcast.controller.js, not just documented
 * here — the schema alone doesn't stop a bad combination from being saved):
 *
 *   sender='superadmin', targetAudience='all'        -> visible to HR admins AND learners,
 *                                                        every tenant (tenantId: null) or one
 *                                                        tenant if tenantId is set.
 *   sender='superadmin', targetAudience='hr_only'     -> visible strictly inside HR dashboards
 *                                                        (System Broadcasts tab), every tenant
 *                                                        or one tenant.
 *   sender='hr',         targetAudience='learners_only' -> visible strictly to that HR's own
 *                                                        tenant's learners. tenantId is REQUIRED
 *                                                        and always the author's own tenant.
 *
 * HR can never author 'all' or 'hr_only' — enforced in the controller, since
 * an HR admin broadcasting into every other company's HR dashboard would be
 * a cross-tenant leak.
 */
const broadcastSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ['superadmin', 'hr'], required: true },

    // Null = platform-wide (only valid for sender='superadmin').
    // Required and always the author's own tenant when sender='hr'.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },

    targetAudience: {
      type: String,
      enum: ['all', 'hr_only', 'learners_only'],
      required: true,
    },

    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    priority: { type: String, enum: ['info', 'urgent'], default: 'info' },

    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

broadcastSchema.index({ isActive: 1, targetAudience: 1, tenantId: 1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
