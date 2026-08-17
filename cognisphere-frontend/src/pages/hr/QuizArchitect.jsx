import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Trash2, Save, Wand2 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { listCourses, createQuiz } from '../../api/hrApi';
import { notify } from '../../lib/toast';

let optionIdCounter = 0;
const nextOptionId = () => 'opt-' + optionIdCounter++;

function makeOption(text, isCorrect) {
  return { localId: nextOptionId(), text, isCorrect };
}

/**
 * Simulated AI draft generator. A real integration would send `topic` and
 * `count` to a backend endpoint that calls the Anthropic API server-side
 * (never expose an API key from the frontend) and return structured
 * question JSON. This produces `count` plausible, clearly-editable draft
 * questions — 4 options per multiple-choice question (1 correct + 3
 * distractors) with a stored explanation — so HR always reviews and
 * corrects the draft before saving; the human-in-the-loop step is
 * mandatory, not optional, by design.
 */
const TOPIC_ANGLES = [
  { stem: 'What is the primary objective of {topic}?', correct: 'To ensure employees understand {topic} correctly and apply it consistently', explanation: 'The core goal of any training topic is correct, consistent application on the job — not just passive awareness.' },
  { stem: 'Which of the following best describes a key principle of {topic}?', correct: 'Consistency and adherence to defined processes', explanation: 'Well-designed processes only deliver value when followed consistently; ad-hoc exceptions undermine the whole point of having a standard.' },
  { stem: 'What is the most likely consequence of ignoring {topic} guidelines?', correct: 'Increased risk of errors, non-compliance, or safety issues', explanation: 'Guidelines exist specifically to reduce a known risk — skipping them reintroduces that risk.' },
  { stem: 'Who is primarily responsible for applying {topic} in daily work?', correct: 'Every employee in their own role, not just management', explanation: 'Training programs succeed when ownership is distributed, not centralized in a single role.' },
  { stem: 'When should an employee escalate a concern related to {topic}?', correct: 'As soon as they notice a potential issue, rather than waiting', explanation: 'Early escalation is almost always cheaper and safer than waiting for a problem to compound.' },
  { stem: 'What best demonstrates mastery of {topic} in practice?', correct: 'Applying it correctly without needing to be reminded', explanation: 'Passing a quiz shows knowledge; unprompted correct behavior on the job shows mastery.' },
  { stem: 'Why does {topic} matter to the organization as a whole, not just one team?', correct: 'Because inconsistent practice in one area creates risk that affects everyone', explanation: 'Cross-functional standards break down if only some teams follow them — the whole point is organization-wide consistency.' },
  { stem: 'What is the first step an employee should take when starting work related to {topic}?', correct: 'Review the current documented process before acting', explanation: 'Acting before checking the current standard is a common source of avoidable errors.' },
  { stem: 'How should a new employee be brought up to speed on {topic}?', correct: 'Structured onboarding paired with a knowledgeable mentor or supervisor', explanation: 'Ad-hoc, undocumented knowledge transfer is unreliable and inconsistent across new hires.' },
  { stem: 'What distinguishes a well-run process for {topic} from a poorly-run one?', correct: 'Clear ownership, documented steps, and regular review', explanation: 'Undefined ownership and undocumented steps are the most common causes of process breakdown.' },
];

const DISTRACTORS = [
  'To fill training hours with no clear goal',
  'It has no defined objective or measurable outcome',
  'Ignoring established guidelines when convenient',
  'Randomly applying rules without documentation',
  'Something only management needs to know about',
  'A one-time requirement with no ongoing relevance',
];

/**
 * Strips instructional/meta phrasing from whatever HR typed into the
 * topic box before it's embedded into question templates. Without this,
 * a pasted prompt like "generate 10 quizzes for our first module about
 * workplace safety procedures" gets echoed verbatim into every question
 * stem ("What is the primary objective of generate 10 quizzes for our
 * first module about workplace safety procedures?") — this extracts
 * just the actual subject.
 *
 * Two passes, in order of preference:
 *   1. If the text contains an instruction verb (generate/create/write/
 *      need/want/...) ANYWHERE followed later by an "about/on/for/
 *      covering/regarding X" clause, keep only X — this catches phrasing
 *      the fixed-prefix pattern below would miss, e.g. "I need you to
 *      please create a quiz on X" or "can you generate 10 mcqs about X".
 *   2. Otherwise, strip a simple leading "generate/create N quiz(zes)
 *      for/about X" prefix and use what's left.
 */
