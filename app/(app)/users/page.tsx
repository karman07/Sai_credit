"use client";

import { useState } from "react";
import { Plus, Edit2, Power, ShieldCheck } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, Select, SearchInput,
  SectionHeader, ConfirmDialog, Pagination, EmptyState, type BadgeTone,
} from "../../../components/ui";

type Role = "owner" | "admin" | "manager" | "operations" | "auditor";

interface AdminUser {
  id: string; firstName: string; lastName: string; email: string;
  role: Role; active: boolean; lastLogin: string;
}

const ROLE_LABELS: Record<Role, string> = {
  owner:      "Owner",
  admin:      "Administrator",
  manager:    "Manager",
  operations: "Operations",
  auditor:    "Auditor",
};
const ROLE_TONES: Record<Role, BadgeTone> = {
  owner:      "purple",
  admin:      "indigo",
  manager:    "info",
  operations: "teal",
  auditor:    "neutral",
};

const MOCK: AdminUser[] = [
  { id: "u1", firstName: "Vikram",  lastName: "Patel",  email: "vikram@saicredit.in",  role: "owner",      active: true,  lastLogin: "12 Jun 2026, 9:32 AM" },
  { id: "u2", firstName: "Anita",   lastName: "Roy",    email: "anita@saicredit.in",   role: "admin",      active: true,  lastLogin: "12 Jun 2026, 8:15 AM" },
  { id: "u3", firstName: "Suresh",  lastName: "Babu",   email: "suresh@saicredit.in",  role: "manager",    active: true,  lastLogin: "11 Jun 2026, 6:00 PM" },
  { id: "u4", firstName: "Meera",   lastName: "Gupta",  email: "meera@saicredit.in",   role: "operations", active: true,  lastLogin: "11 Jun 2026, 3:20 PM" },
  { id: "u5", firstName: "Rakesh",  lastName: "Yadav",  email: "rakesh@saicredit.in",  role: "operations", active: true,  lastLogin: "10 Jun 2026, 11:00 AM" },
  { id: "u6", firstName: "Kiran",   lastName: "Kumari", email: "kiran@saicredit.in",   role: "auditor",    active: false, lastLogin: "01 Jun 2026, 2:00 PM" },
];

const PERMISSIONS: { key: string; label: string; owner: boolean; admin: boolean; manager: boolean; operations: boolean; auditor: boolean }[] = [
  { key: "cases.view",        label: "View Cases",          owner: true, admin: true,  manager: true,  operations: true,  auditor: true  },
  { key: "cases.create",      label: "Create Cases",        owner: true, admin: true,  manager: true,  operations: true,  auditor: false },
  { key: "cases.edit",        label: "Edit Cases",          owner: true, admin: true,  manager: true,  operations: true,  auditor: false },
  { key: "cases.delete",      label: "Delete Cases",        owner: true, admin: true,  manager: false, operations: false, auditor: false },
  { key: "payout.view",       label: "View Payouts",        owner: true, admin: true,  manager: true,  operations: false, auditor: true  },
  { key: "payout.edit",       label: "Edit Payouts",        owner: true, admin: true,  manager: false, operations: false, auditor: false },
  { key: "users.manage",      label: "Manage Users",        owner: true, admin: true,  manager: false, operations: false, auditor: false },
  { key: "reports.export",    label: "Export Reports",      owner: true, admin: true,  manager: true,  operations: false, auditor: true  },
  { key: "master.edit",       label: "Edit Master Data",    owner: true, admin: false, manager: false, operations: false, auditor: false },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const filtered = MOCK.filter((u) =>
    !search ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (u: AdminUser) => `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
  const AVATAR_COLORS = ["#6683FF", "#4ADE80", "#FBBF24", "#F87171", "#A78BFA", "#2DD4BF"];

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="User & Role Management"
        description="Manage admin users, assign roles, and configure permissions"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowMatrix(!showMatrix)}>
              <ShieldCheck className="size-3.5" /> {showMatrix ? "Hide" : "View"} Permissions
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add User
            </Button>
          </div>
        }
      />

      {/* Permission matrix */}
      {showMatrix && (
        <div className="card p-0 overflow-hidden animate-fadeIn">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Permission Matrix</p>
            <p className="text-xs text-muted">Access rights per role</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Permission</th>
                  {(["owner", "admin", "manager", "operations", "auditor"] as Role[]).map((r) => (
                    <th key={r} className="text-center">
                      <Badge tone={ROLE_TONES[r]}>{ROLE_LABELS[r]}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td className="text-sm font-medium">{p.label}</td>
                    {(["owner", "admin", "manager", "operations", "auditor"] as Role[]).map((r) => (
                      <td key={r} className="text-center">
                        <span className={`inline-block size-5 rounded-full text-[10px] font-bold grid place-items-center mx-auto ${
                          p[r] ? "bg-success text-white" : "bg-surface-3 text-muted"
                        }`}>
                          {p[r] ? "✓" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users…" className="w-64" />
          <span className="ml-auto text-xs text-muted">{MOCK.filter((u) => u.active).length} active users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="No users found" /></td></tr>
              ) : filtered.map((u, idx) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-7 rounded-full grid place-items-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                      >
                        {initials(u)}
                      </span>
                      <span className="font-medium text-sm">{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="text-sm text-foreground-secondary">{u.email}</td>
                  <td><Badge tone={ROLE_TONES[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
                  <td><Badge tone={u.active ? "success" : "neutral"} dot>{u.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="text-xs text-muted">{u.lastLogin}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditUser(u)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors">
                        <Edit2 className="size-3.5" />
                      </button>
                      {u.role !== "owner" && (
                        <button onClick={() => setToggleTarget(u)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors">
                          <Power className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.ceil(filtered.length / limit)} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen || !!editUser} onClose={() => { setAddOpen(false); setEditUser(null); }} title={editUser ? "Edit User" : "Add Admin User"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name</Label><Input defaultValue={editUser?.firstName} placeholder="First name" /></div>
            <div><Label>Last Name</Label><Input defaultValue={editUser?.lastName} placeholder="Last name" /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" defaultValue={editUser?.email} placeholder="email@saicredit.in" /></div>
            <div className="col-span-2">
              <Label>Role</Label>
              <Select defaultValue={editUser?.role}>
                {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </div>
            {!editUser && (
              <>
                <div><Label>Password</Label><Input type="password" placeholder="Set initial password" /></div>
                <div><Label>Confirm Password</Label><Input type="password" placeholder="Confirm password" /></div>
              </>
            )}
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => { setAddOpen(false); setEditUser(null); }}>Cancel</Button>
            <Button size="sm">{editUser ? "Save Changes" : "Create User"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => setToggleTarget(null)}
        title={`${toggleTarget?.active ? "Deactivate" : "Activate"} ${toggleTarget?.firstName}?`}
        description={toggleTarget?.active ? "This user will lose portal access immediately." : "This user will regain portal access."}
        confirmLabel={toggleTarget?.active ? "Deactivate" : "Activate"}
        variant={toggleTarget?.active ? "danger" : "primary"}
      />
    </div>
  );
}
