"use client";

import { useState } from "react";
import { Moon, Sun, Key, User, Phone, Mail } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";
import { useTheme } from "../../../lib/theme";
import { Button, Input, Label, Badge } from "../../../components/ui";

export default function ProfilePage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [changingPwd, setChangingPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const initials = user ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() : "??";

  function savePassword() {
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError("All fields are required."); return; }
    if (newPwd !== confirmPwd) { setPwdError("New passwords do not match."); return; }
    if (newPwd.length < 8) { setPwdError("Password must be at least 8 characters."); return; }
    setPwdError("");
    setChangingPwd(false);
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
  }

  return (
    <div className="max-w-xl space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted mt-0.5">Account settings and preferences</p>
      </div>

      {/* Avatar card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="size-16 rounded-full bg-primary text-primary-foreground grid place-items-center text-2xl font-bold">
          {initials}
        </div>
        <div>
          <p className="font-bold text-lg">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-muted">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge tone="success">Sales Portal</Badge>
            <Badge tone="info">{user?.role ?? "sales"}</Badge>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card p-5 space-y-4">
        <p className="font-semibold text-sm">Account Details</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: User,  label: "First Name", value: user?.firstName ?? "—" },
            { icon: User,  label: "Last Name",  value: user?.lastName ?? "—"  },
            { icon: Mail,  label: "Email",      value: user?.email ?? "—"     },
            { icon: Phone, label: "Phone",      value: "+91 XXXXX XXXXX"       },
          ].map((f) => (
            <div key={f.label}>
              <Label>{f.label}</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-surface-2 text-sm font-medium">
                <f.icon className="size-3.5 text-muted shrink-0" />
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Appearance</p>
            <p className="text-xs text-muted mt-0.5">Currently: {theme === "dark" ? "Dark mode" : "Light mode"}</p>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-2 h-9 px-4 rounded-md border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3 transition-colors"
          >
            {theme === "dark" ? <><Sun className="size-4" /> Light Mode</> : <><Moon className="size-4" /> Dark Mode</>}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm flex items-center gap-2"><Key className="size-4" /> Password</p>
            <p className="text-xs text-muted">Update your account password</p>
          </div>
          {!changingPwd && <Button variant="secondary" size="sm" onClick={() => setChangingPwd(true)}>Change Password</Button>}
        </div>

        {changingPwd && (
          <div className="space-y-3 animate-fadeIn">
            <div><Label>Current Password</Label><Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Current password" /></div>
            <div><Label>New Password</Label><Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New password (min. 8 chars)" /></div>
            <div><Label>Confirm New Password</Label><Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Confirm new password" /></div>
            {pwdError && <p className="text-xs text-danger">{pwdError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={savePassword}>Update Password</Button>
              <Button variant="secondary" size="sm" onClick={() => { setChangingPwd(false); setPwdError(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
