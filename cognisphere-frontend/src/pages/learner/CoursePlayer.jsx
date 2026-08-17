import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RotateCcw, RotateCw, Maximize, PanelRightClose, PanelRightOpen } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ProgressBar from '../../components/ui/ProgressBar';
import { LockIcon, Badge } from '../../components/ui/Badge';
import { getCourse, getMyCourseProgress, markLessonProgress, getQuizForLearner, submitQuiz } from '../../api/learnerApi';
import { notify } from '../../lib/toast';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function getYoutubeEmbedUrl(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  return match ? 'https://www.youtube.com/embed/' + match[1] : null;
}

function getVimeoEmbedUrl(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? 'https://player.vimeo.com/video/' + match[1] : null;
}

export default function CoursePlayer() {
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [quizMode, setQuizMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [courseRes, progressRes] = await Promise.all([getCourse(courseId), getMyCourseProgress(courseId)]);
      setCourse(courseRes.data.data);
      setProgress(progressRes.data.data);

      const sortedModules = [...courseRes.data.data.modules].sort((a, b) => a.order - b.order);
      setActiveModuleId((prev) => prev || sortedModules[0]?._id || null);
      setActiveLessonId((prev) => prev || sortedModules[0]?.lessons[0]?._id || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load course.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) return <DashboardLayout><p className="text-gray-500">Loading course…</p></DashboardLayout>;
  if (error) return <DashboardLayout><p className="text-red-600">{error}</p></DashboardLayout>;

  const moduleStatus = (moduleId) => progress.modulesProgress.find((m) => m.moduleId === moduleId)?.status || 'locked';
  const lessonStatus = (moduleId, lessonId) => {
    const mp = progress.modulesProgress.find((m) => m.moduleId === moduleId);
    return mp?.lessonsProgress.find((l) => l.lessonId === lessonId)?.status || 'locked';
  };

  const activeModule = course.modules.find((m) => m._id === activeModuleId);
  const activeLesson = activeModule?.lessons.find((l) => l._id === activeLessonId);

  const markComplete = async () => {
    const { data } = await markLessonProgress(courseId, activeLessonId, { status: 'completed' });
    if (data.data.courseCompleted) {
      notify.success('Course completed! Your certificate is ready in My Profile.');
    } else if (data.data.nextModuleUnlocked) {
      notify.success(`"${data.data.nextModuleUnlocked.title}" is now unlocked!`);
    }
    await loadAll();
  };

  const selectLesson = (moduleId, lessonId) => {
    setActiveModuleId(moduleId);
    setActiveLessonId(lessonId);
    setQuizMode(false);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-4">
        <Link to="/learner/dashboard" className="text-sm text-primary hover:underline">
          ← Back to My Learning
        </Link>
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          {sidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          {sidebarOpen ? 'Hide playlist' : 'Show playlist'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---------- Main Stage ---------- */}
        <div className="flex-1 min-w-0">
          <div className="mb-3">
            <h1 className="font-bold text-lg text-gray-900">{course.title}</h1>
            {course.instructorId?.fullName && (
              <p className="text-xs text-gray-500">Instructor: {course.instructorId.fullName}</p>
            )}
            <ProgressBar percent={progress.overallProgressPercent} className="mt-2" />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {quizMode && activeModule?.quizId ? (
              <QuizRunner quizId={activeModule.quizId} onDone={loadAll} />
            ) : activeLesson ? (
              <LessonViewer lesson={activeLesson} onMarkComplete={markComplete} />
            ) : (
              <p className="text-gray-500">Select a lesson to begin.</p>
            )}
          </div>
        </div>

        {/* ---------- Right Sidebar Playlist ---------- */}
        {sidebarOpen && (
          <aside className="lg:w-80 shrink-0 space-y-3">
            {[...course.modules]
              .sort((a, b) => a.order - b.order)
              .map((mod) => {
                const mStatus = moduleStatus(mod._id);
                const isLocked = mStatus === 'locked';
                return (
                  <div key={mod._id} className={'bg-white border border-gray-200 rounded-lg p-3 ' + (isLocked ? 'locked-row' : '')}>
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-800">
                      <LockIcon status={mStatus} />
                      {mod.title}
                    </div>
                    <ul className="space-y-1 pl-6">
                      {[...mod.lessons]
                        .sort((a, b) => a.order - b.order)
                        .map((lesson) => {
                          const lStatus = lessonStatus(mod._id, lesson._id);
                          return (
                            <li key={lesson._id}>
                              <button
                                disabled={isLocked}
                                onClick={() => selectLesson(mod._id, lesson._id)}
                                className={
                                  'w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 ' +
                                  (activeLessonId === lesson._id && !quizMode ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50')
                                }
                              >
                                <LockIcon status={lStatus} />
                                {lesson.title}
                                <span className="ml-auto text-[10px] text-gray-400 uppercase">{lesson.contentType}</span>
                              </button>
                            </li>
                          );
                        })}
                      {mod.quizId && (
                        <li>
                          <button
                            disabled={isLocked}
                            onClick={() => {
                              setActiveModuleId(mod._id);
                              setQuizMode(true);
                            }}
                            className={
                              'w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-2 font-medium ' +
                              (quizMode && activeModuleId === mod._id ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50')
                            }
                          >
                            📝 Module Quiz
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
          </aside>
        )}
      </div>
    </DashboardLayout>
  );
}

function LessonViewer({ lesson, onMarkComplete }) {
  const videoRef = useRef(null);
  const [speed, setSpeed] = useState(1);

  const skip = (seconds) => {
    if (videoRef.current) videoRef.current.currentTime += seconds;
  };

  const changeSpeed = (value) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  };

  const enterFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  const provider = lesson.video?.provider;
  const youtubeEmbed = provider === 'youtube' && lesson.video?.url ? getYoutubeEmbedUrl(lesson.video.url) : null;
  const vimeoEmbed = provider === 'vimeo' && lesson.video?.url ? getVimeoEmbedUrl(lesson.video.url) : null;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">{lesson.title}</h2>

      {lesson.video?.url && (
        <>
          {youtubeEmbed || vimeoEmbed ? (
            <div className="aspect-video mb-4 rounded-lg overflow-hidden bg-black">
              <iframe
                title={lesson.title}
                src={youtubeEmbed || vimeoEmbed}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex justify-center bg-black rounded-lg overflow-hidden">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video ref={videoRef} controls className="max-h-[70vh] max-w-full" src={lesson.video.url} />
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button onClick={() => skip(-10)} className="flex items-center gap-1 text-xs rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">
                  <RotateCcw size={12} /> 10s
                </button>
                <button onClick={() => skip(10)} className="flex items-center gap-1 text-xs rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">
                  <RotateCw size={12} /> 10s
                </button>
                <select
                  value={speed}
                  onChange={(e) => changeSpeed(Number(e.target.value))}
                  className="text-xs rounded-md border border-gray-300 px-2 py-1"
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </select>
                <button onClick={enterFullscreen} className="flex items-center gap-1 text-xs rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-100">
                  <Maximize size={12} /> Fullscreen
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {lesson.pdf?.url && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            {lesson.video?.url && <p className="text-xs font-medium text-gray-500">Lesson resource (PDF)</p>}
            <a href={lesson.pdf.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline ml-auto">
              Open in new tab ↗
            </a>
          </div>
          <iframe title={lesson.title + ' PDF'} src={lesson.pdf.url} className="w-full h-[600px] rounded-lg border" />
        </div>
      )}

      {lesson.contentType === 'text' && <p className="text-gray-700 whitespace-pre-line mb-4">{lesson.textContent}</p>}

      <button
        onClick={onMarkComplete}
        className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90"
      >
        Mark lesson complete
      </button>
    </div>
  );
}

function QuizRunner({ quizId, onDone }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setResult(null);
    setAnswers({});
    setError('');
    getQuizForLearner(quizId)
      .then((res) => setQuiz(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load quiz.'));
  }, [quizId]);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!quiz) return <p className="text-gray-500">Loading quiz…</p>;

  const selectAnswer = (questionId, optionId, multi) => {
    setAnswers((prev) => {
      if (multi) {
        const current = prev[questionId] || [];
        const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        answers: quiz.questions.map((q) => ({ questionId: q._id, selectedOptionIds: answers[q._id] || [] })),
      };
      const { data } = await submitQuiz(quizId, payload);
      setResult(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{quiz.title} — Results</h2>
        <Badge variant={result.passed ? 'success' : 'danger'}>
          {result.passed ? 'Passed' : 'Not passed'} — {result.scorePercent}% (need {result.passingThresholdPercent}%)
        </Badge>
        {result.nextModuleUnlocked && <p className="mt-3 text-sm text-green-700">🎉 "{result.nextModuleUnlocked.title}" is now unlocked!</p>}
        {!result.passed && result.attemptsRemaining !== null && (
          <p className="mt-3 text-sm text-gray-600">Attempts remaining: {result.attemptsRemaining}</p>
        )}
        <button onClick={onDone} className="mt-4 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90">
          Continue
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{quiz.title}</h2>
      <p className="text-xs text-gray-500 mb-4">
        Passing score: {quiz.passingThresholdPercent}% · {quiz.questions.length} question(s)
        {quiz.timeLimitMinutes ? ' · ' + quiz.timeLimitMinutes + ' min limit' : ''}
      </p>

      <div className="space-y-5">
        {quiz.questions.map((q, qIndex) => {
          const multi = q.questionType === 'multiple_choice';
          return (
            <div key={q._id}>
              <p className="text-sm font-medium text-gray-800 mb-2">
                {qIndex + 1}. {q.questionText}
              </p>
              <div className="space-y-1 pl-2">
                {q.options.map((opt) => (
                  <label key={opt._id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name={'q-' + q._id}
                      checked={(answers[q._id] || []).includes(opt._id)}
                      onChange={() => selectAnswer(q._id, opt._id, multi)}
                    />
                    {opt.text}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-5 rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit quiz'}
      </button>
    </div>
  );
}
