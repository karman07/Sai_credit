"use client";

import { useState, useEffect, useCallback } from "react";
import { Edit2, Mail } from "lucide-react";
import {
  Button, Badge, Modal, Input, Textarea, Label,
  SectionHeader, EmptyState, Skeleton, useToast,
} from "../../../components/ui";
import { mailTemplatesApi, type MailTemplate } from "../../../lib/api";

export default function MailTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTpl, setEditTpl] = useState<MailTemplate | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await mailTemplatesApi.list();
      setTemplates(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load mail templates");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function handleSaved(updated: MailTemplate) {
    setTemplates((p) => p.map((t) => t.key === updated.key ? updated : t));
    setEditTpl(null);
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Mail Templates"
        description="Edit the subject and content of automated emails — new case alerts, insurance expiry reminders, etc."
      />

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th><th>Subject</th><th>Status</th><th className="w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : templates.length === 0 ? (
                <tr><td colSpan={4}><EmptyState icon={Mail} title="No mail templates found" description="Templates are seeded automatically on server start." /></td></tr>
              ) : templates.map((t) => (
                <tr key={t.key}>
                  <td>
                    <p className="font-semibold text-sm">{t.name}</p>
                    {t.description && <p className="text-xs text-foreground-secondary">{t.description}</p>}
                  </td>
                  <td className="text-sm text-foreground-secondary max-w-xs truncate">{t.subject}</td>
                  <td><Badge tone={t.isActive ? "success" : "neutral"} dot>{t.isActive ? "Active" : "Disabled"}</Badge></td>
                  <td>
                    <button onClick={() => setEditTpl(t)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors">
                      <Edit2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editTpl && (
        <EditTemplateModal template={editTpl} onClose={() => setEditTpl(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

function EditTemplateModal({
  template, onClose, onSaved,
}: {
  template: MailTemplate;
  onClose: () => void;
  onSaved: (t: MailTemplate) => void;
}) {
  const toast = useToast();
  const [subject, setSubject] = useState(template.subject);
  const [html, setHtml] = useState(template.html);
  const [isActive, setIsActive] = useState(template.isActive);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!subject.trim() || !html.trim()) {
      toast("error", "Subject and body are required");
      return;
    }
    setSaving(true);
    try {
      const { data } = await mailTemplatesApi.update(template.key, { subject, html, isActive });
      toast("success", "Template updated");
      onSaved(data);
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${template.name}`} size="xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject…" />
          </div>
          <div>
            <Label>Body (HTML)</Label>
            <Textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="<p>Email body…</p>"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tpl-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded"
            />
            <label htmlFor="tpl-active" className="text-sm">Send this email automatically</label>
          </div>
          {template.variables.length > 0 && (
            <div>
              <Label>Available Variables</Label>
              <p className="text-xs text-foreground-secondary mb-1.5">Use these anywhere in the subject or body — they get replaced with real values when the email is sent.</p>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map((v) => (
                  <Badge key={v} tone="info">{`{{${v}}}`}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Live Preview</Label>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface-2">
              <p className="text-xs text-muted">Subject</p>
              <p className="text-sm font-semibold">{subject || "—"}</p>
            </div>
            <div className="p-3 bg-white text-black text-sm max-h-[360px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 justify-end border-t border-border pt-3 mt-4">
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save}>Save Changes</Button>
      </div>
    </Modal>
  );
}
