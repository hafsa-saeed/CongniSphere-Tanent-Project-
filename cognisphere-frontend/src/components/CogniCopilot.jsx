import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'cogni-copilot-messages';

const DEFAULT_MESSAGES = [
  {
    role: 'assistant',
    text: "Hi! I'm Cogni AI Assistant. Ask me about training strategy, course outlines, quiz design, or improving completion rates — I'll give you a detailed, structured answer.",
  },
];

/**
 * Simulated AI response engine. A real integration would POST the message
 * to a backend endpoint that calls the Anthropic API server-side (an API
 * key must never be shipped to the frontend) using a system prompt
 * instructing detailed, structured, non-truncated answers — this
 * client-side version follows that same "be thorough" instruction with
 * template-based canned responses instead of a live model call.
 */
const CANNED_RESPONSES = [
  {
    match: /outline|structure|module/i,
    reply:
      "Here's a solid structure for an onboarding or skills course:\n\n" +
      '1. Company & culture overview — mission, values, how teams work together\n' +
      '2. Tools & systems walkthrough — the software and processes people touch daily\n' +
      '3. Role-specific processes — the actual day-to-day workflow for this job\n' +
      '4. Compliance & policies — anything with legal or safety weight\n' +
      '5. Knowledge-check quiz after each module, with an 80% passing threshold\n\n' +
      'Keep each module to 15-20 minutes of content max — attention drops sharply past that, and shorter modules also make it easier to see exactly where learners disengage in your Results Vault data.',
  },
  {
    match: /quiz|question|assess/i,
    reply:
      'For assessment design, a good mix looks like:\n\n' +
      '- 60% multiple-choice — fast to answer, good for recall checks\n' +
      '- 30% scenario-based — "what would you do if..." tests real application, not memorization\n' +
      '- 10% short-answer — open reflection, manually reviewed, good for judgment calls\n\n' +
      'Keep quizzes under 10 questions so they check understanding rather than feel like a final exam. In the AI Quiz Architect you can generate a full draft (5-30 questions) with distractors and explanations pre-filled, then edit before saving — the AI draft is always a starting point, never the final version.',
  },
  {
    match: /engag|completion|drop.?off/i,
    reply:
      'Completion rates usually respond to three levers:\n\n' +
      '1. Shorter lessons (5-10 minutes) — long-form video is the single biggest drop-off cause\n' +
      '2. Visible progress — a progress bar and "X of Y modules complete" gives people a finish line\n' +
      '3. A tangible reward on completion — even a simple auto-issued certificate measurably helps\n\n' +
      'If one specific course has a low completion rate, check the Learner Results & Vault tab — the per-learner drawer shows exactly which module people stall on, which is usually more useful than aggregate stats alone.',
  },
  {
    match: /certificate/i,
    reply:
      'Certificates auto-issue the moment a learner hits 100% completion (configurable per-course as "all quizzes passed" or "all lessons complete" in the Certificate Engine tab). You can customize:\n\n' +
      '- Signature name and title, shown at the bottom of the PDF\n' +
      '- Dynamic tokens: {learner_name}, {course_name}, {completion_date} — filled in automatically at issue time\n\n' +
      'Certificates are re-renderable on demand, so changing the signature later applies to future downloads without needing to regenerate anything manually.',
  },
  {
    match: /broadcast|announce|notice/i,
    reply:
      'Broadcasts route by audience:\n\n' +
      '- Your announcements always go to learners_only within your own organization — they can never leak to other companies\n' +
      '- Super Admin can post company-wide "all" broadcasts (visible to both HR and learners) or "hr_only" ones (visible only in HR dashboards)\n\n' +
      'Use "urgent" priority sparingly — it renders with a red banner and should be reserved for things like system maintenance windows or mandatory-by-deadline compliance training, not routine updates.',
  },
];

const DEFAULT_REPLY =
  "That's a fair question — I'd start by clarifying the training goal first, then work backward into modules, assessments, and how you'll measure success. Try asking me specifically about course outlines, quiz design, improving completion rates, certificates, or broadcasts, and I'll go deeper on that topic.";

function generateReply(message) {
  const found = CANNED_RESPONSES.find((r) => r.match.test(message));
  return found ? found.reply : DEFAULT_REPLY;
}

function loadPersistedMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MESSAGES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}

export default function CogniCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadPersistedMessages);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  // Persist across page navigation (this component stays mounted in
  // DashboardLayout across route changes) and across full reloads.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      setMessages((m) => [...m, { role: 'assistant', text: generateReply(trimmed) }]);
      setTyping(false);
    }, 900 + Math.random() * 600);
  };

  const handleClearChat = () => {
    setMessages(DEFAULT_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MESSAGES));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="mb-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
            style={{ height: 460 }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-indigo-600/20 to-violet-600/20">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/20 p-1.5">
                  <Sparkles size={14} className="text-indigo-300" />
                </div>
                <span className="text-sm font-semibold text-white">Cogni AI Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleClearChat} title="Clear chat" className="text-zinc-400 hover:text-red-400 p-1">
                  <Trash2 size={14} />
                </button>
                <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={
                      'max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ' +
                      (m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-200')
                    }
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-zinc-800 px-3 py-2 text-xs text-zinc-400">Thinking…</div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-3 flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about training strategy…"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={handleSend} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500">
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white shadow-lg shadow-indigo-900/40"
      >
        <Sparkles size={18} />
        {!open && <span className="text-sm font-medium hidden sm:inline">Cogni AI</span>}
      </motion.button>
    </div>
  );
}
