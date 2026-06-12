'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Link as LinkIcon, Loader, Plus, Save, Search, Trash2, Upload, X, BookOpen, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { API_BASE, topicInterviewsApi } from '../lib/api';

interface TopicInterview {
  _id: string;
  name: string;
  isPublished: boolean;
  logoUrl?: string;
  links: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface TopicForm {
  name: string;
  isPublished: boolean;
  linksText: string;
  logoFile: File | null;
}

const EMPTY_FORM: TopicForm = {
  name: '',
  isPublished: true,
  linksText: '',
  logoFile: null,
};

export default function TopicInterviewsPage() {
  const [topics, setTopics] = useState<TopicInterview[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicInterview | null>(null);
  const [form, setForm] = useState<TopicForm>(EMPTY_FORM);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const data = await topicInterviewsApi.getAll();
      setTopics(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error((error as Error)?.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingTopic(null);
    setShowForm(false);
  };

  const linksFromText = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const startCreate = () => {
    setEditingTopic(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (topic: TopicInterview) => {
    setEditingTopic(topic);
    setForm({
      name: topic.name,
      isPublished: topic.isPublished,
      linksText: (topic.links || []).join('\n'),
      logoFile: null,
    });
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      toast.error('Topic name is required');
      return;
    }

    const links = linksFromText(form.linksText);
    setSaving(true);

    try {
      let topicId = editingTopic?._id;

      if (editingTopic) {
        await topicInterviewsApi.update(editingTopic._id, { name, links, isPublished: form.isPublished });
      } else {
        const created = await topicInterviewsApi.create({ name, links, isPublished: form.isPublished });
        topicId = created?._id;
      }

      if (form.logoFile && topicId) {
        await topicInterviewsApi.uploadLogo(topicId, form.logoFile);
      }

      toast.success(editingTopic ? 'Topic updated' : 'Topic created');
      await fetchTopics();
      resetForm();
    } catch (error) {
      toast.error((error as Error)?.message || 'Failed to save topic');
    } finally {
      setSaving(false);
    }
  };

  const deleteTopic = async (topic: TopicInterview) => {
    if (!confirm(`Delete topic "${topic.name}"?`)) return;

    try {
      await topicInterviewsApi.delete(topic._id);
      setTopics((prev) => prev.filter((item) => item._id !== topic._id));
      toast.success('Topic deleted');
    } catch (error) {
      toast.error((error as Error)?.message || 'Failed to delete topic');
    }
  };

  const filteredTopics = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return topics;
    return topics.filter((topic) => {
      const inName = topic.name.toLowerCase().includes(value);
      const inLinks = (topic.links || []).some((link) => link.toLowerCase().includes(value));
      return inName || inLinks;
    });
  }, [topics, query]);

  return (
    <div style={{ padding: '24px 40px' }} className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={30} color="#6c63ff" />
            Topic Interviews
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 6 }}>
            Manage topic name, logo, and reference links.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        <div className="glass-card" style={{ padding: 20, height: 'calc(100vh - 170px)', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: 14, fontWeight: 800, fontSize: 15 }}>
            {showForm ? (editingTopic ? 'Edit Topic' : 'Create Topic') : 'Topic Form'}
          </h3>

          {!showForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Click below to create a new topic.</p>
              <button type="button" className="btn-primary" onClick={startCreate}>
                <Plus size={15} />
                New Topic
              </button>
            </div>
          ) : (
            <form onSubmit={submitForm} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Topic name (required)"
                required
              />

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
                />
                Published
              </label>

              <textarea
                className="form-input"
                rows={6}
                value={form.linksText}
                onChange={(e) => setForm((prev) => ({ ...prev, linksText: e.target.value }))}
                placeholder={'Links (one per line)\nhttps://example.com/doc-1\nhttps://example.com/doc-2'}
              />

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px dashed rgba(255,255,255,0.15)',
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                <Upload size={15} />
                {form.logoFile ? form.logoFile.name : 'Upload logo image (optional)'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setForm((prev) => ({ ...prev, logoFile: file }));
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 1 }}>
                  {saving ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingTopic ? 'Update' : 'Create'}
                </button>

                <button type="button" className="btn-secondary" onClick={resetForm}>
                  <X size={15} />
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="glass-card" style={{ padding: 20, height: 'calc(100vh - 170px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input
                className="form-input"
                placeholder="Search topics or links..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>

            <button className="btn-secondary" onClick={fetchTopics} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ opacity: 0.7, fontSize: 13 }}>Loading topics...</div>
          ) : filteredTopics.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: 13 }}>No topics found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTopics.map((topic) => (
                <div
                  key={topic._id}
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
                      {topic.logoUrl ? (
                        <img
                          src={topic.logoUrl.startsWith('http') ? topic.logoUrl : `${API_BASE}${topic.logoUrl}`}
                          alt={topic.name}
                          style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 2 }}
                        />
                      ) : (
                        <BookOpen size={14} style={{ opacity: 0.6 }} />
                      )}
                      <strong style={{ fontSize: 14 }}>{topic.name}</strong>
                      <span className="badge badge-purple">{(topic.links || []).length} links</span>
                      <span className={`badge ${topic.isPublished ? 'badge-active' : 'badge-draft'}`}>
                        {topic.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>

                    {(topic.links || []).length > 0 ? (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {topic.links.slice(0, 3).map((link) => (
                          <a
                            key={link}
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#67e8f9' }}
                          >
                            <LinkIcon size={13} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>{link}</span>
                          </a>
                        ))}
                        {(topic.links || []).length > 3 && (
                          <span style={{ fontSize: 11, opacity: 0.65 }}>+{topic.links.length - 3} more links</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>No links added yet.</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <button className="btn-secondary" onClick={() => startEdit(topic)} style={{ padding: 8 }} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn-danger" onClick={() => deleteTopic(topic)} style={{ padding: 8 }} title="Delete">
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
