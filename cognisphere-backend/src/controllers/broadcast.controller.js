const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Broadcast = require('../models/broadcast.model');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    Create a broadcast. Role determines `sender` and constrains
 *          which `targetAudience` values and tenant scoping are allowed —
 *          see the routing matrix documented in broadcast.model.js.
 * @route   POST /api/v1/broadcasts
 * @access  Private (super_admin or hr_admin)
 */
const createBroadcast = asyncHandler(async (req, res) => {
  const { title, message, priority = 'info', targetAudience, tenantId: bodyTenantId, expiresAt } = req.body;

  if (!title || !message) {
    throw new ApiError(400, 'title and message are required.');
  }

  let sender;
  let resolvedTenantId;
  let resolvedAudience;

  if (req.user.role === 'super_admin') {
    sender = 'superadmin';
    resolvedAudience = targetAudience === 'hr_only' ? 'hr_only' : 'all';
    // Optional: scope a platform-wide announcement down to one tenant.
    // Leave null for a truly global broadcast.
    resolvedTenantId = bodyTenantId || null;
  } else if (req.user.role === 'hr_admin') {
    sender = 'hr';
    resolvedAudience = 'learners_only'; // HR can only ever target their own learners
    resolvedTenantId = req.tenantId; // always the author's own tenant, never client-supplied
    if (!resolvedTenantId) throw new ApiError(400, 'HR broadcasts require a company context.');
  } else {
    throw new ApiError(403, 'Only Super Admin or HR Admin can create broadcasts.');
  }

  const broadcast = await Broadcast.create({
    sender,
    tenantId: resolvedTenantId,
    targetAudience: resolvedAudience,
    title,
    message,
    priority,
    expiresAt: expiresAt || null,
    createdBy: req.user._id,
  });

  await logAction({
    actor: req.user,
    action: 'broadcast.create',
    targetType: 'Broadcast',
    targetId: broadcast._id,
    metadata: { title, priority, targetAudience: resolvedAudience, sender },
    ipAddress: req.ip,
  });

  return res.status(201).json(new ApiResponse(201, broadcast, 'Broadcast published.'));
});

/**
 * @desc    List every broadcast platform-wide (Super Admin management view).
 * @route   GET /api/v1/broadcasts
 * @access  Private (super_admin only)
 */
const listBroadcasts = asyncHandler(async (req, res) => {
  const broadcasts = await Broadcast.find({}).populate('tenantId', 'companyName').sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, broadcasts));
});

/**
 * @desc    HR Broadcast Manager data: the HR's own tenant-authored
 *          announcements (Tab 1 history) plus Super Admin broadcasts
 *          targeted at HR (Tab 2: System Broadcasts).
 * @route   GET /api/v1/broadcasts/hr
 * @access  Private (hr_admin, tenant-scoped)
 */
const listBroadcastsForHr = asyncHandler(async (req, res) => {
  const now = new Date();
  const notExpired = { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };

  const [mine, fromSuperAdmin] = await Promise.all([
    Broadcast.find({ sender: 'hr', tenantId: req.tenantId }).sort({ createdAt: -1 }),
    Broadcast.find({
      sender: 'superadmin',
      targetAudience: { $in: ['all', 'hr_only'] },
      $and: [{ $or: [{ tenantId: null }, { tenantId: req.tenantId }] }, notExpired],
      isActive: true,
    }).sort({ createdAt: -1 }),
  ]);

  return res.status(200).json(new ApiResponse(200, { mine, fromSuperAdmin }));
});

/**
 * @desc    Learner Notice Board: global Super Admin broadcasts
 *          (targetAudience='all') plus this tenant's HR announcements
 *          (targetAudience='learners_only').
 * @route   GET /api/v1/broadcasts/active
 * @access  Private (learner, tenant-scoped) — also usable by hr_admin for a banner
 */
const getActiveBroadcastsForUser = asyncHandler(async (req, res) => {
  const now = new Date();
  const notExpired = { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };

  const filter =
    req.user.role === 'learner'
      ? {
          isActive: true,
          ...notExpired,
          $or: [
            { sender: 'superadmin', targetAudience: 'all', $or: [{ tenantId: null }, { tenantId: req.tenantId }] },
            { sender: 'hr', targetAudience: 'learners_only', tenantId: req.tenantId },
          ],
        }
      : {
          isActive: true,
          ...notExpired,
          sender: 'superadmin',
          targetAudience: { $in: ['all', 'hr_only'] },
          $or: [{ tenantId: null }, { tenantId: req.tenantId }],
        };

  const broadcasts = await Broadcast.find(filter).sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, broadcasts));
});

/**
 * @desc    Deactivate a broadcast. Super Admin can deactivate any; HR can
 *          only deactivate their own tenant's HR-authored broadcasts.
 * @route   PATCH /api/v1/broadcasts/:id/deactivate
 * @access  Private (super_admin or hr_admin who owns it)
 */
const deactivateBroadcast = asyncHandler(async (req, res) => {
  const broadcast = await Broadcast.findById(req.params.id);
  if (!broadcast) throw new ApiError(404, 'Broadcast not found.');

  if (req.user.role === 'hr_admin') {
    const isOwnHrBroadcast = broadcast.sender === 'hr' && broadcast.tenantId?.toString() === req.tenantId?.toString();
    if (!isOwnHrBroadcast) {
      throw new ApiError(403, "You can only deactivate your own organization's broadcasts.");
    }
  }

  broadcast.isActive = false;
  await broadcast.save();

  await logAction({
    actor: req.user,
    action: 'broadcast.deactivate',
    targetType: 'Broadcast',
    targetId: broadcast._id,
    metadata: { title: broadcast.title },
    ipAddress: req.ip,
  });

  return res.status(200).json(new ApiResponse(200, broadcast, 'Broadcast deactivated.'));
});

module.exports = {
  createBroadcast,
  listBroadcasts,
  listBroadcastsForHr,
  getActiveBroadcastsForUser,
  deactivateBroadcast,
};
