const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const {
  createTicket,
  listTickets,
  getTicketById,
  replyToTicket,
  updateTicketStatus,
} = require('../controllers/supportTicket.controller');

const router = express.Router();

router.use(verifyJWT);

// ---------- Tenant HR: submit a ticket ----------
router.post('/', requireTenant, authorizeRoles('hr_admin'), createTicket);

// ---------- Super Admin: triage the inbox ----------
router.get('/', authorizeRoles('super_admin'), listTickets);
router.get('/:id', authorizeRoles('super_admin'), getTicketById);
router.patch('/:id/reply', authorizeRoles('super_admin'), replyToTicket);
router.patch('/:id/status', authorizeRoles('super_admin'), updateTicketStatus);

module.exports = router;
