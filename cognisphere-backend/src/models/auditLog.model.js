const mongoose = require('mongoose');

/**
 * Immutable trail of security-relevant Super Admin actions: tenant
 * suspension, impersonation, settings changes, broadcast pushes, etc.
 * Never updated after creation — only appended to via utils/auditLogger.js.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },

    action: { type: String, required: true, index: true }, // e.g. "tenant.suspend", "tenant.impersonate"
    targetType: { type: String, default: null }, // e.g. "Tenant", "User", "GlobalSettings"
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
