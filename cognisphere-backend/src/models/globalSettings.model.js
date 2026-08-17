const mongoose = require('mongoose');

/**
 * Platform-wide configuration controlled by the SaaS Super Admin.
 * This collection is a SINGLETON — enforce with a fixed key so
 * there is only ever one document (see findOneAndUpdate upsert pattern
 * in settings.controller.js, to be built in a later phase).
 */
const globalSettingsSchema = new mongoose.Schema(
  {
    singletonKey: { type: String, default: 'GLOBAL_SETTINGS', unique: true },

    platformName: { type: String, default: 'CogniSphere' },
    platformLogoUrl: { type: String, default: null },
    supportEmail: { type: String, default: null },

    // ---------- Default SMTP (tenants can override in tenant.integrations.smtp) ----------
    smtp: {
      host: { type: String, default: null },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      username: { type: String, default: null },
      passwordEncrypted: { type: String, default: null },
      fromEmail: { type: String, default: null },
      fromName: { type: String, default: 'CogniSphere' },
    },

    // ---------- Payment integration ----------
    paymentGateway: {
      provider: { type: String, enum: ['stripe', 'paddle', 'razorpay', 'none'], default: 'none' },
      publicKey: { type: String, default: null },
      secretKeyEncrypted: { type: String, default: null },
      webhookSecretEncrypted: { type: String, default: null },
    },

    // ---------- Subscription tier defaults (used when onboarding a new tenant) ----------
    subscriptionTierDefaults: {
      trial: {
        durationDays: { type: Number, default: 14 },
        maxUsers: { type: Number, default: 10 },
        maxCourses: { type: Number, default: 3 },
      },
      starter: {
        maxUsers: { type: Number, default: 50 },
        maxCourses: { type: Number, default: 20 },
        pricePerSeat: { type: Number, default: 4 },
      },
      professional: {
        maxUsers: { type: Number, default: 500 },
        maxCourses: { type: Number, default: 100 },
        pricePerSeat: { type: Number, default: 8 },
      },
      enterprise: {
        maxUsers: { type: Number, default: -1 }, // -1 = unlimited
        maxCourses: { type: Number, default: -1 },
        pricePerSeat: { type: Number, default: 12 },
      },
    },

    // ---------- File upload constraints ----------
    uploads: {
      allowedVideoTypes: { type: [String], default: ['mp4', 'mov', 'webm'] },
      allowedDocumentTypes: { type: [String], default: ['pdf'] },
      maxVideoSizeMB: { type: Number, default: 2048 },
      maxDocumentSizeMB: { type: Number, default: 50 },
      storageProvider: { type: String, enum: ['s3', 'gcs', 'azure_blob', 'local'], default: 's3' },
    },

    maintenanceMode: {
      isEnabled: { type: Boolean, default: false },
      message: { type: String, default: null },
    },

    // Platform-level analytics snapshot fields (MRR etc. are usually computed
    // on demand from Tenant subscription data, but a cached snapshot helps
    // dashboard load time).
    analyticsSnapshot: {
      totalTenants: { type: Number, default: 0 },
      activeTenants: { type: Number, default: 0 },
      mrr: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
