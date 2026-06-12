'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Trophy, Upload, Users, Settings, RefreshCw, Trash2, FileSpreadsheet,
    ToggleLeft, ToggleRight, Medal, ChevronDown, ChevronUp, ClipboardList, Plus, Mail, RotateCcw,
} from 'lucide-react';
import { hackathonApi } from '../lib/api';

type Tab = 'config' | 'emails' | 'leaderboard' | 'forms';

export default function HackathonPage() {
    const [tab, setTab] = useState<Tab>('config');
    const [config, setConfig] = useState<any>({
        isActive: false, title: '', description: '', jdText: '', difficulty: 'hard',
    });
    const [emails, setEmails] = useState<any[]>([]);
    const [emailTotal, setEmailTotal] = useState(0);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [addingEmail, setAddingEmail] = useState(false);
    const [singleEmail, setSingleEmail] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });
    const fileRef = useRef<HTMLInputElement>(null);

    const showMsg = (text: string, type: 'success' | 'error') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 4000);
    };

    const loadConfig = useCallback(async () => {
        try {
            const data = await hackathonApi.getConfig();
            if (data) setConfig(data);
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    const loadEmails = useCallback(async () => {
        try {
            const data = await hackathonApi.getEmails(1, 100);
            setEmails(data.emails || []);
            setEmailTotal(data.total || 0);
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    const loadLeaderboard = useCallback(async () => {
        try {
            const data = await hackathonApi.getLeaderboard(200);
            setLeaderboard(Array.isArray(data) ? data : []);
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    const loadForms = useCallback(async () => {
        try {
            const data = await hackathonApi.getForms(1, 50);
            setForms(data.forms || []);
        } catch (e: any) {
            console.error(e);
        }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadConfig(), loadEmails(), loadLeaderboard(), loadForms()]);
            setLoading(false);
        })();
    }, [loadConfig, loadEmails, loadLeaderboard, loadForms]);

    const handleSaveConfig = async () => {
        setSaving(true);
        try {
            await hackathonApi.updateConfig({
                isActive: config.isActive,
                title: config.title,
                description: config.description,
                jdText: config.jdText,
                difficulty: config.difficulty,
            });
            showMsg('Hackathon config saved!', 'success');
        } catch (e: any) {
            showMsg(e.message || 'Failed to save', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadEmails = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await hackathonApi.uploadEmails(fd);
            showMsg(`Uploaded ${res.added} emails successfully`, 'success');
            await loadEmails();
        } catch (ex: any) {
            showMsg(ex.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleClearEmails = async () => {
        if (!confirm('Clear all hackathon emails? This cannot be undone.')) return;
        try {
            await hackathonApi.clearEmails();
            setEmails([]);
            setEmailTotal(0);
            showMsg('All emails cleared', 'success');
        } catch (e: any) {
            showMsg(e.message || 'Failed', 'error');
        }
    };

    const handleAddSingleEmail = async () => {
        const trimmed = singleEmail.trim();
        if (!trimmed || !trimmed.includes('@')) { showMsg('Enter a valid email address', 'error'); return; }
        setAddingEmail(true);
        try {
            await hackathonApi.addEmail(trimmed);
            setSingleEmail('');
            showMsg(`${trimmed} added to hackathon`, 'success');
            await loadEmails();
        } catch (e: any) {
            showMsg(e.message || 'Failed to add email', 'error');
        } finally {
            setAddingEmail(false);
        }
    };

    const handleRemoveEmail = async (email: string) => {
        try {
            await hackathonApi.removeEmail(email);
            setEmails(prev => prev.filter(e => e.email !== email));
            setEmailTotal(prev => prev - 1);
        } catch (e: any) {
            showMsg(e.message || 'Failed to remove', 'error');
        }
    };

    const handleResetInterview = async (email: string) => {
        if (!confirm(`Reset interview status for ${email}? This will clear their interviewTaken flag and delete any saved result so they can retake.`)) return;
        try {
            await hackathonApi.resetInterview(email);
            await Promise.all([loadEmails(), loadLeaderboard()]);
            showMsg(`Reset successful for ${email}`, 'success');
        } catch (e: any) {
            showMsg(e.message || 'Failed to reset', 'error');
        }
    };

    const handleForceSyncResult = async (email: string) => {
        try {
            await hackathonApi.forceSyncResult(email);
            await loadLeaderboard();
            showMsg(`Result synced for ${email}`, 'success');
        } catch (e: any) {
            showMsg(e.message || 'No interview session found for this user', 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--muted-foreground)' }}>
                <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} /> Loading Hackathon...
            </div>
        );
    }

    const card = (content: React.ReactNode) => (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
            {content}
        </div>
    );

    const tabStyle = (t: Tab): React.CSSProperties => ({
        padding: '8px 20px',
        borderRadius: 10,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        background: tab === t ? '#6c63ff' : 'transparent',
        color: tab === t ? 'white' : 'var(--muted-foreground)',
        border: tab === t ? 'none' : '1px solid var(--card-border)',
        transition: 'all 0.2s',
    });

    const input = (value: string, onChange: (v: string) => void, placeholder?: string, type = 'text'): React.ReactNode => (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
                background: 'var(--input-bg, var(--background))', color: 'var(--foreground)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
            }}
        />
    );

    const label = (text: string) => (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {text}
        </div>
    );

    const getMedalColor = (rank: number) => {
        if (rank === 1) return '#FFD700';
        if (rank === 2) return '#C0C0C0';
        if (rank === 3) return '#CD7F32';
        return 'var(--muted-foreground)';
    };

    return (
        <div style={{ padding: '32px 28px', maxWidth: 1000, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ margin: '0 0 6px 0', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                        <Trophy size={20} />
                    </div>
                    Hackathon Mode
                </h1>
                <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 14 }}>
                    Manage hackathon participants, JD configuration, leaderboard, and form submissions.
                </p>
            </div>

            {/* Status pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div style={{
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: config.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)',
                    color: config.isActive ? '#22c55e' : '#ef4444',
                    border: `1px solid ${config.isActive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {config.isActive ? '● LIVE' : '○ INACTIVE'}
                </div>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{emailTotal} eligible emails · {leaderboard.length} results · {forms.length} form submissions</span>
            </div>

            {/* Msg banner */}
            {msg.text && (
                <div style={{
                    padding: '12px 18px', borderRadius: 12, marginBottom: 20, fontSize: 13, fontWeight: 600,
                    background: msg.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: msg.type === 'success' ? '#22c55e' : '#ef4444',
                    border: `1px solid ${msg.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {msg.text}
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {([
                    { id: 'config', label: 'Configuration', icon: <Settings size={14} /> },
                    { id: 'emails', label: `Participants (${emailTotal})`, icon: <Users size={14} /> },
                    { id: 'leaderboard', label: `Leaderboard (${leaderboard.length})`, icon: <Trophy size={14} /> },
                    { id: 'forms', label: `Submissions (${forms.length})`, icon: <ClipboardList size={14} /> },
                ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ ...tabStyle(t.id), display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {/* ── Config Tab ── */}
            {tab === 'config' && card(
                <>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: 16, fontWeight: 700 }}>Hackathon Settings</h2>

                    {/* Active toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 12, border: '1px solid var(--card-border)', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Hackathon Active</div>
                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Toggle to enable/disable hackathon mode for eligible users</div>
                        </div>
                        <button
                            onClick={() => setConfig((c: any) => ({ ...c, isActive: !c.isActive }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: config.isActive ? '#22c55e' : 'var(--muted-foreground)', padding: 0 }}
                        >
                            {config.isActive ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            {label('Hackathon Title')}
                            {input(config.title, v => setConfig((c: any) => ({ ...c, title: v })), 'e.g. HackYourCareer 2025')}
                        </div>
                        <div>
                            {label('Difficulty')}
                            <select
                                value={config.difficulty}
                                onChange={e => setConfig((c: any) => ({ ...c, difficulty: e.target.value }))}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
                                    background: 'var(--input-bg, var(--background))', color: 'var(--foreground)', fontSize: 14,
                                }}
                            >
                                <option value="hard">Hard</option>
                                <option value="expert">Expert</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                        {label('Description')}
                        <textarea
                            value={config.description}
                            onChange={e => setConfig((c: any) => ({ ...c, description: e.target.value }))}
                            placeholder="Brief description shown to participants..."
                            rows={3}
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
                                background: 'var(--input-bg, var(--background))', color: 'var(--foreground)', fontSize: 14,
                                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        {label('Job Description (JD)')}
                        <textarea
                            value={config.jdText}
                            onChange={e => setConfig((c: any) => ({ ...c, jdText: e.target.value }))}
                            placeholder="Paste the full JD here. This is what all hackathon participants will be interviewed against..."
                            rows={10}
                            style={{
                                width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
                                background: 'var(--input-bg, var(--background))', color: 'var(--foreground)', fontSize: 14,
                                resize: 'vertical', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={saving}
                        style={{
                            padding: '12px 28px', borderRadius: 12, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                            background: '#6c63ff', color: 'white', fontWeight: 700, fontSize: 14,
                            opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8,
                        }}
                    >
                        {saving ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </>
            )}

            {/* ── Emails Tab ── */}
            {tab === 'emails' && card(
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700 }}>Eligible Participants</h2>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>{emailTotal} email(s) in the hackathon list</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                style={{
                                    padding: '10px 18px', borderRadius: 10, border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                                    background: '#6c63ff', color: 'white', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                                    opacity: uploading ? 0.7 : 1,
                                }}
                            >
                                {uploading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                                {uploading ? 'Uploading...' : 'Upload Excel/CSV'}
                            </button>
                            {emails.length > 0 && (
                                <button
                                    onClick={handleClearEmails}
                                    style={{
                                        padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)',
                                        cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                        fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
                                    }}
                                >
                                    <Trash2 size={14} /> Clear All
                                </button>
                            )}
                        </div>
                    </div>

                    <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleUploadEmails} />

                    {/* Single email add */}
                    <div style={{
                        display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center',
                        padding: '14px 16px', borderRadius: 12,
                        background: 'rgba(108,99,255,0.05)', border: '1px solid rgba(108,99,255,0.15)',
                    }}>
                        <Mail size={15} style={{ color: '#6c63ff', flexShrink: 0 }} />
                        <input
                            type="email"
                            value={singleEmail}
                            onChange={e => setSingleEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSingleEmail()}
                            placeholder="Enter email and press Add or Enter…"
                            style={{
                                flex: 1, padding: '8px 12px', borderRadius: 8,
                                border: '1px solid var(--card-border)',
                                background: 'var(--input-bg, var(--background))',
                                color: 'var(--foreground)', fontSize: 13, outline: 'none',
                            }}
                        />
                        <button
                            onClick={handleAddSingleEmail}
                            disabled={addingEmail || !singleEmail.trim()}
                            style={{
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                cursor: addingEmail || !singleEmail.trim() ? 'not-allowed' : 'pointer',
                                background: '#6c63ff', color: 'white', fontWeight: 600, fontSize: 13,
                                display: 'flex', alignItems: 'center', gap: 6,
                                opacity: addingEmail || !singleEmail.trim() ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {addingEmail
                                ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                : <Plus size={13} />}
                            {addingEmail ? 'Adding…' : 'Add Email'}
                        </button>
                    </div>

                    {/* Upload hint */}
                    <div style={{
                        padding: '10px 14px', borderRadius: 10, background: 'rgba(107,114,128,0.06)', border: '1px solid var(--card-border)',
                        fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <FileSpreadsheet size={14} style={{ flexShrink: 0 }} />
                        Bulk upload: .xlsx, .xls, or .csv with emails in any column. Duplicates are ignored automatically.
                    </div>

                    {emails.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)', fontSize: 14 }}>
                            No emails uploaded yet. Upload an Excel or CSV file to get started.
                        </div>
                    ) : (
                        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>#</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Email</th>
                                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Interview</th>
                                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Form</th>
                                        <th style={{ padding: '8px 12px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {emails.map((e, i) => (
                                        <tr key={e._id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.15s' }}>
                                            <td style={{ padding: '10px 12px', color: 'var(--muted-foreground)' }}>{i + 1}</td>
                                            <td style={{ padding: '10px 12px', fontWeight: 500 }}>{e.email}</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                                    background: e.interviewTaken ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.1)',
                                                    color: e.interviewTaken ? '#22c55e' : 'var(--muted-foreground)',
                                                }}>
                                                    {e.interviewTaken ? 'Done' : 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                                    background: e.formSubmitted ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.1)',
                                                    color: e.formSubmitted ? '#22c55e' : 'var(--muted-foreground)',
                                                }}>
                                                    {e.formSubmitted ? 'Submitted' : 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleResetInterview(e.email)}
                                                        title="Reset interview (allow retake)"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: 4 }}
                                                    >
                                                        <RotateCcw size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveEmail(e.email)}
                                                        title="Remove from list"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── Leaderboard Tab ── */}
            {tab === 'leaderboard' && card(
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Leaderboard</h2>
                        <button onClick={loadLeaderboard} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--foreground)' }}>
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>

                    {leaderboard.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)', fontSize: 14 }}>
                            No results yet. Participants need to complete the interview first.
                        </div>
                    ) : (
                        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--card-border)' }}>
                                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600, width: 50 }}>Rank</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Participant</th>
                                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Score</th>
                                        <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Form</th>
                                        <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Metrics</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((r, i) => (
                                        <tr key={r._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <div style={{
                                                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: i < 3 ? `${getMedalColor(i + 1)}20` : 'transparent',
                                                    color: getMedalColor(i + 1), fontWeight: 700, fontSize: 13, margin: '0 auto',
                                                    border: i < 3 ? `2px solid ${getMedalColor(i + 1)}40` : 'none',
                                                }}>
                                                    {i < 3 ? <Medal size={14} /> : i + 1}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 34, height: 34, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                                                        background: 'rgba(108,99,255,0.12)', border: '1.5px solid rgba(108,99,255,0.2)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: '#6c63ff', fontWeight: 700, fontSize: 14,
                                                    }}>
                                                        {r.userImage
                                                            ? <img src={r.userImage} alt={r.userName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            : (r.userName || '?').charAt(0).toUpperCase()
                                                        }
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{r.userName}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.userEmail}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <div style={{
                                                    fontSize: 18, fontWeight: 800,
                                                    color: r.overallScore >= 80 ? '#22c55e' : r.overallScore >= 60 ? '#f59e0b' : '#ef4444',
                                                }}>
                                                    {r.overallScore}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>/ 100</div>
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                                                    background: r.formFilled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                                                    color: r.formFilled ? '#22c55e' : '#ef4444',
                                                }}>
                                                    {r.formFilled ? 'Done' : 'Pending'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                {r.metrics && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                        {Object.entries(r.metrics).map(([k, v]) => (
                                                            <span key={k} style={{
                                                                fontSize: 10, padding: '2px 7px', borderRadius: 5,
                                                                background: 'rgba(108,99,255,0.1)', color: '#6c63ff',
                                                            }}>
                                                                {k.replace(/([A-Z])/g, ' $1').trim()}: {String(v)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── Forms Tab ── */}
            {tab === 'forms' && card(
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Post-Interview Form Submissions</h2>
                        <button onClick={loadForms} style={{ background: 'none', border: '1px solid var(--card-border)', borderRadius: 8, cursor: 'pointer', padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--foreground)' }}>
                            <RefreshCw size={12} /> Refresh
                        </button>
                    </div>

                    {forms.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted-foreground)', fontSize: 14 }}>
                            No form submissions yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {forms.map((f) => (
                                <div key={f._id} style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 14 }}>{f.userName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{f.userEmail}</div>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                                            {new Date(f.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10, fontSize: 12 }}>
                                        <div><span style={{ color: 'var(--muted-foreground)' }}>College: </span>{f.collegeName}</div>
                                        <div><span style={{ color: 'var(--muted-foreground)' }}>Year: </span>{f.yearOfStudy}</div>
                                        <div><span style={{ color: 'var(--muted-foreground)' }}>Branch: </span>{f.branch}</div>
                                    </div>
                                    {f.experience && (
                                        <div style={{ fontSize: 12, marginBottom: 6 }}>
                                            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Experience: </span>
                                            <span>{f.experience}</span>
                                        </div>
                                    )}
                                    {f.feedback && (
                                        <div style={{ fontSize: 12 }}>
                                            <span style={{ color: 'var(--muted-foreground)', fontWeight: 600 }}>Feedback: </span>
                                            <span>{f.feedback}</span>
                                        </div>
                                    )}
                                    {f.lookingForOpportunities && (
                                        <div style={{ marginTop: 8 }}>
                                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }}>
                                                Looking for Opportunities
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
