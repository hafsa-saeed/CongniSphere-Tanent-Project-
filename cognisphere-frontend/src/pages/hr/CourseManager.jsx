import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Plus, Video, FileText, Upload, X } from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GlassCard from '../../components/ui/GlassCard';
import { createCourse, uploadFile } from '../../api/hrApi';
import { notify } from '../../lib/toast';

let localIdCounter = 0;
const nextLocalId = () => `local-${Date.now()}-${localIdCounter++}`;

function emptyLesson() {
  return { localId: nextLocalId(), title: '', videoUrl: '', pdfUrl: '', estimatedMinutes: 5 };
}

function emptyModule() {
  return { localId: nextLocalId(), title: '', lessons: [emptyLesson()] };
}

export default function CourseManager() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [modules, setModules] = useState([emptyModule()]);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [saving, setSaving] = useState(false);

  const updateModule = (moduleLocalId, patch) =>
    setModules((mods) => mods.map((m) => (m.localId === moduleLocalId ? { ...m, ...patch } : m)));

  const updateLesson = (moduleLocalId, lessonLocalId, patch) =>
    setModules((mods) =>
      mods.map((m) =>
        m.localId !== moduleLocalId
          ? m
          : { ...m, lessons: m.lessons.map((l) => (l.localId === lessonLocalId ? { ...l, ...patch } : l)) }
      )
    );

  const addModule = () => setModules((mods) => [...mods, emptyModule()]);
  const removeModule = (moduleLocalId) => setModules((mods) => mods.filter((m) => m.localId !== moduleLocalId));

  const addLesson = (moduleLocalId) =>
    setModules((mods) => mods.map((m) => (m.localId === moduleLocalId ? { ...m, lessons: [...m.lessons, emptyLesson()] } : m)));

  const removeLesson = (moduleLocalId, lessonLocalId) =>
    setModules((mods) =>
      mods.map((m) => (m.localId === moduleLocalId ? { ...m, lessons: m.lessons.filter((l) => l.localId !== lessonLocalId) } : m))
    );

  const handleFileSelect = async (moduleLocalId, lessonLocalId, kind, file) => {
    if (!file) return;
    const key = moduleLocalId + ':' + lessonLocalId + ':' + kind;
    setUploadingKey(key);
    try {
      const { data } = await uploadFile(kind, file);
      updateLesson(moduleLocalId, lessonLocalId, kind === 'video' ? { videoUrl: data.data.url } : { pdfUrl: data.data.url });
      notify.success((kind === 'video' ? 'Video' : 'PDF') + ' uploaded.');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === 'MODULE') {
      setModules((mods) => {
        const reordered = Array.from(mods);
        const [moved] = reordered.splice(source.index, 1);
        reordered.splice(destination.index, 0, moved);
        return reordered;
      });
      return;
    }

    const moduleLocalId = source.droppableId.replace('lessons-', '');
    setModules((mods) =>
      mods.map((m) => {
        if (m.localId !== moduleLocalId) return m;
        const reordered = Array.from(m.lessons);
        const [moved] = reordered.splice(source.index, 1);
        reordered.splice(destination.index, 0, moved);
        return { ...m, lessons: reordered };
      })
    );
  };

  const handleSave = async (publishOverride) => {
    if (!title.trim()) {
      notify.error('Course title is required.');
      return;
    }

    setSaving(true);
    try {
      const shouldPublish = publishOverride === undefined ? isPublished : publishOverride;
      const payload = {
        title,
        description,
        category,
        status: shouldPublish ? 'published' : 'draft',
        modules: modules.map((m, mIndex) => ({
          title: m.title || ('Module ' + (mIndex + 1)),
          order: mIndex,
          lessons: m.lessons.map((l, lIndex) => ({
            title: l.title || ('Lesson ' + (lIndex + 1)),
            order: lIndex,
            // contentType is kept as a lightweight display hint (icons, the
            // learner sidebar's tag) — it no longer gates which media can be
            // attached; video and pdf are independent and either or both may
            // be present.
            contentType: l.videoUrl ? 'video' : l.pdfUrl ? 'pdf' : 'text',
            estimatedMinutes: Number(l.estimatedMinutes) || 0,
            ...(l.videoUrl ? { video: { url: l.videoUrl } } : {}),
            ...(l.pdfUrl ? { pdf: { url: l.pdfUrl } } : {}),
          })),
        })),
      };

      await createCourse(payload);
      notify.success('Course ' + (shouldPublish ? 'published.' : 'saved as draft.'));
      navigate('/hr/courses');
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Course Manager</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{isPublished ? 'Published' : 'Draft'}</span>
          <button
            onClick={() => setIsPublished((p) => !p)}
            className={'relative h-6 w-11 rounded-full transition-colors ' + (isPublished ? 'bg-emerald-500' : 'bg-zinc-700')}
          >
            <span
              className={'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ' + (isPublished ? 'translate-x-5' : 'translate-x-0.5')}
            />
          </button>
        </div>
      </div>

      <GlassCard className="p-5 mb-6 space-y-3">
        <input
          placeholder="Course title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          placeholder="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          placeholder="Category (e.g. Onboarding, Compliance)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </GlassCard>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="modules" type="MODULE">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {modules.map((mod, mIndex) => (
                <Draggable key={mod.localId} draggableId={mod.localId} index={mIndex}>
                  {(modProvided) => (
                    <GlassCard className="p-4" ref={modProvided.innerRef} {...modProvided.draggableProps}>
                      <div className="flex items-center gap-2 mb-3">
                        <span {...modProvided.dragHandleProps} className="cursor-grab text-zinc-600">
                          <GripVertical size={16} />
                        </span>
                        <input
                          placeholder={'Module ' + (mIndex + 1) + ' title'}
                          value={mod.title}
                          onChange={(e) => updateModule(mod.localId, { title: e.target.value })}
                          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button onClick={() => removeModule(mod.localId)} className="text-zinc-500 hover:text-red-400">
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <Droppable droppableId={'lessons-' + mod.localId} type="LESSON">
                        {(lessonProvided) => (
                          <div ref={lessonProvided.innerRef} {...lessonProvided.droppableProps} className="space-y-2 pl-6">
                            {mod.lessons.map((lesson, lIndex) => {
                              const key = mod.localId + ':' + lesson.localId;
                              return (
                                <Draggable key={lesson.localId} draggableId={lesson.localId} index={lIndex}>
                                  {(lessonDragProvided) => (
                                    <div
                                      ref={lessonDragProvided.innerRef}
                                      {...lessonDragProvided.draggableProps}
                                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2"
                                    >
                                      <span {...lessonDragProvided.dragHandleProps} className="cursor-grab text-zinc-600">
                                        <GripVertical size={13} />
                                      </span>
                                      <input
                                        placeholder={'Lesson ' + (lIndex + 1) + ' title'}
                                        value={lesson.title}
                                        onChange={(e) => updateLesson(mod.localId, lesson.localId, { title: e.target.value })}
                                        className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      />

                                      <label className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer whitespace-nowrap">
                                        <Video size={12} />
                                        {uploadingKey === key + ':video' ? 'Uploading…' : lesson.videoUrl ? 'Replace video' : 'Add video'}
                                        <input
                                          type="file"
                                          accept="video/*"
                                          className="hidden"
                                          onChange={(e) => handleFileSelect(mod.localId, lesson.localId, 'video', e.target.files[0])}
                                        />
                                      </label>
                                      {lesson.videoUrl && (
                                        <button
                                          onClick={() => updateLesson(mod.localId, lesson.localId, { videoUrl: '' })}
                                          className="text-zinc-600 hover:text-red-400"
                                          title="Remove video"
                                        >
                                          <X size={11} />
                                        </button>
                                      )}

                                      <label className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer whitespace-nowrap">
                                        <FileText size={12} />
                                        {uploadingKey === key + ':pdf' ? 'Uploading…' : lesson.pdfUrl ? 'Replace PDF' : 'Add PDF'}
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          className="hidden"
                                          onChange={(e) => handleFileSelect(mod.localId, lesson.localId, 'pdf', e.target.files[0])}
                                        />
                                      </label>
                                      {lesson.pdfUrl && (
                                        <button
                                          onClick={() => updateLesson(mod.localId, lesson.localId, { pdfUrl: '' })}
                                          className="text-zinc-600 hover:text-red-400"
                                          title="Remove PDF"
                                        >
                                          <X size={11} />
                                        </button>
                                      )}

                                      <button onClick={() => removeLesson(mod.localId, lesson.localId)} className="text-zinc-600 hover:text-red-400">
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {lessonProvided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      <button
                        onClick={() => addLesson(mod.localId)}
                        className="mt-2 ml-6 flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        <Plus size={12} /> Add lesson
                      </button>
                    </GlassCard>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <button onClick={addModule} className="mt-4 flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 font-medium">
        <Plus size={14} /> Add module
      </button>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          Save as draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <Upload size={14} /> {saving ? 'Saving…' : 'Publish course'}
        </button>
      </div>
    </DashboardLayout>
  );
}
