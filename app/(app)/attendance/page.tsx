"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, CalendarDays, LogIn, LogOut, Timer, Edit2, Check, X } from "lucide-react";
import { MonthPicker } from "../../../components/MonthPicker";
import { Button, Input, Select, Label } from "../../../components/ui";
import {
  attendanceApi, usersApi,
  type AttendanceRecord, type StaffAttendanceSummary, type AdminUser,
} from "../../../lib/api";

const STATUS_OPTS = [
  { value: "present",  label: "Present",  color: "text-green-700 bg-green-50 border-green-200" },
  { value: "absent",   label: "Absent",   color: "text-red-700 bg-red-50 border-red-200" },
  { value: "half_day", label: "Half Day", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  { value: "on_leave", label: "On Leave", color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "holiday",  label: "Holiday",  color: "text-purple-700 bg-purple-50 border-purple-200" },
];

function statusCfg(s: string) {
  return STATUS_OPTS.find((o) => o.value === s) ?? { label: s, color: "text-muted" };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtTime(iso?: string) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}
function nowMonth() { return new Date().toISOString().slice(0, 7); }

type Tab = "staff" | "log" | "mark";

export default function AdminAttendancePage() {
  const [tab, setTab] = useState<Tab>("staff");
  const [month, setMonth] = useState(nowMonth());
  const [staffList, setStaffList] = useState<StaffAttendanceSummary[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Mark attendance form
  const [markForm, setMarkForm] = useState({
    userId: "", date: new Date().toISOString().slice(0, 10),
    status: "present", clockIn: "", clockOut: "", note: "",
  });
  const [marking, setMarking] = useState(false);
  const [markSuccess, setMarkSuccess] = useState("");

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await attendanceApi.staffList(month);
      setStaffList(res.data);
    } catch { setError("Failed to load staff attendance"); }
    finally { setLoading(false); }
  }, [month]);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q: Record<string, string> = { month };
      if (filterUser) q.userId = filterUser;
      const res = await attendanceApi.list(q);
      setRecords(res.data.records);
    } catch { setError("Failed to load records"); }
    finally { setLoading(false); }
  }, [month, filterUser]);

  useEffect(() => {
    usersApi.list({ isActive: true }).then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "staff") loadStaff();
    else if (tab === "log") loadLog();
  }, [tab, loadStaff, loadLog]);

  async function handleMark(e: React.FormEvent) {
    e.preventDefault();
    setMarking(true);
    setError("");
    setMarkSuccess("");
    try {
      await attendanceApi.adminMark({
        userId: markForm.userId,
        date: markForm.date,
        status: markForm.status,
        clockIn: markForm.clockIn || undefined,
        clockOut: markForm.clockOut || undefined,
        note: markForm.note || undefined,
      });
      setMarkSuccess(`Attendance marked for ${markForm.date}`);
      setMarkForm((f) => ({ ...f, clockIn: "", clockOut: "", note: "" }));
      if (tab === "log") loadLog();
      if (tab === "staff") loadStaff();
    } catch (e: any) {
      setError(e.message ?? "Failed to mark attendance");
    } finally {
      setMarking(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      await attendanceApi.update(id, { status: editStatus, note: editNote || undefined });
      setEditId(null);
      loadLog();
    } catch (e: any) { setError(e.message ?? "Update failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Attendance Management</h1>
          <p className="text-sm text-muted mt-0.5">Monitor and manage staff attendance</p>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["staff", "log", "mark"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t === "staff" ? "Staff Overview" : t === "log" ? "Daily Log" : "Mark Attendance"}
          </button>
        ))}
      </div>

      {/* Staff Overview Tab */}
      {tab === "staff" && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted">Loading…</div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No staff found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    {["Staff", "Role", "Present", "Half Day", "Absent", "On Leave", "Marked"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffList.map((s) => (
                    <tr key={String(s.userId)} className="hover:bg-surface-2/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.name}</p>
                        {s.employeeCode && <p className="text-xs text-muted">{s.employeeCode}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted capitalize">{s.role.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">{s.present}</td>
                      <td className="px-4 py-3 font-semibold text-yellow-600">{s.halfDay}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{s.absent}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">{s.onLeave}</td>
                      <td className="px-4 py-3 text-muted">{s.totalMarked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Daily Log Tab */}
      {tab === "log" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Staff</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">Loading…</div>
            ) : records.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">No records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50">
                      {["Staff", "Date", "Status", "Clock In", "Clock Out", "Hours", "Note", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {records.map((r) => {
                      const user = typeof r.userId === "object" ? r.userId : null;
                      const cfg = statusCfg(r.status);
                      const isEditing = editId === r._id;
                      return (
                        <tr key={r._id} className="hover:bg-surface-2/40">
                          <td className="px-3 py-3">
                            <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : "—"}</p>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="text-xs text-muted">{fmtDate(r.date)}</p>
                            <p className="text-xs text-muted/60">{r.date}</p>
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="input text-xs py-1"
                              >
                                {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 text-xs rounded-full border ${cfg.color}`}>{cfg.label}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted flex items-center gap-1">
                            {r.clockIn && <><LogIn className="size-3.5" /> {fmtTime(r.clockIn)}</>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted">
                            {r.clockOut && <span className="flex items-center gap-1"><LogOut className="size-3.5" /> {fmtTime(r.clockOut)}</span>}
                          </td>
                          <td className="px-3 py-3">
                            {r.workHours > 0 && <span className="flex items-center gap-1 text-muted"><Timer className="size-3.5" />{r.workHours}h</span>}
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <input
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="input text-xs py-1 w-32"
                                placeholder="Note…"
                              />
                            ) : (
                              <span className="text-xs text-muted">{r.note ?? "—"}</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button onClick={() => saveEdit(r._id)} disabled={saving} className="text-green-600 hover:text-green-800">
                                  <Check className="size-4" />
                                </button>
                                <button onClick={() => setEditId(null)} className="text-muted hover:text-foreground">
                                  <X className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditId(r._id); setEditStatus(r.status); setEditNote(r.note ?? ""); }}
                                className="text-muted hover:text-primary"
                              >
                                <Edit2 className="size-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mark Attendance Tab */}
      {tab === "mark" && (
        <div className="max-w-xl animate-fadeIn">
          <div className="card overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border bg-surface-2/40">
              <div className="size-10 rounded-lg bg-primary-subtle flex items-center justify-center shrink-0">
                <CalendarDays className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold tracking-tight">Mark / Correct Attendance</h2>
                <p className="text-xs text-muted mt-0.5">Record or update staff attendance for any date</p>
              </div>
            </div>

            {markSuccess && (
              <div className="mx-6 mt-5 flex items-center gap-2 rounded-lg border border-success-border bg-success-subtle px-4 py-3 text-sm text-success">
                <Check className="size-4 shrink-0" />
                {markSuccess}
              </div>
            )}

            <form onSubmit={handleMark} className="p-6 space-y-5">
              {/* Staff Member */}
              <div className="space-y-1.5">
                <Label htmlFor="mark-staff">Staff Member</Label>
                <Select
                  id="mark-staff"
                  value={markForm.userId}
                  onChange={(e) => setMarkForm((f) => ({ ...f, userId: e.target.value }))}
                  className="w-full"
                  required
                >
                  <option value="">Select staff…</option>
                  {users.filter((u) => ["sales_executive", "telecaller", "relationship_manager"].includes(u.role)).map((u) => (
                    <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.role})</option>
                  ))}
                </Select>
              </div>

              <div className="border-t border-border-subtle" />

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="mark-date">Date</Label>
                <Input
                  id="mark-date"
                  type="date"
                  value={markForm.date}
                  onChange={(e) => setMarkForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full"
                  required
                />
              </div>

              {/* Status chips */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setMarkForm((f) => ({ ...f, status: o.value }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        markForm.status === o.value
                          ? o.color + " shadow-sm ring-2 ring-offset-1 ring-current/20"
                          : "border-border text-muted bg-surface hover:bg-surface-2"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border-subtle" />

              {/* Clock In / Clock Out */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mark-clock-in">
                    Clock In{" "}
                    <span className="normal-case font-normal text-muted/70">(optional)</span>
                  </Label>
                  <Input
                    id="mark-clock-in"
                    type="time"
                    value={markForm.clockIn}
                    onChange={(e) => setMarkForm((f) => ({ ...f, clockIn: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mark-clock-out">
                    Clock Out{" "}
                    <span className="normal-case font-normal text-muted/70">(optional)</span>
                  </Label>
                  <Input
                    id="mark-clock-out"
                    type="time"
                    value={markForm.clockOut}
                    onChange={(e) => setMarkForm((f) => ({ ...f, clockOut: e.target.value }))}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label htmlFor="mark-note">
                  Note{" "}
                  <span className="normal-case font-normal text-muted/70">(optional)</span>
                </Label>
                <Input
                  id="mark-note"
                  type="text"
                  placeholder="Admin note…"
                  value={markForm.note}
                  onChange={(e) => setMarkForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full"
                />
              </div>

              <div className="pt-1">
                <Button type="submit" loading={marking} className="w-full" size="lg">
                  Save Attendance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
