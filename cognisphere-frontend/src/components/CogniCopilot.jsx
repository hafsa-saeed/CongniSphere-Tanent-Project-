import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Trash2 } from 'lucide-react';
import { chatWithCopilot } from '../api/hrApi';
import { notify } from '../lib/toast';

const STORAGE_KEY = 'cogni-copilot-messages';

const DEFAULT_MESSAGES = [
  {
    role: 'assistant',
    text: "Hi! I'm Cogni AI Assistant. Ask me about training strategy, course outlines, quiz design, or improving completion rates — I'll give you a detailed, structured answer.",
  },
];

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

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || typing) return;

    const nextMessages = [...messages, { role: 'user', text: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setTyping(true);

    try {
      // Send real conversation history (minus the message just added, which
      // the backend appends itself) so the assistant has multi-turn context.
      const history = messages.map((m) => ({ role: m.role, content: m.text }));
      const { data } = await chatWithCopilot({ message: trimmed, history });
      setMessages((m) => [...m, { role: 'assistant', text: data.data.reply }]);
    } catch (err) {
      notify.error(err.response?.data?.message || 'Cogni AI is unavailable right now.');
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: err.response?.data?.message || 'Sorry, I ran into an error. Please try again.' },
      ]);
    } finally {
      setTyping(false);
    }
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
