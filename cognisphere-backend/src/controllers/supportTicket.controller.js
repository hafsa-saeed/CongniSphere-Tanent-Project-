const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const SupportTicket = require('../models/supportTicket.model');
const { logAction } = require('../utils/auditLogger');

/**
 * @desc    HR submits a support query to the platform team.
 * @route   POST /api/v1/support-tickets
 * @access  Private (hr_admin, tenant-scoped)
 */
const createTicket = asyncHandler(async (req, res) => {
  const { subject, message, priority = 'normal' } = req.body;
  if (!subject || !message) throw new ApiError(400, 'subject and message are required.');

  const ticket = await SupportTicket.create({
    tenantId: req.tenantId,
    submittedBy: req.user._id,
    submitterName: req.user.fullName,
    submitterEmail: req.user.email,
    subject,
    message,
    priority,
  });

  return res.status(201).json(new ApiResponse(201, ticket, 'Support ticket submitted.'));
});

/**
 * @desc    List all support tickets across every tenant (Super Admin inbox).
 * @route   GET /api/v1/support-tickets
 * @access  Private (super_admin only)
 */
const listTickets = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const tickets = await SupportTicket.find(filter).populate('tenantId', 'companyName subdomain').sort({ createdAt: -1 });

  return res.status(200).json(new ApiResponse(200, tickets));
});

/**
 * @desc    Get a single ticket's full thread.
 * @route   GET /api/v1/support-tickets/:id
 * @access  Private (super_admin only)
 */
const getTicketById = asyncHandler(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id).populate('tenantId', 'companyName subdomain');
  if (!ticket) throw new ApiError(404, 'Ticket not found.');
  return res.status(200).json(new ApiResponse(200, ticket));
});

/**
 * @desc    Add a reply/internal note to a ticket, optionally updating its status.
 * @route   PATCH /api/v1/support-tickets/:id/reply
 * @access  Private (super_admin only)
 */
const replyToTicket = asyncHandler(async (req, res) => {
  const { message, status } = req.body;
  if (!message) throw new ApiError(400, 'message is required.');

  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found.');

  ticket.notes.push({
    authorId: req.user._id,
    authorName: req.user.fullName,
    authorRole: req.user.role,
    message,
  });

  if (status && ['pending', 'investigating', 'resolved'].includes(status)) {
    ticket.status = status;
    if (status === 'resolved') ticket.resolvedAt = new Date();
  }

  await ticket.save();

  await logAction({
    actor: req.user,
    action: 'support.reply',
    targetType: 'SupportTicket',
    targetId: ticket._id,
    metadata: { subject: ticket.subject, newStatus: ticket.status },
    ipAddress: req.ip,
  });

  return res.status(200).json(new ApiResponse(200, ticket, 'Reply added.'));
});

/**
 * @desc    Update just a ticket's status (e.g. drag between Kanban columns).
 * @route   PATCH /api/v1/support-tickets/:id/status
 * @access  Private (super_admin only)
 */
const updateTicketStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'investigating', 'resolved'].includes(status)) {
    throw new ApiError(400, 'Invalid status.');
  }

  const update = { status };
  if (status === 'resolved') update.resolvedAt = new Date();

  const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
  if (!ticket) throw new ApiError(404, 'Ticket not found.');

  return res.status(200).json(new ApiResponse(200, ticket, 'Status updated.'));
});

module.exports = { createTicket, listTickets, getTicketById, replyToTicket, updateTicketStatus };