function sanitizeTopic(raw) {
  let t = raw.trim();

  const aboutMatch = t.match(/\b(about|on|for|covering|regarding)\s+(.+)$/i);
  const hasInstructionVerb = aboutMatch && /\b(generate|create|make|write|build|need|want|please)\b/i.test(t.slice(0, aboutMatch.index));

  if (hasInstructionVerb) {
    t = aboutMatch[2];
  } else {
    const instructionPattern =
      /^(please\s+)?(i\s+(need|want)\s+(you\s+to\s+)?)?(generate|create|make|write|build)\s+\d*\s*(quiz(zes)?|question(s)?|assessment(s)?|mcqs?)\s*(for|about|on|covering|regarding)?\s*/i;
    t = t.replace(instructionPattern, '');
  }

  // Strip a leading "our/the/this Nth module (about/on/...)" phrase too,
  // in case it survived either pass above or appeared on its own.
  const modulePattern = /^(our|the|this)\s+(first|second|third|\d+(st|nd|rd|th)?)?\s*module\s*(about|on|for|covering|regarding)?\s*/i;
  t = t.replace(modulePattern, '');

  // Clean up stray leading/trailing punctuation left over from the cuts above.
  t = t.replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '');

  // A real topic/subject shouldn't need to run more than ~80 characters —
  // anything longer left after the strips above is almost certainly
  // leftover instructional text, not a clean subject, so truncate defensively.
  if (t.length > 80) t = t.slice(0, 80).trim();

  return t || 'this topic';
}

function generateDraftQuestions(topic, count) {
  const cleanTopic = sanitizeTopic(topic);
  const questions = [];

  for (let i = 0; i < count; i++) {
    // Reserve roughly 1 in 5 questions as True/False or short-answer for variety
    const cycle = i % 5;

    if (cycle === 4) {
      questions.push({
        questionText: `True or False: ${cleanTopic} applies to all employees regardless of department.`,
        questionType: 'true_false',
        points: 3,
        explanation: 'Company-wide training topics are, by design, meant to apply broadly unless explicitly scoped to one department.',
        options: [makeOption('True', true), makeOption('False', false)],
      });
      continue;
    }

    const angle = TOPIC_ANGLES[i % TOPIC_ANGLES.length];
    const questionText = angle.stem.replace(/\{topic\}/g, cleanTopic);
    const correctText = angle.correct.replace(/\{topic\}/g, cleanTopic);
    const shuffledDistractors = [...DISTRACTORS].sort(() => Math.random() - 0.5).slice(0, 3);

    questions.push({
      questionText,
      questionType: 'single_choice',
      points: 5,
      explanation: angle.explanation.replace(/\{topic\}/g, cleanTopic),
      options: [makeOption(correctText, true), ...shuffledDistractors.map((d) => makeOption(d, false))],
    });
  }

  return questions;
}

