const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { listAuditLogs } = require('../controllers/auditLog.controller');

const router = express.Router();

router.use(verifyJWT, authorizeRoles('super_admin'));

router.get('/', listAuditLogs);

module.exports = router;
