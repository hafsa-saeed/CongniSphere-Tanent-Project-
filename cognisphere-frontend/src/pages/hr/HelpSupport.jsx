import { useState } from 'react';
import { LifeBuoy, Send, CheckCircle2 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { submitSupportTicket } from '../../api/hrApi';
import { notify } from '../../lib/toast';

export default function HelpSupport() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      notify.error('Subject and message are required.');
      return;
    }
    setSubmitting(true);
    try {
      await submitSupportTicket({ subject, message, priority });
      notify.success('Support ticket sent to the CogniSphere team.');
      setSubmitted(true);
      setSubject('');
      setMessage('');
      setPriority('normal');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-1">Help &amp; Support</h1>
      <p className="text-sm text-zinc-500 mb-6">Reach the CogniSphere platform team directly — your message lands in their Support Desk.</p>

      <div className="max-w-xl">
        {submitted ? (
          <GlassCard className="p-8 text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-400 mb-3" />
            <p className="text-white font-medium mb-1">Ticket submitted</p>
            <p className="text-sm text-zinc-500 mb-4">The platform team typically responds within one business day.</p>
            <button onClick={() => setSubmitted(false)} className="text-sm text-indigo-400 hover:text-indigo-300">
              Submit another request
            </button>
          </GlassCard>
        ) : (
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <LifeBuoy size={16} className="text-indigo-400" />
              <h2 className="font-semibold text-white">Contact Super Admin Support</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                required
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                required
                placeholder="Describe the issue or question in detail…"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send size={14} /> {submitting ? 'Sending…' : 'Submit ticket'}
              </button>
            </form>
          </GlassCard>
        )}
      </div>
    </DashboardLayout>
  );
}