export default function QuizArchitect() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [passingThresholdPercent, setPassingThresholdPercent] = useState(80);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(3);

  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCourses().then((res) => setCourses(res.data.data.courses));
  }, []);

  const selectedCourse = courses.find((c) => c._id === courseId);

  const handleGenerate = () => {
    if (!topic.trim()) {
      notify.error('Enter a topic or paste a summary first.');
      return;
    }
    setGenerating(true);
    setTimeout(() => {
      setQuestions(generateDraftQuestions(topic, questionCount));
      setTitle((t) => t || `${sanitizeTopic(topic)} — Knowledge Check`);
      setGenerating(false);
      notify.success('Draft generated — review and edit before saving.');
    }, 1400);
  };

  const updateQuestion = (index, patch) => setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const updateOption = (qIndex, optLocalId, patch) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i !== qIndex ? q : { ...q, options: q.options.map((o) => (o.localId === optLocalId ? { ...o, ...patch } : o)) }))
    );

  const setCorrectOption = (qIndex, optLocalId) =>
    setQuestions((qs) =>
      qs.map((q, i) => (i !== qIndex ? q : { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.localId === optLocalId })) }))
    );

  const addOption = (qIndex) =>
    setQuestions((qs) => qs.map((q, i) => (i !== qIndex ? q : { ...q, options: [...q.options, makeOption('', false)] })));

  const removeOption = (qIndex, optLocalId) =>
    setQuestions((qs) => qs.map((q, i) => (i !== qIndex ? q : { ...q, options: q.options.filter((o) => o.localId !== optLocalId) })));

  const addQuestion = () =>
    setQuestions((qs) => [
      ...qs,
      { questionText: '', questionType: 'single_choice', points: 5, explanation: '', options: [makeOption('', true), makeOption('', false)] },
    ]);

  const removeQuestion = (index) => setQuestions((qs) => qs.filter((_, i) => i !== index));

  const handleSaveToCourse = async () => {
    if (!courseId || !moduleId || !title.trim()) {
      notify.error('Course, module, and quiz title are required.');
      return;
    }
    if (questions.length === 0) {
      notify.error('Generate or add at least one question first.');
      return;
    }
    if (questions.some((q) => !q.questionText.trim() || (q.questionType !== 'short_answer' && q.options.some((o) => !o.text.trim())))) {
      notify.error('Every question and option needs text.');
      return;
    }

    setSaving(true);
    try {
      await createQuiz({
        courseId,
        moduleId,
        title,
        passingThresholdPercent: Number(passingThresholdPercent),
        timeLimitMinutes: Number(timeLimitMinutes),
        isTimed: Number(timeLimitMinutes) > 0,
        maxAttempts: Number(maxAttempts),
        questions: questions.map((q) => ({
          questionText: q.questionText,
          questionType: q.questionType,
          points: Number(q.points) || 1,
          explanation: q.explanation || null,
          options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
        })),
      });
      notify.success('Quiz saved to course.');
      setQuestions([]);
      setTitle('');
      setTopic('');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save quiz.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout dark>
      <h1 className="text-2xl font-bold text-white mb-1">AI Quiz Architect</h1>
      <p className="text-sm text-zinc-500 mb-6">Generate a draft assessment with AI, then fully edit it before saving.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ---------- AI Prompt Panel ---------- */}
        <GlassCard className="p-5 lg:col-span-1 h-fit">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" /> AI Prompt
          </h2>
          <textarea
            placeholder="Enter a topic (e.g. 'Workplace safety procedures') or paste a summary of your training content…"
            rows={6}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">Number of questions</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 size={14} /> {generating ? 'Generating…' : 'Generate Quiz with AI'}
          </button>
          <p className="mt-3 text-[11px] text-zinc-600">
            AI drafts are a starting point — review every question, option, and explanation before saving to your course.
          </p>

          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value);
                  setModuleId('');
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Module</label>
              <select
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                disabled={!selectedCourse}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Select a module…</option>
                {selectedCourse?.modules?.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Quiz title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Pass %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={passingThresholdPercent}
                  onChange={(e) => setPassingThresholdPercent(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Time (min)</label>
                <input
                  type="number"
                  min={0}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1">Attempts</label>
                <input
                  type="number"
                  min={0}
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ---------- Editable draft ---------- */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence>
            {questions.map((q, qIndex) => (
              <motion.div
                key={qIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: qIndex * 0.04 }}
              >
                <GlassCard className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={q.questionText}
                      onChange={(e) => updateQuestion(qIndex, { questionText: e.target.value })}
                      placeholder={`Question ${qIndex + 1}`}
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={q.questionType}
                      onChange={(e) =>
                        updateQuestion(qIndex, {
                          questionType: e.target.value,
                          options: e.target.value === 'short_answer' ? [] : q.options.length ? q.options : [makeOption('', true), makeOption('', false)],
                        })
                      }
                      className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-white"
                    >
                      <option value="single_choice">Single choice</option>
                      <option value="multiple_choice">Multi choice</option>
                      <option value="true_false">True/False</option>
                      <option value="short_answer">Short answer</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={q.points}
                      onChange={(e) => updateQuestion(qIndex, { points: e.target.value })}
                      className="w-16 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-white"
                      title="Points"
                    />
                    <button onClick={() => removeQuestion(qIndex)} className="text-zinc-500 hover:text-red-400">
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {q.questionType === 'short_answer' ? (
                    <p className="pl-2 text-xs text-zinc-500 italic">Learner provides a free-text answer — reviewed manually, not auto-graded.</p>
                  ) : (
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt) => (
                        <div key={opt.localId} className="flex items-center gap-2">
                          <input
                            type={q.questionType === 'multiple_choice' ? 'checkbox' : 'radio'}
                            name={'correct-' + qIndex}
                            checked={opt.isCorrect}
                            onChange={() =>
                              q.questionType === 'multiple_choice'
                                ? updateOption(qIndex, opt.localId, { isCorrect: !opt.isCorrect })
                                : setCorrectOption(qIndex, opt.localId)
                            }
                          />
                          <input
                            value={opt.text}
                            onChange={(e) => updateOption(qIndex, opt.localId, { text: e.target.value })}
                            placeholder="Option text"
                            className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {q.questionType !== 'true_false' && (
                            <button onClick={() => removeOption(qIndex, opt.localId)} className="text-zinc-600 hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      {q.questionType !== 'true_false' && (
                        <button onClick={() => addOption(qIndex)} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300">
                          <Plus size={11} /> Add option
                        </button>
                      )}
                    </div>
                  )}

                  {q.questionType !== 'short_answer' && (
                    <div className="mt-3 pl-2">
                      <label className="block text-[11px] text-zinc-500 mb-1">Explanation (shown to learners after they answer)</label>
                      <textarea
                        value={q.explanation || ''}
                        onChange={(e) => updateQuestion(qIndex, { explanation: e.target.value })}
                        placeholder="Why is the correct answer right, and why are the others wrong?"
                        rows={2}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </AnimatePresence>

          {questions.length === 0 && (
            <GlassCard className="p-10 text-center">
              <Sparkles size={22} className="mx-auto text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-400">Enter a topic and click "Generate Quiz with AI" to draft your first question set.</p>
            </GlassCard>
          )}

          {questions.length > 0 && (
            <div className="flex items-center justify-between">
              <button onClick={addQuestion} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                <Plus size={14} /> Add question manually
              </button>
              <button
                onClick={handleSaveToCourse}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save quiz to course'}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
