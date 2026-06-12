'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Plus, RefreshCw, Search, Trash2, Pencil, Save, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE, companyRoundsApi } from '../lib/api';

type CompanyRound = {
  _id: string;
  company: string;
  roundType: string;
  name?: string;
  description?: string;
  logoUrl?: string;
  tags?: string[];
  isPublished?: boolean;
  createdAt?: string;
};

type FormState = {
  company: string;
  roundType: string;
  name: string;
  description: string;
  logoUrl: string;
  tagsText: string;
  isPublished: boolean;
};

const DEFAULT_FORM: FormState = {
  company: '',
  roundType: 'technical',
  name: '',
  description: '',
  logoUrl: '',
  tagsText: '',
  isPublished: true,
};

const ROUND_TYPES = ['technical', 'behavioral', 'problem-solving', 'hr', 'system-design', 'coding'];

export default function CompanyRoundsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<CompanyRound[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await companyRoundsApi.getAllAdmin();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load company rounds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      return (
        item.company.toLowerCase().includes(q) ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        item.roundType.toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, query]);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setSelectedLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const onEdit = (item: CompanyRound) => {
    setEditingId(item._id);
    setForm({
      company: item.company || '',
      roundType: item.roundType || 'technical',
      name: item.name || '',
      description: item.description || '',
      logoUrl: item.logoUrl || '',
      tagsText: (item.tags || []).join(', '),
      isPublished: Boolean(item.isPublished),
    });
  };

  const onLogoFileChange = (file?: File) => {
    setSelectedLogoFile(file || null);
  };

  const parseTags = (tagsText: string) => {
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  };

  const onSave = async () => {
    if (!form.company.trim()) {
      toast.error('Company is required');
      return;
    }

    const payload = {
      company: form.company.trim(),
      roundType: form.roundType,
      name: form.name.trim() || undefined,
      description: form.description.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      tags: parseTags(form.tagsText),
      isPublished: form.isPublished,
    };

    setSaving(true);
    try {
      if (editingId) {
        await companyRoundsApi.update(editingId, payload);
        if (selectedLogoFile) {
          setUploadingLogo(true);
          await companyRoundsApi.uploadLogo(editingId, selectedLogoFile);
        }
        toast.success('Company round updated');
      } else {
        const created = await companyRoundsApi.create(payload);
        if (selectedLogoFile && created?._id) {
          setUploadingLogo(true);
          await companyRoundsApi.uploadLogo(created._id, selectedLogoFile);
        }
        toast.success('Company round created');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save company round');
    } finally {
      setSaving(false);
      setUploadingLogo(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this company round?')) return;
    try {
      await companyRoundsApi.delete(id);
      toast.success('Company round deleted');
      if (editingId === id) resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete company round');
    }
  };

  return (
    <div style={{ padding: '24px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={30} color="#6c63ff" />
            Specialized Company Rounds
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 6 }}>
            Basic CRUD for company-specific round types (replacement for Knowledge Base).
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        <div className="glass-card" style={{ padding: 20, height: 'calc(100vh - 170px)', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: 14, fontWeight: 800, fontSize: 15 }}>{editingId ? 'Edit Round' : 'Create Round'}</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="form-input" placeholder="Company (required)" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />

            <select className="form-input" value={form.roundType} onChange={(e) => setForm((p) => ({ ...p, roundType: e.target.value }))}>
              {ROUND_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <input className="form-input" placeholder="Display name (optional)" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <textarea className="form-input" placeholder="Description" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            <input className="form-input" placeholder="Logo URL (optional)" value={form.logoUrl} onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))} />
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="form-input"
              onChange={(e) => onLogoFileChange(e.target.files?.[0])}
              style={{ paddingTop: 10, paddingBottom: 10 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <ImageIcon size={14} />
              {selectedLogoFile ? `Selected: ${selectedLogoFile.name}` : 'Upload a logo image to attach it to the round.'}
            </div>
            <input className="form-input" placeholder="Tags (comma separated)" value={form.tagsText} onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))} />

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} />
              Published
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-primary" onClick={onSave} disabled={saving} style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                {editingId ? <Save size={16} /> : <Plus size={16} />}
                {saving || uploadingLogo ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              {editingId && (
                <button className="btn" onClick={resetForm} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <X size={15} /> Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20, height: 'calc(100vh - 170px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input className="form-input" placeholder="Search company rounds..." value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: 34 }} />
            </div>
            <button className="btn" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>Loading company rounds...</div>
          ) : filtered.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 13 }}>No company rounds found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((item) => (
                <div
                  key={item._id}
                  style={{
                    border: '1px solid var(--card-border)',
                    borderRadius: 12,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {item.logoUrl ? (
                        <img src={item.logoUrl.startsWith('http') ? item.logoUrl : `${API_BASE}${item.logoUrl}`} alt="logo" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 6 }} />
                      ) : (
                        <Building2 size={14} style={{ opacity: 0.6 }} />
                      )}
                      <strong style={{ fontSize: 14 }}>{item.company}</strong>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 800, color: '#6c63ff' }}>{item.roundType}</span>
                      <span style={{ fontSize: 10, opacity: 0.75 }}>{item.isPublished ? 'Published' : 'Draft'}</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>{item.name || `${item.company} ${item.roundType} round`}</div>
                    {item.description && <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>{item.description}</div>}
                    {!!item.tags?.length && (
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>Tags: {item.tags.join(', ')}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <button className="btn" onClick={() => onEdit(item)} style={{ padding: 8 }} title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button className="btn" onClick={() => onDelete(item._id)} style={{ padding: 8, color: '#ef4444' }} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
