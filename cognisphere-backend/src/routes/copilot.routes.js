const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { chat } = require('../controllers/copilot.controller');

const router = express.Router();

router.post('/chat', verifyJWT, requireTenant, authorizeRoles('hr_admin'), chat);

module.exports = router;
