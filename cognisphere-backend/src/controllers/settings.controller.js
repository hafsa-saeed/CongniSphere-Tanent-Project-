const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const GlobalSettings = require('../models/globalSettings.model');
const { logAction } = require('../utils/auditLogger');

const SINGLETON_KEY = 'GLOBAL_SETTINGS';

/**
 * Fetches the singleton settings doc, creating it with defaults on first
 * access so the Settings page always has something to render/edit.
 */
async function getOrCreateSettings() {
  let settings = await GlobalSettings.findOne({ singletonKey: SINGLETON_KEY });
  if (!settings) {
    settings = await GlobalSettings.create({ singletonKey: SINGLETON_KEY });
  }
  return settings;
}

/**
 * @desc    Get the platform's global settings (SMTP, storage, tier quotas, branding).
 * @route   GET /api/v1/settings
 * @access  Private (super_admin only)
 */
const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  return res.status(200).json(new ApiResponse(200, settings));
});

/**
 * @desc    Update global settings. Body is merged section-by-section so the
 *          frontend's tabbed UI can PATCH just the tab that was edited
 *          (e.g. only `{ smtp: {...} }`) without needing the whole document.
 * @route   PATCH /api/v1/settings
 * @access  Private (super_admin only)
 */
const updateSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();

  const allowedSections = [
    'platformName',
    'platformLogoUrl',
    'supportEmail',
    'smtp',
    'paymentGateway',
    'subscriptionTierDefaults',
    'uploads',
    'maintenanceMode',
  ];

  for (const section of allowedSections) {
    if (req.body[section] !== undefined) {
      if (typeof req.body[section] === 'object' && !Array.isArray(req.body[section]) && req.body[section] !== null) {
        // Shallow-merge nested config objects so a partial tab submit
        // (e.g. just { host, port } for smtp) doesn't wipe sibling fields.
        settings[section] = { ...settings[section]?.toObject?.() ?? settings[section], ...req.body[section] };
      } else {
        settings[section] = req.body[section];
      }
    }
  }

  await settings.save();

  await logAction({
    actor: req.user,
    action: 'settings.update',
    targetType: 'GlobalSettings',
    targetId: settings._id,
    metadata: { updatedSections: Object.keys(req.body) },
    ipAddress: req.ip,
  });

  return res.status(200).json(new ApiResponse(200, settings, 'Settings updated.'));
});

module.exports = { getSettings, updateSettings };
