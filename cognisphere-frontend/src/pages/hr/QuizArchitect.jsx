import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Trash2, Save, Wand2 } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { listCourses, createQuiz, generateQuizDraft } from '../../api/hrApi';
import { notify } from '../../lib/toast';

let optionIdCounter = 0;
const nextOptionId = () => 'opt-' + optionIdCounter++;

function makeOption(text, isCorrect) {
  return { localId: nextOptionId(), text, isCorrect };
}

export default function QuizArchitect() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [title, setTitle] = useState('');
  const [passingThresholdPercent, setPassingThresholdPercent] = useState(80);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [maxAttempts, setMaxAttempts] = useState(3);

  const [questionCount, setQuestionCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCourses().then((res) => setCourses(res.data.data.courses));
  }, []);

  const selectedCourse = courses.find((c) => c._id === courseId);
  const selectedModule = selectedCourse?.modules?.find((m) => m._id === moduleId);

  /**
   * Calls the real backend AI endpoint, which pulls the ACTUAL content of
   * the selected module (its lessons' titles/text/media) and asks Claude
   * to generate questions grounded strictly in that content — this is
   * what makes the output module-relevant instead of generic. The AI's
   * {question, options, correctAnswerIndex, explanation} shape is mapped
   * into this page's existing editable question/option shape below.
   */
  const handleGenerate = async () => {
    if (!courseId || !moduleId) {
      notify.error('Select a course and module first — the AI generates questions from that module\'s actual content.');
      return;
    }
    setGenerating(true);
    try {
      const { data } = await generateQuizDraft({ courseId, moduleId, questionCount });
      const generated = data.data.questions.map((q) => ({
        questionText: q.question,
        questionType: 'single_choice',
        points: 5,
        explanation: q.explanation,
        options: q.options.map((text, i) => makeOption(text, i === q.correctAnswerIndex)),
      }));
      setQuestions(generated);
      setTitle((t) => t || `${data.data.moduleTitle} — Knowledge Check`);
      notify.success('Draft generated from the module\'s content — review and edit before saving.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
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
          <div className="mb-3">
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
          <div className="mb-3">
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
            {selectedModule && (
              <p className="mt-1.5 text-[11px] text-zinc-600">
                {selectedModule.lessons?.length || 0} lesson(s) in this module will be used as the AI's source content.
              </p>
            )}
          </div>
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
            disabled={generating || !courseId || !moduleId}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Wand2 size={14} /> {generating ? 'Generating…' : 'Generate Quiz with AI'}
          </button>
          <p className="mt-3 text-[11px] text-zinc-600">
            The AI reads this module's actual lesson content and generates questions strictly from it — review every
            question, option, and explanation before saving to your course.
          </p>

          <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
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
              <p className="text-sm text-zinc-400">Select a course and module, then click "Generate Quiz with AI" to draft your first question set.</p>
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
