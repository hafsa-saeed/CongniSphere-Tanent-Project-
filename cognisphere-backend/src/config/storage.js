const path = require('path');
const fs = require('fs');

/**
 * Unified storage adapter.
 * -------------------------------------------------------------------------
 * Every controller that needs to persist a file (uploads, certificates)
 * calls `saveFile()` from this module and never touches `fs` or the AWS
 * SDK directly. This means swapping backends is a config change, not a
 * code change:
 *
 *   - If S3_BUCKET_NAME + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY are set
 *     in the environment, files are uploaded to S3 (or any S3-compatible
 *     provider, e.g. Cloudflare R2, via S3_ENDPOINT).
 *   - Otherwise, files fall back to local disk under /public/uploads,
 *     served statically by app.js — zero setup needed for local dev.
 *
 * The AWS SDK is only required lazily (inside the `if`) so that
 * `@aws-sdk/client-s3` does not need to be installed at all for teams
 * running purely on local disk storage.
 */

const isS3Enabled = Boolean(
  process.env.S3_BUCKET_NAME && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
);

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');
const SUBFOLDERS = { video: 'videos', pdf: 'pdfs', image: 'images', certificate: 'certificates' };

let s3Client = null;

if (isS3Enabled) {
  // eslint-disable-next-line global-require
  const { S3Client } = require('@aws-sdk/client-s3');

  s3Client = new S3Client({
    region: process.env.S3_REGION || 'auto', // Cloudflare R2 uses "auto"
    endpoint: process.env.S3_ENDPOINT || undefined, // set for R2 / non-AWS S3-compatible providers
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // needed by some S3-compatible providers
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });

  console.log(`[STORAGE] S3/R2 adapter active — bucket "${process.env.S3_BUCKET_NAME}"`);
} else {
  for (const sub of Object.values(SUBFOLDERS)) {
    const dir = path.join(UPLOAD_ROOT, sub);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  console.log('[STORAGE] Local disk adapter active (S3 env vars not set) — files stored under /public/uploads');
}

function buildObjectKey(kind, tenantFolder, filename) {
  return `${SUBFOLDERS[kind]}/${tenantFolder}/${filename}`;
}

function buildPublicUrl(req, kind, tenantFolder, filename) {
  if (isS3Enabled) {
    const key = buildObjectKey(kind, tenantFolder, filename);
    if (process.env.S3_PUBLIC_URL_BASE) {
      // Preferred: a CDN / custom domain fronting the bucket
      return `${process.env.S3_PUBLIC_URL_BASE.replace(/\/$/, '')}/${key}`;
    }
    // Fallback: bucket's default virtual-hosted-style URL (AWS S3 shape;
    // R2 buckets should always set S3_PUBLIC_URL_BASE instead since R2
    // has no public bucket URL by default).
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  const base = `${req.protocol}://${req.get('host')}`;
  return `${base}/uploads/${SUBFOLDERS[kind]}/${tenantFolder}/${filename}`;
}

/**
 * Persists a file buffer to whichever backend is active and returns its
 * publicly-accessible URL.
 *
 * @param {object} params
 * @param {import('express').Request} params.req - needed to build a local-disk URL from the request host
 * @param {Buffer} params.buffer - file contents
 * @param {'video'|'pdf'|'image'|'certificate'} params.kind
 * @param {string} params.tenantFolder - usually req.tenantId.toString()
 * @param {string} params.filename - unique filename, including extension
 * @param {string} params.mimetype
 * @returns {Promise<string>} public URL of the stored file
 */
async function saveFile({ req, buffer, kind, tenantFolder, filename, mimetype }) {
  if (!SUBFOLDERS[kind]) {
    throw new Error(`Unknown storage kind "${kind}"`);
  }

  if (isS3Enabled) {
    // eslint-disable-next-line global-require
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const key = buildObjectKey(kind, tenantFolder, filename);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      })
    );
  } else {
    const dir = path.join(UPLOAD_ROOT, SUBFOLDERS[kind], tenantFolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), buffer);
  }

  return buildPublicUrl(req, kind, tenantFolder, filename);
}

module.exports = { isS3Enabled, saveFile, SUBFOLDERS };
