const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { getSettings, updateSettings } = require('../controllers/settings.controller');

const router = express.Router();

router.use(verifyJWT, authorizeRoles('super_admin'));

router.get('/', getSettings);
router.patch('/', updateSettings);

module.exports = router;
