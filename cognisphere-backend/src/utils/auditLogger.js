const AuditLog = require('../models/auditLog.model');

/**
 * Fire-and-forget audit log write. Never throws — a logging failure
 * must never block the actual action it's recording. Call this AFTER
 * the primary action succeeds.
 */
async function logAction({ actor, action, targetType = null, targetId = null, metadata = {}, ipAddress = null }) {
  try {
    await AuditLog.create({
      actorId: actor._id,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      targetType,
      targetId,
      metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log entry:', err.message);
  }
}

module.exports = { logAction };
