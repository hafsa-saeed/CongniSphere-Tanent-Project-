import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Upload,
  BookPlus,
  Phone,
  MapPin,
  CreditCard,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import GlassCard from "../../components/ui/GlassCard";
import Modal from "../../components/ui/Modal";
import Drawer from "../../components/ui/Drawer";
import { Badge } from "../../components/ui/Badge";
import { SkeletonList } from "../../components/ui/Skeleton";
import EmptyState from "../../components/ui/EmptyState";
import {
  listTenantUsers,
  registerUser,
  listCourses,
  assignCourse,
  getUserSummary,
} from "../../api/hrApi";
import { notify } from "../../lib/toast";

function formatCnic(value) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);
  return [part1, part2, part3].filter(Boolean).join("-");
}

/** Normalizes any typed input toward 03XX-XXXXXXX (also accepts a +92 prefix). */
function formatPakPhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92")) digits = "0" + digits.slice(2);
  if (digits && !digits.startsWith("0")) digits = "0" + digits;
  digits = digits.slice(0, 11);
  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 11);
  return [part1, part2].filter(Boolean).join("-");
}

const initialAddForm = {
  fullName: "",
  email: "",
  password: "",
  department: "",
  jobTitle: "",
  cnic: "",
  phone: "",
  address: "",
};

