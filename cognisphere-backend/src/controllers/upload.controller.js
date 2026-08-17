const multer = require('multer');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { saveFile, isS3Enabled } = require('../config/storage');
const Tenant = require('../models/tenant.model');

/**
 * multer.memoryStorage() is used regardless of the active backend — the
 * file arrives as a Buffer on req.file.buffer, and storage.js's
 * `saveFile()` decides whether that buffer goes to S3/R2 or local disk.
 * This is what lets this controller stay identical across both backends.
 */
const MAX_VIDEO_MB = 2048;
const MAX_DOCUMENT_MB = 50;
const MAX_IMAGE_MB = 10;

function resolveKind(mimetype) {
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.startsWith('image/')) return 'image';
  return null;
}

const fileFilter = (req, file, cb) => {
  const kind = resolveKind(file.mimetype);
  if (!kind) {
    return cb(new ApiError(400, `File type not allowed: ${file.mimetype}. Only video, pdf and image are accepted.`));
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024 }, // hard ceiling; per-type limits enforced below
});

function buildUniqueFilename(originalname) {
  const ext = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '';
  return `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
}

/**
 * Adds a file's real size to the tenant's running storage total. This is
 * what makes "Storage Used" everywhere in the app (Super Admin dashboard
 * chart, Organization Profile gauge, HR Overview gauge) a genuine
 * measurement instead of a value that only ever existed as seed data —
 * every successful upload call below feeds this.
 */
async function trackStorageUsage(tenantId, sizeBytes) {
  if (!tenantId) return; // platform-level uploads (e.g. Super Admin branding) aren't tenant-billed
  const sizeMB = sizeBytes / (1024 * 1024);
  await Tenant.findByIdAndUpdate(tenantId, { $inc: { 'usage.currentStorageUsedMB': sizeMB } });
}

/**
 * @desc    Upload a single lesson video.
 * @route   POST /api/v1/uploads/video
 * @access  Private (hr_admin), field name: "video"
 */
const uploadVideo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No video file was uploaded.');
  if (!req.file.mimetype.startsWith('video/')) throw new ApiError(400, 'Uploaded file is not a video.');
  if (req.file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new ApiError(400, `Video exceeds the ${MAX_VIDEO_MB}MB limit.`);
  }

  const filename = buildUniqueFilename(req.file.originalname);
  const url = await saveFile({
    req,
    buffer: req.file.buffer,
    kind: 'video',
    tenantFolder: req.tenantId.toString(),
    filename,
    mimetype: req.file.mimetype,
  });

  await trackStorageUsage(req.tenantId, req.file.size);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        url,
        originalName: req.file.originalname,
        sizeBytes: req.file.size,
        mimetype: req.file.mimetype,
        storage: isS3Enabled ? 's3' : 'local',
      },
      'Video uploaded successfully.'
    )
  );
});

/**
 * @desc    Upload a single PDF (course notes).
 * @route   POST /api/v1/uploads/pdf
 * @access  Private (hr_admin), field name: "pdf"
 */
const uploadPdf = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No PDF file was uploaded.');
  if (req.file.mimetype !== 'application/pdf') throw new ApiError(400, 'Uploaded file is not a PDF.');
  if (req.file.size > MAX_DOCUMENT_MB * 1024 * 1024) {
    throw new ApiError(400, `PDF exceeds the ${MAX_DOCUMENT_MB}MB limit.`);
  }

  const filename = buildUniqueFilename(req.file.originalname);
  const url = await saveFile({
    req,
    buffer: req.file.buffer,
    kind: 'pdf',
    tenantFolder: req.tenantId.toString(),
    filename,
    mimetype: req.file.mimetype,
  });

  await trackStorageUsage(req.tenantId, req.file.size);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        url,
        originalName: req.file.originalname,
        sizeBytes: req.file.size,
        mimetype: req.file.mimetype,
        storage: isS3Enabled ? 's3' : 'local',
      },
      'PDF uploaded successfully.'
    )
  );
});

/**
 * @desc    Upload a branding/logo/thumbnail image.
 * @route   POST /api/v1/uploads/image
 * @access  Private (hr_admin, super_admin), field name: "image"
 */
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file was uploaded.');
  if (req.file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new ApiError(400, `Image exceeds the ${MAX_IMAGE_MB}MB limit.`);
  }

  const filename = buildUniqueFilename(req.file.originalname);
  const url = await saveFile({
    req,
    buffer: req.file.buffer,
    kind: 'image',
    tenantFolder: req.tenantId ? req.tenantId.toString() : 'platform',
    filename,
    mimetype: req.file.mimetype,
  });

  await trackStorageUsage(req.tenantId, req.file.size);

  return res.status(201).json(
    new ApiResponse(
      201,
      { url, originalName: req.file.originalname, sizeBytes: req.file.size, storage: isS3Enabled ? 's3' : 'local' },
      'Image uploaded successfully.'
    )
  );
});

module.exports = { upload, uploadVideo, uploadPdf, uploadImage };
