const express = require('express');
const { verifyJWT, authorizeRoles } = require('../middleware/auth.middleware');
const { requireTenant } = require('../middleware/tenant.middleware');
const { upload, uploadVideo, uploadPdf, uploadImage } = require('../controllers/upload.controller');

const router = express.Router();

router.use(verifyJWT, requireTenant);

router.post('/video', authorizeRoles('hr_admin'), upload.single('video'), uploadVideo);
router.post('/pdf', authorizeRoles('hr_admin'), upload.single('pdf'), uploadPdf);
router.post('/image', authorizeRoles('hr_admin', 'learner'), upload.single('image'), uploadImage);

module.exports = router;
