'use client';
import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, User, Info, AlertTriangle, CheckCircle, RefreshCw, Trash2, History, MessageCircle } from 'lucide-react';
import { notificationsApi, usersApi } from '../lib/api';

export default function NotificationsPage() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
    const [targetUserId, setTargetUserId] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [recentLogs, setRecentLogs] = useState<any[]>([]); // Mock logs if no backend history

    useEffect(() => {
        if (targetType === 'specific' && users.length === 0) {
            fetchUsers();
        }
    }, [targetType]);

    const fetchUsers = async () => {
        try {
            const data = await usersApi.getAll();
            setUsers(data);
        } catch (e) {
            console.error('Failed to fetch users', e);
        }
    };

    const handleSend = async () => {
        if (!title || !body) {
            setMessage({ type: 'error', text: 'Title and body are required' });
            return;
        }

        if (targetType === 'specific' && !targetUserId) {
            setMessage({ type: 'error', text: 'Please select a target user' });
            return;
        }

        setSending(true);
        setMessage(null);

        try {
            let res;
            if (targetType === 'all') {
                res = await notificationsApi.sendToAll(title, body);
            } else {
                res = await notificationsApi.sendToUser(targetUserId, title, body);
            }

            if (res.ok) {
                setMessage({ type: 'success', text: `Notification sent successfully to ${res.sent} device(s)!` });
                setTitle('');
                setBody('');
                // Add to temporary log
                setRecentLogs(prev => [{
                    id: Date.now(),
                    title,
                    body,
                    target: targetType === 'all' ? 'All Users' : users.find(u => u._id === targetUserId)?.email || 'Specific User',
                    timestamp: new Date(),
                    sent: res.sent
                }, ...prev]);
            } else {
                setMessage({ type: 'error', text: res.message || 'Failed to send notification' });
            }
        } catch (e: any) {
            setMessage({ type: 'error', text: e.message || 'An error occurred while sending' });
        } finally {
            setSending(false);
        }
    };

    const templates = [
        { title: 'New Feature Alert! 🚀', body: 'We just added some awesome new features to your dashboard. Check them out!' },
        { title: 'Resume Update 📄', body: 'Your resume evaluation is ready. Click to view the improvements.' },
        { title: 'Interview Reminder ⏰', body: "Don't forget your scheduled mock interview session today." },
        { title: 'Special Discount! 🎁', body: 'Get 20% off on your next subscription upgrade. Limited time offer!' },
    ];

    return (
        <div style={{ padding: '32px 28px', maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c63ff' }}>
                    <Bell size={24} />
                </div>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Push Notifications</h1>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>Send Firebase push notifications to your users' devices.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24 }}>
                {/* Compose Section */}
                <div className="card-container" style={{ padding: 24 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageCircle size={18} color="#6c63ff" />
                        Compose Notification
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>Target Audience</label>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    onClick={() => setTargetType('all')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${targetType === 'all' ? '#6c63ff' : 'var(--card-border)'}`,
                                        background: targetType === 'all' ? 'rgba(108, 99, 255, 0.05)' : 'transparent',
                                        color: targetType === 'all' ? '#6c63ff' : 'inherit',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                    }}
                                >
                                    <Users size={16} /> All Users
                                </button>
                                <button
                                    onClick={() => setTargetType('specific')}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${targetType === 'specific' ? '#6c63ff' : 'var(--card-border)'}`,
                                        background: targetType === 'specific' ? 'rgba(108, 99, 255, 0.05)' : 'transparent',
                                        color: targetType === 'specific' ? '#6c63ff' : 'inherit',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                                    }}
                                >
                                    <User size={16} /> Specific User
                                </button>
                            </div>
                        </div>

                        {targetType === 'specific' && (
                            <div>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>Select User</label>
                                <select
                                    className="form-input"
                                    value={targetUserId}
                                    onChange={(e) => setTargetUserId(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                                >
                                    <option value="">Choose a user...</option>
                                    {users.map(u => (
                                        <option key={u._id} value={u._id}>{u.email} ({u.name})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>Notification Title</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="E.g. Don't miss out!"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: 8 }}>Message Body</label>
                            <textarea
                                className="form-input"
                                placeholder="Type your message here..."
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                style={{ width: '100%', minHeight: 100, resize: 'vertical' }}
                            />
                        </div>

                        {message && (
                            <div style={{
                                padding: '12px 16px', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
                                background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 83, 80, 0.1)',
                                color: message.type === 'success' ? '#4ade80' : '#ef5350',
                                border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 83, 80, 0.2)'}`
                            }}>
                                {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                {message.text}
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            onClick={handleSend}
                            disabled={sending}
                            style={{ padding: '12px', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15 }}
                        >
                            {sending ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                            {sending ? 'Sending Notification...' : 'Send Broadcast Now'}
                        </button>
                    </div>
                </div>

                {/* Right Column: Templates & Recent */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Templates */}
                    <div className="card-container" style={{ padding: 24 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Info size={18} color="#00d4aa" />
                            Quick Templates
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {templates.map((t, i) => (
                                <div
                                    key={i}
                                    onClick={() => { setTitle(t.title); setBody(t.body); }}
                                    style={{
                                        padding: '12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#6c63ff')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                                >
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{t.title}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent History (Simulated) */}
                    <div className="card-container" style={{ padding: 24, flex: 1 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <History size={18} color="#ffb800" />
                            Recent Activity
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {recentLogs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
                                    No recent notifications sent.
                                </div>
                            ) : (
                                recentLogs.map(log => (
                                    <div key={log.id} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700 }}>{log.title}</span>
                                            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>To: {log.target}</div>
                                        <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>Successfully delivered to {log.sent} device(s)</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
