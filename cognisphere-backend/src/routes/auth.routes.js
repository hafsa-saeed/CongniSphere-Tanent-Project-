const express = require('express');
const { verifyJWT } = require('../middleware/auth.middleware');
const { login, register, getMe, refreshAccessToken, logout, updateMyProfile, changePassword } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh-token', refreshAccessToken);

router.get('/me', verifyJWT, getMe);
router.patch('/me', verifyJWT, updateMyProfile);
router.patch('/change-password', verifyJWT, changePassword);
router.post('/logout', verifyJWT, logout);

module.exports = router;
