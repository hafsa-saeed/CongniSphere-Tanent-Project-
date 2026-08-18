const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateAIText } = require('../services/aiService');

const SYSTEM_PROMPT =
  'You are CogniCopilot, an in-app assistant embedded in CogniSphere, a B2B multi-tenant corporate ' +
  "learning platform. You're helping an HR Admin manage their organization's training programs — " +
  'courses, quizzes, learner results, certificates, and broadcasts. Be concise, practical, and specific ' +
  'to LMS/training-administration tasks. You have no direct access to this tenant\'s database and cannot ' +
  'take actions yourself — if the person needs to actually do something (create a course, publish it, ' +
  'add a learner, generate a certificate), tell them clearly which screen in the app to use. If asked ' +
  'something entirely unrelated to the platform or training administration, politely redirect back to ' +
  'what you can help with.';

/**
 * @desc    Real AI chat for the HR-side CogniCopilot widget — replaces the
 *          earlier frontend-only canned/simulated responses with an
 *          actual Gemini API call. Keeps up to the last 10 turns of
 *          conversation history for context; the frontend owns and sends
 *          that history since nothing is persisted server-side per chat.
 * @route   POST /api/v1/copilot/chat
 * @access  Private (hr_admin, tenant-scoped)
 */
const chat = asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'message is required.');
  }
  if (!Array.isArray(history)) {
    throw new ApiError(400, 'history must be an array.');
  }

  const messages = [
    ...history.slice(-10).map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content || ''),
    })),
    { role: 'user', content: message },
  ];

  let reply;
  try {
    reply = await generateAIText({ system: SYSTEM_PROMPT, messages, maxTokens: 1024 });
  } catch (err) {
    throw new ApiError(err.statusCode || 502, err.message);
  }

  return res.status(200).json(new ApiResponse(200, { reply }));
});

module.exports = { chat };
