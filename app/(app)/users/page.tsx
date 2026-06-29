"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Edit2, Power, KeyRound } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, Select, SearchInput,
  SectionHeader, ConfirmDialog, Pagination, EmptyState, useToast,
  type BadgeTone,
} from "../../../components/ui";
import { ApiError, usersApi, type AdminUser, type PageMeta, type CreateUserBody, type UpdateUserBody } from "../../../lib/api";
import { UserDrawer } from "../../../components/UserDrawer";

const ROLES = [
  { value: "owner",                label: "Owner" },
  { value: "admin",                label: "Admin" },
  { value: "operations",           label: "Operations" },
  { value: "sales_executive",      label: "Sales Executive" },
  { value: "telecaller",           label: "Telecaller" },
  { value: "relationship_manager", label: "Relationship Manager" },
] as const;
type AppRole = typeof ROLES[number]["value"];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", sales_executive: "Sales", owner: "Owner",
  operations: "Operations", telecaller: "Telecaller", relationship_manager: "Rel. Manager",
};
const ROLE_TONE: Record<string, BadgeTone> = {
  admin: "info", sales_executive: "success", owner: "purple",
  operations: "orange", telecaller: "neutral", relationship_manager: "neutral",
};
const AVATAR_COLORS = ["#6683FF", "#4ADE80", "#FBBF24", "#F87171", "#A78BFA", "#2DD4BF"];

const LIMIT = 10;

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, meta: m } = await usersApi.list({ page, limit: LIMIT, search: debounced || undefined });
      setUsers(data);
      if (m) setMeta(m);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);

  async function handleToggle() {
    if (!toggleTarget) return;
    try {
      await usersApi.toggleStatus(toggleTarget._id);
      toast("success", `${toggleTarget.firstName} ${toggleTarget.isActive ? "deactivated" : "activated"}`);
      load();
    } catch {
      toast("error", "Failed to update status");
    } finally {
      setToggleTarget(null);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="User & Role Management"
        description="Manage users, assign roles, and control access"
        action={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add User
          </Button>
        }
      />

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users…" className="w-64" />
          <span className="ml-auto text-xs text-muted">
            {meta ? `${meta.total} total` : ""}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j}><div className="h-4 bg-surface-2 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={5}><EmptyState title="No users found" description={search ? "Try a different search term." : "Add your first user above."} /></td></tr>
              ) : (
                users.map((u, idx) => (
                  <tr
                    key={u._id}
                    className="cursor-pointer"
                    onClick={() => setDrawerUser(u)}
                  >
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-7 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0"
                          style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                        >
                          {u.firstName[0]}{u.lastName[0]}
                        </span>
                        <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                      </div>
                    </td>
                    <td className="text-sm text-foreground-secondary">{u.email}</td>
                    <td><Badge tone={ROLE_TONE[u.role] ?? "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                    <td><Badge tone={u.isActive ? "success" : "neutral"} dot>{u.isActive ? "Active" : "Inactive"}</Badge></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditUser(u)}
                          title="Edit"
                          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setPwdUser(u)}
                          title="Set password"
                          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                        >
                          <KeyRound className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setToggleTarget(u)}
                          title={u.isActive ? "Deactivate" : "Activate"}
                          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                        >
                          <Power className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={LIMIT}
            onPage={setPage}
            onLimit={() => {}}
          />
        )}
      </div>

      {/* Add / Edit user */}
      {(addOpen || !!editUser) && (
        <UserFormModal
          user={editUser}
          onClose={() => { setAddOpen(false); setEditUser(null); }}
          onSaved={() => { setAddOpen(false); setEditUser(null); load(); }}
        />
      )}

      {/* Set password */}
      {!!pwdUser && (
        <SetPasswordModal
          user={pwdUser}
          onClose={() => setPwdUser(null)}
          onSaved={() => { setPwdUser(null); toast("success", "Password updated"); }}
        />
      )}

      {/* Toggle status */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={`${toggleTarget?.isActive ? "Deactivate" : "Activate"} ${toggleTarget?.firstName}?`}
        description={
          toggleTarget?.isActive
            ? "This user will immediately lose portal access."
            : "This user will regain portal access."
        }
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Activate"}
        variant={toggleTarget?.isActive ? "danger" : "primary"}
      />

      {/* User detail drawer */}
      <UserDrawer user={drawerUser} onClose={() => setDrawerUser(null)} />
    </div>
  );
}

