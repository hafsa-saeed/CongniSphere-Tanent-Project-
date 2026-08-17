const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const AuditLog = require('../models/auditLog.model');

/**
 * @desc    List audit log entries, newest first, with optional filters.
 * @route   GET /api/v1/audit-logs?action=&page=&limit=
 * @access  Private (super_admin only)
 */
const listAuditLogs = asyncHandler(async (req, res) => {
  const { action, page = 1, limit = 30 } = req.query;

  const filter = {};
  if (action) filter.action = action;

  const skip = (Number(page) - 1) * Number(limit);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      logs,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    })
  );
});

module.exports = { listAuditLogs };
