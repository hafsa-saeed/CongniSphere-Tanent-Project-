const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { listTenantUsers, updateUserStatus, getUserSummary } = require('../controllers/user.controller');

const router = express.Router();

router.use(verifyJWT, requireTenant, authorizeRoles('hr_admin'));

router.get('/', listTenantUsers);
router.get('/:id/summary', getUserSummary);
router.patch('/:id/status', updateUserStatus);

module.exports = router;
