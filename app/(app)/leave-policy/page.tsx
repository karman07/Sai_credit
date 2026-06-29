"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CalendarDays, Plus, Trash2, Save, Check, Edit2,
  Users, X, Loader2,
} from "lucide-react";
import { Button, Input, Label } from "../../../components/ui";
import {
  leavePolicyApi, usersApi, leavesApi,
  type LeavePolicy, type LeaveTypeConfig, type PublicHoliday, type AdminUser,
} from "../../../lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// 0=Sun through 6=Sat displayed in Mon–Sun order
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function dayOfWeekName(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}
function monthName(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "long" });
}

const BUILT_IN_IDS = new Set(["casual", "sick", "earned", "unpaid"]);

// ── Leave Type Row (inline edit) ──────────────────────────────────────────────

function LeaveTypeRow({
  lt,
  onChange,
  onDelete,
}: {
  lt: LeaveTypeConfig;
  onChange: (updated: LeaveTypeConfig) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(lt.name);
  const [days, setDays] = useState(String(lt.daysPerYear));
  const [color, setColor] = useState(lt.color);

  function save() {
    onChange({ ...lt, name: name.trim() || lt.name, daysPerYear: Number(days) || 0, color });
    setEditing(false);
  }

  if (editing) {
    return (
      <tr className="bg-primary/5">
        <td className="px-4 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs w-full" />
        </td>
        <td className="px-4 py-2">
          <Input type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} className="h-7 text-xs w-20" />
        </td>
        <td className="px-4 py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lt.isPaid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {lt.isPaid ? "Paid" : "Unpaid"}
          </span>
        </td>
        <td className="px-4 py-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 rounded cursor-pointer border border-border" />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="h-7 px-2 text-xs bg-primary text-white rounded-md hover:opacity-90 flex items-center gap-1">
              <Check className="size-3" /> Save
            </button>
            <button onClick={() => setEditing(false)} className="h-7 px-2 text-xs border border-border rounded-md hover:bg-surface-2 flex items-center gap-1">
              <X className="size-3" /> Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: lt.color }} />
          <span className="text-sm font-medium">{lt.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-foreground-secondary">
        {lt.daysPerYear > 0 ? `${lt.daysPerYear} days / year` : "No fixed quota"}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lt.isPaid ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {lt.isPaid ? "Paid" : "Unpaid"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="size-5 rounded inline-block border border-border" style={{ backgroundColor: lt.color }} />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="h-7 px-2 text-xs border border-border rounded-md hover:bg-surface-2 flex items-center gap-1 text-foreground-secondary"
          >
            <Edit2 className="size-3" /> Edit
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="h-7 px-2 text-xs border border-danger/30 text-danger rounded-md hover:bg-danger/10 flex items-center gap-1"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Leave Balances Section ────────────────────────────────────────────────────

interface LeaveBalance {
  userId: string;
  name: string;
  role: string;
  annualQuota: number;
  usedPaid: number;
  remaining: number;
  pending: number;
}

function LeaveBalancesSection({ policy }: { policy: LeavePolicy | null }) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: users } = await usersApi.list({ isActive: "true" });
      const year = new Date().getFullYear();

      const rows: LeaveBalance[] = await Promise.all(
        users.map(async (u) => {
          let usedPaid = 0;
          let pending = 0;
          try {
            const { data: res } = await leavesApi.list({ userId: u._id, limit: 200 });
            const all = res.leaves;
            usedPaid = all
              .filter((l) => l.status === "approved" && l.type !== "unpaid" && String(l.startDate).startsWith(String(year)))
              .reduce((s, l) => s + (l.totalDays ?? 0), 0);
            pending = all.filter((l) => l.status === "pending").length;
          } catch { /* skip */ }

          const annualQuota = policy?.leaveTypes
            .filter((lt) => lt.isPaid)
            .reduce((s, lt) => s + lt.daysPerYear, 0) ?? (u.annualLeaveQuota ?? 24);

          return {
            userId: u._id,
            name: `${u.firstName} ${u.lastName}`,
            role: u.role.replace(/_/g, " "),
            annualQuota,
            usedPaid,
            remaining: Math.max(0, annualQuota - usedPaid),
            pending,
          };
        }),
      );
      setBalances(rows);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [policy]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 text-muted text-sm">
        <Loader2 className="size-4 animate-spin mr-2" /> Loading balances...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Employee</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Role</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Annual Quota</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Used (Paid)</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Remaining</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Pending</th>
          </tr>
        </thead>
        <tbody>
          {balances.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">No employees found</td>
            </tr>
          )}
          {balances.map((b) => (
            <tr key={b.userId} className="border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors">
              <td className="px-4 py-3 font-medium">{b.name}</td>
              <td className="px-4 py-3 text-foreground-secondary capitalize">{b.role}</td>
              <td className="px-4 py-3">{b.annualQuota} days</td>
              <td className="px-4 py-3">
                <span className="font-medium text-amber-700">{b.usedPaid} days</span>
              </td>
              <td className="px-4 py-3">
                <span className={`font-semibold ${b.remaining > 5 ? "text-green-700" : b.remaining > 0 ? "text-amber-700" : "text-danger"}`}>
                  {b.remaining} days
                </span>
              </td>
              <td className="px-4 py-3">
                {b.pending > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    {b.pending} pending
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeavePolicyPage() {
  const [policy, setPolicy]           = useState<LeavePolicy | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState("");

  // Weekly off days local state
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0]);

  // Leave types local state
  const [leaveTypes, setLeaveTypes]   = useState<LeaveTypeConfig[]>([]);
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDays, setNewTypeDays] = useState("0");
  const [newTypePaid, setNewTypePaid] = useState(true);
  const [newTypeColor, setNewTypeColor] = useState("#6366f1");

  // Public holidays local state
  const [holidays, setHolidays]       = useState<PublicHoliday[]>([]);
  const [newHolDate, setNewHolDate]   = useState("");
  const [newHolName, setNewHolName]   = useState("");
  const [addingHol, setAddingHol]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await leavePolicyApi.get();
      setPolicy(data);
      setWeeklyOffDays(data.weeklyOffDays ?? [0]);
      setLeaveTypes(data.leaveTypes ?? []);
      setHolidays((data.publicHolidays ?? []).sort((a, b) => a.date.localeCompare(b.date)));
    } catch { /* will show empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function flash(msg: string) {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(""), 2500);
  }

  // ── Weekly schedule save ──────────────────────────────────────────────────
  async function saveWeeklySchedule() {
    setSaving(true);
    try {
      const { data } = await leavePolicyApi.update({ weeklyOffDays });
      setPolicy(data);
      flash("Weekly schedule saved");
    } catch (e: any) { flash("Error: " + (e.message ?? "Failed")); }
    finally { setSaving(false); }
  }

  function toggleDay(day: number) {
    setWeeklyOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }

  const workingDays = DISPLAY_ORDER.filter((d) => !weeklyOffDays.includes(d)).length;

  // ── Leave type handlers ───────────────────────────────────────────────────
  async function saveLeaveTypes(types: LeaveTypeConfig[]) {
    setSaving(true);
    try {
      const { data } = await leavePolicyApi.update({ leaveTypes: types });
      setPolicy(data);
      setLeaveTypes(data.leaveTypes);
      flash("Leave types saved");
    } catch (e: any) { flash("Error: " + (e.message ?? "Failed")); }
    finally { setSaving(false); }
  }

  function handleTypeChange(idx: number, updated: LeaveTypeConfig) {
    const next = leaveTypes.map((lt, i) => (i === idx ? updated : lt));
    setLeaveTypes(next);
    saveLeaveTypes(next);
  }

  function handleTypeDelete(idx: number) {
    const next = leaveTypes.filter((_, i) => i !== idx);
    setLeaveTypes(next);
    saveLeaveTypes(next);
  }

  async function addLeaveType() {
    const id = newTypeName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!id) return;
    const newType: LeaveTypeConfig = {
      id,
      name: newTypeName.trim(),
      daysPerYear: Number(newTypeDays) || 0,
      isPaid: newTypePaid,
      color: newTypeColor,
    };
    const next = [...leaveTypes, newType];
    setShowAddType(false);
    setNewTypeName(""); setNewTypeDays("0"); setNewTypePaid(true); setNewTypeColor("#6366f1");
    setLeaveTypes(next);
    await saveLeaveTypes(next);
  }

  // ── Holiday handlers ──────────────────────────────────────────────────────
  async function addHoliday() {
    if (!newHolDate || !newHolName.trim()) return;
    setAddingHol(true);
    try {
      const { data } = await leavePolicyApi.addHoliday({ date: newHolDate, name: newHolName.trim() });
      setPolicy(data);
      setHolidays((data.publicHolidays ?? []).sort((a, b) => a.date.localeCompare(b.date)));
      setNewHolDate(""); setNewHolName("");
      flash("Holiday added");
    } catch (e: any) { flash("Error: " + (e.message ?? "Failed")); }
    finally { setAddingHol(false); }
  }

  async function removeHoliday(date: string) {
    try {
      const { data } = await leavePolicyApi.removeHoliday(date);
      setPolicy(data);
      setHolidays((data.publicHolidays ?? []).sort((a, b) => a.date.localeCompare(b.date)));
      flash("Holiday removed");
    } catch (e: any) { flash("Error: " + (e.message ?? "Failed")); }
  }

  const thisYear = new Date().getFullYear();
  const thisYearHolidays = holidays.filter((h) => h.date.startsWith(String(thisYear)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading leave policy...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" /> Leave Policy
          </h1>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Configure weekly schedule, leave types, and public holidays
          </p>
        </div>
        {saveMsg && (
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${saveMsg.startsWith("Error") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {saveMsg}
          </span>
        )}
      </div>

      {/* ── Section 1: Weekly Schedule ─────────────────────────────────────── */}
      <div className="card rounded-xl border border-border bg-surface p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-base">Weekly Schedule</h2>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Select which days are <strong>working days</strong>. Deselected days are weekly off.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {DISPLAY_ORDER.map((dayNum) => {
            const isWorking = !weeklyOffDays.includes(dayNum);
            return (
              <button
                key={dayNum}
                onClick={() => toggleDay(dayNum)}
                className={`h-10 w-14 rounded-lg text-sm font-semibold border-2 transition-all select-none ${
                  isWorking
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-surface border-border text-muted hover:border-primary/40"
                }`}
              >
                {DAY_NAMES[dayNum]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-foreground-secondary">
            <span className="font-semibold text-foreground">{workingDays}</span> working day{workingDays !== 1 ? "s" : ""} per week
          </p>
          <Button size="sm" onClick={saveWeeklySchedule} loading={saving} className="flex items-center gap-1.5">
            <Save className="size-3.5" /> Save Schedule
          </Button>
        </div>
      </div>

      {/* ── Section 2: Leave Types ─────────────────────────────────────────── */}
      <div className="card rounded-xl border border-border bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base">Leave Types</h2>
            <p className="text-sm text-foreground-secondary mt-0.5">Manage annual quotas and leave categories</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddType((v) => !v)}>
            <Plus className="size-3.5" /> Add Type
          </Button>
        </div>

        {showAddType && (
          <div className="px-6 py-4 bg-primary/5 border-b border-border flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="e.g. Festival Leave"
                className="h-8 text-sm w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Days / Year</Label>
              <Input
                type="number" min={0}
                value={newTypeDays}
                onChange={(e) => setNewTypeDays(e.target.value)}
                className="h-8 text-sm w-20"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <select
                value={newTypePaid ? "paid" : "unpaid"}
                onChange={(e) => setNewTypePaid(e.target.value === "paid")}
                className="h-8 text-sm border border-border rounded-md px-2 bg-surface"
              >
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <input
                type="color" value={newTypeColor}
                onChange={(e) => setNewTypeColor(e.target.value)}
                className="h-8 w-12 rounded border border-border cursor-pointer"
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button size="sm" onClick={addLeaveType} disabled={!newTypeName.trim()}>
                <Check className="size-3.5" /> Add
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowAddType(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Leave Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Annual Quota</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Color</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveTypes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-sm">
                  No leave types configured
                </td>
              </tr>
            )}
            {leaveTypes.map((lt, idx) => (
              <LeaveTypeRow
                key={lt.id}
                lt={lt}
                onChange={(updated) => handleTypeChange(idx, updated)}
                onDelete={BUILT_IN_IDS.has(lt.id) ? undefined : () => handleTypeDelete(idx)}
              />
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-muted border-t border-border">
          Built-in types (Casual, Sick, Earned, Unpaid) cannot be deleted — only their quotas can be edited.
        </p>
      </div>

      {/* ── Section 3: Public Holidays ─────────────────────────────────────── */}
      <div className="card rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Public Holidays — {thisYear}</h2>
          <p className="text-sm text-foreground-secondary mt-0.5">
            These days are excluded from working days in payroll calculations
          </p>
        </div>

        {/* Add holiday form */}
        <div className="px-6 py-4 border-b border-border bg-surface-2/50">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={newHolDate}
                onChange={(e) => setNewHolDate(e.target.value)}
                className="h-8 text-sm w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Holiday Name</Label>
              <Input
                value={newHolName}
                onChange={(e) => setNewHolName(e.target.value)}
                placeholder="e.g. Diwali"
                className="h-8 text-sm w-48"
              />
            </div>
            <Button
              size="sm"
              onClick={addHoliday}
              loading={addingHol}
              disabled={!newHolDate || !newHolName.trim()}
            >
              <Plus className="size-3.5" /> Add Holiday
            </Button>
          </div>
        </div>

        {thisYearHolidays.length === 0 ? (
          <div className="px-6 py-10 text-center text-muted text-sm">
            No public holidays added for {thisYear}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Day</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Month</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider">Holiday Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {thisYearHolidays.map((h) => (
                <tr key={h.date} className="border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors">
                  <td className="px-4 py-3 font-medium">{fmtDate(h.date)}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{dayOfWeekName(h.date)}</td>
                  <td className="px-4 py-3 text-foreground-secondary">{monthName(h.date)}</td>
                  <td className="px-4 py-3">{h.name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeHoliday(h.date)}
                      className="h-7 px-2 text-xs border border-danger/30 text-danger rounded-md hover:bg-danger/10 flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {holidays.length > thisYearHolidays.length && (
          <p className="px-6 py-2 text-xs text-muted border-t border-border">
            {holidays.length - thisYearHolidays.length} holiday(s) from other years are stored but not shown above.
          </p>
        )}
      </div>

      {/* ── Section 4: Leave Balances ──────────────────────────────────────── */}
      <div className="card rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Users className="size-4 text-primary" /> Leave Balances — {thisYear}
          </h2>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Approved paid leave usage for all active employees this year
          </p>
        </div>
        <LeaveBalancesSection policy={policy} />
      </div>
    </div>
  );
}
