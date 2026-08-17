/**
 * Standardized success response shape so the frontend can rely on
 * a single consistent envelope: { success, statusCode, message, data }.
 */
class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.statusCode = statusCode;
    this.success = statusCode < 400;
    this.message = message;
    this.data = data;
  }
}

module.exports = ApiResponse;