// ── Add / Edit user modal ──────────────────────────────────────────

function UserFormModal({
  user, onClose, onSaved,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!user;
  const [form, setForm] = useState({
    firstName:       user?.firstName    ?? "",
    lastName:        user?.lastName     ?? "",
    email:           user?.email        ?? "",
    phone:           user?.phone        ?? "",
    role:            (user?.role as AppRole) ?? "sales_executive" as AppRole,
    password:        "",
    confirm:         "",
    employeeCode:    user?.employeeCode ?? "",
    basicSalary:     user?.basicSalary      != null ? String(user.basicSalary)      : "",
    hra:             user?.hra              != null ? String(user.hra)              : "",
    travelAllowance: user?.travelAllowance  != null ? String(user.travelAllowance)  : "",
    da:              user?.da               != null ? String(user.da)               : "",
    medicalAllowance:user?.medicalAllowance != null ? String(user.medicalAllowance) : "",
    otherAllowance:  user?.otherAllowance   != null ? String(user.otherAllowance)   : "",
    annualLeaveQuota:user?.annualLeaveQuota != null ? String(user.annualLeaveQuota) : "12",
    designation:     user?.designation  ?? "",
    department:      user?.department   ?? "",
    joiningDate:     user?.joiningDate ? user.joiningDate.slice(0, 10) : "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEdit) {
      if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
      if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    }
    const parseAmt = (v: string) => { const n = parseFloat(v); return !v.trim() ? 0 : isNaN(n) ? NaN : n; };
    const salary          = parseAmt(form.basicSalary);
    const hra             = parseAmt(form.hra);
    const travelAllowance = parseAmt(form.travelAllowance);
    const da              = parseAmt(form.da);
    const medicalAllowance= parseAmt(form.medicalAllowance);
    const otherAllowance  = parseAmt(form.otherAllowance);
    const annualLeaveQuota= form.annualLeaveQuota ? parseInt(form.annualLeaveQuota) : 12;

    if ([salary, hra, travelAllowance, da, medicalAllowance, otherAllowance].some(isNaN)) {
      setError("All salary/allowance fields must be valid numbers"); return;
    }

    setSaving(true);
    try {
      const allowanceBody = {
        basicSalary: salary, hra, travelAllowance, da, medicalAllowance, otherAllowance, annualLeaveQuota,
      };

      if (isEdit) {
        const body: UpdateUserBody = {
          firstName:    form.firstName,
          lastName:     form.lastName,
          email:        form.email,
          phone:        form.phone || undefined,
          role:         form.role,
          employeeCode: form.employeeCode || undefined,
          designation:  form.designation  || undefined,
          department:   form.department   || undefined,
          joiningDate:  form.joiningDate  || undefined,
          ...allowanceBody,
        };
        await usersApi.update(user!._id, body);
        toast("success", "User updated");
      } else {
        const body: CreateUserBody = {
          firstName:    form.firstName,
          lastName:     form.lastName,
          email:        form.email,
          phone:        form.phone || undefined,
          role:         form.role,
          password:     form.password,
          employeeCode: form.employeeCode || undefined,
          designation:  form.designation  || undefined,
          department:   form.department   || undefined,
          joiningDate:  form.joiningDate  || undefined,
          ...allowanceBody,
        };
        await usersApi.create(body);
        toast("success", "User created");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="space-y-2">
      {error && <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
        <Button size="sm" type="submit" form="user-form" loading={saving}>{isEdit ? "Save Changes" : "Create User"}</Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit User" : "Add User"} size="lg" footer={footer}>
      <form id="user-form" onSubmit={submit} className="space-y-5">

        {/* ── Identity ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name <span className="text-danger">*</span></Label>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
            </div>
            <div><Label>Last Name <span className="text-danger">*</span></Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
            <div className="col-span-2"><Label>Email <span className="text-danger">*</span></Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div><Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Optional" />
            </div>
            <div><Label>Role <span className="text-danger">*</span></Label>
              <Select value={form.role} onChange={(e) => set("role", e.target.value as AppRole)} required>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* ── HR Details ── */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">HR Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employee Code</Label>
              <Input value={form.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} placeholder="e.g. EMP001" />
            </div>
            <div><Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Sales Manager" />
            </div>
            <div><Label>Department</Label>
              <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Sales" />
            </div>
            <div><Label>Joining Date</Label>
              <Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} />
            </div>
            <div><Label>Annual Leave Quota (days/yr)</Label>
              <Input type="number" min="0" value={form.annualLeaveQuota} onChange={(e) => set("annualLeaveQuota", e.target.value)} placeholder="12" />
            </div>
          </div>
        </div>

        {/* ── Salary & Allowances ── */}
        <div className="border-t border-border pt-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Salary & Allowances <span className="font-normal normal-case tracking-normal text-muted/60">(₹ / month)</span></p>
          <p className="text-xs text-muted mb-3">All allowances are pro-rated for LWP deductions along with basic salary.</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label>Basic Salary <span className="text-danger">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">₹</span>
                <Input type="number" min="0" step="1" value={form.basicSalary} onChange={(e) => set("basicSalary", e.target.value)} placeholder="0" className="!pl-7" />
              </div>
            </div>
            {([
              ["hra",              "HRA (House Rent)"],
              ["travelAllowance",  "Travel Allowance"],
              ["da",               "DA (Dearness)"],
              ["medicalAllowance", "Medical Allowance"],
              ["otherAllowance",   "Other Allowance"],
            ] as [keyof typeof form, string][]).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">₹</span>
                  <Input type="number" min="0" step="1" value={form[key] as string} onChange={(e) => set(key, e.target.value)} placeholder="0" className="!pl-7" />
                </div>
              </div>
            ))}
            {/* Total CTC preview */}
            {(() => {
              const vals = [form.basicSalary, form.hra, form.travelAllowance, form.da, form.medicalAllowance, form.otherAllowance]
                .map((v) => parseFloat(v as string) || 0);
              const total = vals.reduce((s, v) => s + v, 0);
              return total > 0 ? (
                <div className="col-span-2 rounded-xl bg-primary/8 border border-primary/20 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">Total Monthly CTC</span>
                  <span className="text-base font-bold text-primary">
                    ₹{total.toLocaleString("en-IN")}
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {/* ── Password (create only) ── */}
        {!isEdit && (
          <div className="border-t border-border pt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Password</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Password <span className="text-danger">*</span></Label>
                <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Min 8 chars" required />
              </div>
              <div><Label>Confirm <span className="text-danger">*</span></Label>
                <Input type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Repeat" required />
              </div>
            </div>
          </div>
        )}

      </form>
    </Modal>
  );
}

// ── Set password modal ─────────────────────────────────────────────

function SetPasswordModal({
  user, onClose, onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setSaving(true);
    try {
      await usersApi.setPassword(user._id, password);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Set Password — ${user.firstName} ${user.lastName}`} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>New Password <span className="text-danger">*</span></Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" autoFocus required />
        </div>
        <div><Label>Confirm Password <span className="text-danger">*</span></Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required />
        </div>
        {error && <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" loading={saving}>Update Password</Button>
        </div>
      </form>
    </Modal>
  );
}