export default function LearnerDeptDirectory() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(initialAddForm);
  const [submitting, setSubmitting] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [assignTarget, setAssignTarget] = useState(null);
  const [assignCourseId, setAssignCourseId] = useState("");

  const [inspectorTarget, setInspectorTarget] = useState(null);
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, coursesRes] = await Promise.all([
        listTenantUsers({ role: "learner" }),
        listCourses({ status: "published" }),
      ]);
      setUsers(usersRes.data.data);
      setCourses(coursesRes.data.data.courses);
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to load directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openInspector = async (u) => {
    setInspectorTarget(u);
    setInspectorLoading(true);
    try {
      const { data } = await getUserSummary(u._id);
      setInspectorData(data.data);
    } catch (err) {
      notify.error(
        err.response?.data?.message || "Failed to load learner detail.",
      );
    } finally {
      setInspectorLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (
      !addForm.fullName.trim() ||
      !addForm.email.trim() ||
      !addForm.password.trim()
    ) {
      notify.error("Full name, email and password are required.");
      return;
    }
    if (addForm.cnic && !/^\d{5}-\d{7}-\d{1}$/.test(addForm.cnic)) {
      notify.error("CNIC must be in the format XXXXX-XXXXXXX-X.");
      return;
    }
    if (addForm.phone && !/^0[\s-]?3\d{2}[\s-]?\d{7}$/.test(addForm.phone)) {
      notify.error(
        "Phone must be a valid Pakistani mobile number, e.g. 0301-1234567.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await registerUser({ ...addForm, role: "learner" });
      notify.success(addForm.fullName + " added.");
      setAddForm(initialAddForm);
      setAddOpen(false);
      load();
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to add learner.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const [header, ...rows] = lines;
      const cols = header.split(",").map((c) => c.trim().toLowerCase());
      const nameIdx = cols.indexOf("name");
      const emailIdx = cols.indexOf("email");
      const deptIdx = cols.indexOf("department");
      const cnicIdx = cols.indexOf("cnic");
      const phoneIdx = cols.indexOf("phone");
      const addressIdx = cols.indexOf("address");

      let successCount = 0;
      for (const row of rows) {
        const cells = row.split(",").map((c) => c.trim());
        const fullName = cells[nameIdx];
        const email = cells[emailIdx];
        if (!fullName || !email) continue;
        try {
          await registerUser({
            fullName,
            email,
            password: "Welcome" + Math.random().toString(36).slice(-6) + "!",
            department: deptIdx !== -1 ? cells[deptIdx] : "",
            cnic: cnicIdx !== -1 ? cells[cnicIdx] : undefined,
            phone: phoneIdx !== -1 ? cells[phoneIdx] : undefined,
            address: addressIdx !== -1 ? cells[addressIdx] : undefined,
            role: "learner",
          });
          successCount += 1;
        } catch {
          // skip rows that fail (e.g. duplicate email, bad CNIC format) and continue the batch
        }
      }
      notify.success(
        "Imported " + successCount + " of " + rows.length + " learners.",
      );
      setImportFile(null);
      load();
    } catch (err) {
      notify.error("Failed to parse CSV file.");
    } finally {
      setImporting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignCourseId) {
      notify.error("Select a course first.");
      return;
    }
    try {
      await assignCourse(assignCourseId, assignTarget._id);
      notify.success("Course assigned to " + assignTarget.fullName + ".");
      setAssignTarget(null);
      setAssignCourseId("");
    } catch (err) {
      notify.error(err.response?.data?.message || "Failed to assign course.");
    }
  };

  const grouped = users.reduce((acc, u) => {
    const dept = u.department || "Unassigned";
    acc[dept] = acc[dept] || [];
    acc[dept].push(u);
    return acc;
  }, {});

  return (
    <DashboardLayout dark>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          Learner &amp; Dept Directory
        </h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 cursor-pointer">
            <Upload size={14} /> {importFile ? importFile.name : "Import CSV"}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setImportFile(e.target.files[0])}
            />
          </label>
          {importFile && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Run import"}
            </button>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Plus size={16} /> Add Learner
          </button>
        </div>
      </div>
      <p className="text-xs text-zinc-500 -mt-4 mb-6">
        CSV format: name,email,department,cnic,phone,address (header row
        required)
      </p>

      {loading ? (
        <SkeletonList items={3} />
      ) : users.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Users}
            title="No learners yet"
            description="Add your first employee or import a CSV to get started."
          />
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dept, deptUsers]) => (
            <div key={dept}>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">
                {dept}{" "}
                <span className="text-zinc-600 font-normal">
                  ({deptUsers.length})
                </span>
              </h2>
              <GlassCard className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-white/10 text-xs">
                      <th className="px-5 py-2 font-medium">Name</th>
                      <th className="px-5 py-2 font-medium">Email</th>
                      <th className="px-5 py-2 font-medium">CNIC</th>
                      <th className="px-5 py-2 font-medium">Phone</th>
                      <th className="px-5 py-2 font-medium">Status</th>
                      <th className="px-5 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptUsers.map((u) => (
                      <tr
                        key={u._id}
                        className="border-b border-white/5 last:border-0 text-zinc-200"
                      >
                        <td
                          className="px-5 py-3 cursor-pointer"
                          onClick={() => openInspector(u)}
                        >
                          {u.fullName}
                        </td>
                        <td className="px-5 py-3 text-zinc-400">{u.email}</td>
                        <td className="px-5 py-3 text-zinc-400 font-mono text-xs">
                          {u.cnic || "—"}
                        </td>
                        <td className="px-5 py-3 text-zinc-400">
                          {u.phone || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={u.isActive ? "success" : "danger"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setAssignTarget(u)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 ml-auto"
                          >
                            <BookPlus size={12} /> Assign course
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Add learner modal ---------- */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add learner"
      >
        <form
          onSubmit={handleAdd}
          className="space-y-3 max-h-[70vh] overflow-y-auto pr-1"
        >
          <input
            placeholder="Full name"
            value={addForm.fullName}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, fullName: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="email"
            placeholder="Email"
            value={addForm.email}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, email: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="Temporary password"
            value={addForm.password}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, password: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="CNIC (XXXXX-XXXXXXX-X) — optional"
            value={addForm.cnic}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, cnic: formatCnic(e.target.value) }))
            }
            maxLength={15}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Phone (03XX-XXXXXXX) — optional"
            value={addForm.phone}
            onChange={(e) =>
              setAddForm((f) => ({
                ...f,
                phone: formatPakPhone(e.target.value),
              }))
            }
            maxLength={12}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Address — optional"
            value={addForm.address}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, address: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Department"
            value={addForm.department}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, department: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            placeholder="Job title"
            value={addForm.jobTitle}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, jobTitle: e.target.value }))
            }
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add learner"}
          </button>
        </form>
      </Modal>

      {/* ---------- Assign course modal ---------- */}
      <Modal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title={"Assign course — " + (assignTarget?.fullName || "")}
        onConfirm={handleAssign}
        confirmLabel="Assign"
      >
        <select
          value={assignCourseId}
          onChange={(e) => setAssignCourseId(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select a course…</option>
          {courses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.title}
            </option>
          ))}
        </select>
      </Modal>

      {/* ---------- Learner Inspector Drawer ---------- */}
      <Drawer
        open={!!inspectorTarget}
        onClose={() => {
          setInspectorTarget(null);
          setInspectorData(null);
        }}
        title={inspectorTarget?.fullName || "Learner"}
      >
        {inspectorLoading || !inspectorData ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-5 w-40 bg-zinc-800 rounded" />
            <div className="h-24 w-full bg-zinc-800 rounded" />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-base font-semibold text-white">
                {inspectorData.user.fullName}
              </p>
              <p className="text-xs text-zinc-500">
                {inspectorData.user.email}
              </p>
              <p className="text-xs text-zinc-500">
                {inspectorData.user.department || "No department"} ·{" "}
                {inspectorData.user.jobTitle || "—"}
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <CreditCard size={12} className="text-zinc-500" />{" "}
                {inspectorData.user.cnic || "No CNIC on file"}
              </div>
              <div className="flex items-center gap-2">
                <Phone size={12} className="text-zinc-500" />{" "}
                {inspectorData.user.phone || "No phone on file"}
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-zinc-500" />{" "}
                {inspectorData.user.address || "No address on file"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-zinc-500">Courses Enrolled</p>
                <p className="text-lg font-bold text-white">
                  {inspectorData.stats.totalCoursesEnrolled}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs text-zinc-500">Quiz Pass Rate</p>
                <p className="text-lg font-bold text-white">
                  {inspectorData.stats.quizPassRatePercent}%
                </p>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-semibold uppercase text-zinc-500 mb-2">
                Course Progress
              </h5>
              <div className="space-y-2">
                {inspectorData.progressRecords.map((p) => (
                  <div
                    key={p._id}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-white">{p.courseId?.title}</p>
                      <Badge
                        variant={
                          p.status === "completed" ? "success" : "primary"
                        }
                      >
                        {p.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: p.overallProgressPercent + "%" }}
                      />
                    </div>
                  </div>
                ))}
                {inspectorData.progressRecords.length === 0 && (
                  <p className="text-xs text-zinc-500">
                    Not enrolled in any courses yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </DashboardLayout>
  );
}
