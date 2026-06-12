export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Auth token management
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
    if (token) {
        localStorage.setItem('admin_token', token);
    } else {
        localStorage.removeItem('admin_token');
    }
}

export function getAccessToken(): string | null {
    if (accessToken) return accessToken;
    if (typeof window !== 'undefined') {
        accessToken = localStorage.getItem('admin_token');
    }
    return accessToken;
}

export function clearAuth() {
    accessToken = null;
    if (typeof window !== 'undefined') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
    }
}

async function fetchApi(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}/${endpoint.replace(/^\//, '')}`;
    const token = getAccessToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
        ...options,
        headers,
    });
    if (res.status === 401) {
        clearAuth();
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
        throw new Error('Unauthorized');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `API Error ${res.status}`);
    }
    return res.json();
}

async function fetchApiFormData(endpoint: string, formData: FormData, method = 'POST') {
    const url = `${API_BASE}/${endpoint.replace(/^\//, '')}`;
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
        method,
        body: formData,
        headers,
    });
    if (res.status === 401) {
        clearAuth();
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
        throw new Error('Unauthorized');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `API Error ${res.status}`);
    }
    return res.json();
}

export { fetchApi as fetchApiAuth };

// Auth
export const authApi = {
    login: (email: string, password: string) =>
        fetchApi('auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => fetchApi('auth/logout', { method: 'POST' }),
};

// Users (Admin)
export const usersApi = {
    getAll: () => fetchApi('users/admin/all'),
    getById: (id: string) => fetchApi(`users/${id}`),
};

// Analytics
export const analyticsApi = {
    getDashboardStats: () => fetchApi('analytics/admin/dashboard'),
    getSummary: () => fetchApi('analytics/summary'),
    getVisitors: () => fetchApi('analytics/visitors'),
    getSessions: (limit = 50) => fetchApi(`analytics/sessions?limit=${limit}`),
    getRecentSessions: (limit = 20) => fetchApi(`analytics/admin/recent-sessions?limit=${limit}`),
    getPageViews: (limit = 50) => fetchApi(`analytics/pageviews?limit=${limit}`),
    getPopularPages: (limit = 10) => fetchApi(`analytics/admin/popular-pages?limit=${limit}`),
};

// Subscriptions
export const subscriptionsApi = {
    getAll: (country?: string) => fetchApi(`subscriptions${country ? `?country=${country}` : ''}`),
    getById: (id: string) => fetchApi(`subscriptions/${id}`),
    create: (data: any) => fetchApi('subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    activate: (id: string) => fetchApi(`subscriptions/${id}/activate`, { method: 'PATCH' }),
    deactivate: (id: string) => fetchApi(`subscriptions/${id}/deactivate`, { method: 'PATCH' }),
    delete: (id: string) => fetchApi(`subscriptions/${id}`, { method: 'DELETE' }),
};

// Payments (Admin)
export const paymentsApi = {
    getAnalytics: () => fetchApi('payments/admin/analytics'),
    getAll: (limit = 20, offset = 0) => fetchApi(`payments/admin/all?limit=${limit}&offset=${offset}`),
};

// Subjects
export const subjectsApi = {
    getAll: () => fetchApi('subjects'),
    getById: (id: string) => fetchApi(`subjects/${id}`),
    create: (formData: FormData) => fetchApiFormData('subjects', formData),
    update: (id: string, formData: FormData) => fetchApiFormData(`subjects/${id}`, formData, 'PATCH'),
    delete: (id: string) => fetchApi(`subjects/${id}`, { method: 'DELETE' }),
};

// Lessons
export const lessonsApi = {
    getBySubject: (subjectId: string) => fetchApi(`lessons/subject/${subjectId}`),
    getById: (id: string) => fetchApi(`lessons/${id}`),
    create: (data: any) => fetchApi('lessons', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`lessons/${id}`, { method: 'DELETE' }),
};

// Quizzes
export const quizzesApi = {
    getByLesson: (lessonId: string) => fetchApi(`quizzes/lesson/${lessonId}`),
    getById: (id: string) => fetchApi(`quizzes/${id}`),
    create: (data: any) => fetchApi('quizzes', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`quizzes/${id}`, { method: 'DELETE' }),
};

// Jobs
export const jobsApi = {
    getStats: () => fetchApi('jobs/admin/stats'),
    getConfig: () => fetchApi('jobs/admin/config'),
    updateConfig: (data: any) => fetchApi('jobs/admin/config', { method: 'POST', body: JSON.stringify(data) }),
    syncNow: () => fetchApi('jobs/sync-now'),
    syncCountry: (country: string) => fetchApi(`jobs/sync-country/${country}`),
};

// AI Config / Keys (Admin)
export const aiConfigApi = {
    getKeys:         () => fetchApi('ai-config/keys'),
    addKey:          (data: any) => fetchApi('ai-config/keys', { method: 'POST', body: JSON.stringify(data) }),
    setActive:       (id: string) => fetchApi(`ai-config/keys/${id}/activate`, { method: 'PATCH' }),
    deleteKey:       (id: string) => fetchApi(`ai-config/keys/${id}`, { method: 'DELETE' }),
    getModels:       () => fetchApi('ai-config/models'),
    setActiveModel:  (provider: string, modelId: string) => fetchApi('ai-config/models/activate', { method: 'PATCH', body: JSON.stringify({ provider, modelId }) }),
};

// Company Rounds (Admin)
export const companyRoundsApi = {
    getAllAdmin: () => fetchApi('company-rounds/admin/all'),
    create:     (data: any) => fetchApi('company-rounds', { method: 'POST', body: JSON.stringify(data) }),
    update:     (id: string, data: any) => fetchApi(`company-rounds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:     (id: string) => fetchApi(`company-rounds/${id}`, { method: 'DELETE' }),
    uploadLogo: (id: string, file: File) => {
        const fd = new FormData();
        fd.append('logo', file);
        return fetchApiFormData(`company-rounds/${id}/logo`, fd, 'POST');
    },
};

// Discounts / Coupons (Admin)
export const discountsApi = {
    getAll:       () => fetchApi('discounts/admin/coupons'),
    getAnalytics: () => fetchApi('discounts/admin/analytics'),
    getStats:     (id: string) => fetchApi(`discounts/admin/coupons/${id}/stats`),
    create:       (data: any) => fetchApi('discounts/admin/coupons', { method: 'POST', body: JSON.stringify(data) }),
    update:       (id: string, data: any) => fetchApi(`discounts/admin/coupons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    toggle:       (id: string) => fetchApi(`discounts/admin/coupons/${id}/toggle`, { method: 'PATCH' }),
    delete:       (id: string) => fetchApi(`discounts/admin/coupons/${id}`, { method: 'DELETE' }),
};

// Notifications (Admin)
export const notificationsApi = {
    sendToAll:  (title: string, body: string) => fetchApi('admin/notifications/send-all',  { method: 'POST', body: JSON.stringify({ title, body }) }),
    sendToUser: (userId: string, title: string, body: string) => fetchApi(`admin/notifications/send-user/${userId}`, { method: 'POST', body: JSON.stringify({ title, body }) }),
};

// Resources (Admin)
export const resourcesApi = {
    getAll:  () => fetchApi('resources/admin/all'),
    create:  (formData: FormData) => fetchApiFormData('resources', formData),
    update:  (id: string, formData: FormData) => fetchApiFormData(`resources/${id}`, formData, 'PATCH'),
    delete:  (id: string) => fetchApi(`resources/${id}`, { method: 'DELETE' }),
};

// Interview results (Admin)
export const resultsApi = {
    getAllAdmin: (params: { page?: number; limit?: number; roundType?: string; search?: string }) => {
        const q = new URLSearchParams();
        if (params.page)      q.set('page',      String(params.page));
        if (params.limit)     q.set('limit',     String(params.limit));
        if (params.roundType) q.set('roundType', params.roundType);
        if (params.search)    q.set('search',    params.search);
        return fetchApi(`results/admin/all?${q.toString()}`);
    },
};

// Reviews (Admin)
export const reviewsApi = {
    getStats: () => fetchApi('reviews/admin/stats'),
    getAll: (params: { page?: number; limit?: number; rating?: number; flag?: string; search?: string }) => {
        const q = new URLSearchParams();
        if (params.page)   q.set('page',   String(params.page));
        if (params.limit)  q.set('limit',  String(params.limit));
        if (params.rating) q.set('rating', String(params.rating));
        if (params.flag)   q.set('flag',   params.flag);
        if (params.search) q.set('search', params.search);
        return fetchApi(`reviews/admin/all?${q.toString()}`);
    },
    flag:   (id: string, flag: string) => fetchApi(`reviews/admin/${id}/flag`,  { method: 'PATCH', body: JSON.stringify({ flag }) }),
    pin:    (id: string, isPinned: boolean) => fetchApi(`reviews/admin/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ isPinned }) }),
    delete: (id: string) => fetchApi(`reviews/admin/${id}`, { method: 'DELETE' }),
};

// Hackathon (Admin)
export const hackathonApi = {
    getConfig: () => fetchApi('hackathon/config'),
    updateConfig: (data: any) => fetchApi('hackathon/admin/config', { method: 'POST', body: JSON.stringify(data) }),
    getLeaderboard: (limit = 200) => fetchApi(`hackathon/admin/leaderboard?limit=${limit}`),
    getEmails: (page = 1, limit = 100) => fetchApi(`hackathon/admin/emails?page=${page}&limit=${limit}`),
    addEmail: (email: string) => fetchApi('hackathon/admin/add-email', { method: 'POST', body: JSON.stringify({ email }) }),
    uploadEmails: (formData: FormData) => fetchApiFormData('hackathon/admin/upload-emails', formData),
    removeEmail:    (email: string) => fetchApi(`hackathon/admin/emails/${encodeURIComponent(email)}`, { method: 'DELETE' }),
    clearEmails:    () => fetchApi('hackathon/admin/emails', { method: 'DELETE' }),
    resetInterview: (email: string) => fetchApi(`hackathon/admin/emails/${encodeURIComponent(email)}/reset`, { method: 'POST' }),
    forceSyncResult: (email: string) => fetchApi(`hackathon/admin/emails/${encodeURIComponent(email)}/force-sync`, { method: 'POST' }),
    getForms: (page = 1, limit = 50) => fetchApi(`hackathon/admin/forms?page=${page}&limit=${limit}`),
};

// Topic interviews (Admin)
export const topicInterviewsApi = {
    getAll: () => fetchApi('topic-interviews/admin/all'),
    getAllPublic: () => fetchApi('topic-interviews'),
    getById: (id: string) => fetchApi(`topic-interviews/${id}`),
    create: (data: any) => fetchApi('topic-interviews', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi(`topic-interviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi(`topic-interviews/${id}`, { method: 'DELETE' }),
    uploadLogo: (id: string, file: File) => {
        const fd = new FormData();
        fd.append('logo', file);
        return fetchApiFormData(`topic-interviews/${id}/logo`, fd, 'POST');
    },
};
