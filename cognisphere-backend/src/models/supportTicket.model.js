const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['super_admin', 'hr_admin'], required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

/**
 * A support query submitted by a tenant's HR admin, triaged by the
 * SaaS Super Admin's Support Desk. `notes` doubles as the reply/thread —
 * both sides can post into it (author role distinguishes them for the UI).
 */
const supportTicketSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    submitterName: { type: String, required: true },
    submitterEmail: { type: String, required: true },

    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },

    status: { type: String, enum: ['pending', 'investigating', 'resolved'], default: 'pending', index: true },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },

    notes: [noteSchema],
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
