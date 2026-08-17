const mongoose = require('mongoose');

/**
 * Establishes connection to MongoDB.
 * Fails fast on startup if the DB is unreachable so we never
 * serve requests against a broken connection.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Mongoose 8 no longer needs useNewUrlParser/useUnifiedTopology,
      // kept here as a comment for teams pinned to older driver versions.
    });

    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`[DB] Connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected. Attempting to reconnect is handled by the driver.');
    });
  } catch (error) {
    console.error(`[DB] Initial connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
