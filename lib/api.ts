const API_URL = '/api';

const getHeaders = () => {
    const session = localStorage.getItem('session');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (session) {
        const { access_token } = JSON.parse(session);
        headers['Authorization'] = `Bearer ${access_token}`;
    }
    return headers;
};

export const api = {
    get: async (endpoint: string) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: getHeaders(),
        });
        if (res.status === 401) {
            localStorage.removeItem('session');
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
            throw new Error('Session expired');
        }
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('API Response Error (Parse):', res.status, text);
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        if (!res.ok) {
            throw new Error(data.message || data.error || 'API Error');
        }
        return data;
    },

    post: async (endpoint: string, body: any) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (res.status === 401) {
            localStorage.removeItem('session');
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('API Response Error (Parse):', res.status, text);
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        if (!res.ok) {
            throw new Error(data.message || data.error || 'API Error');
        }
        return data;
    },

    patch: async (endpoint: string, body: any) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        if (res.status === 401) {
            localStorage.removeItem('session');
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('API Response Error (Parse):', res.status, text);
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        if (!res.ok) {
            throw new Error(data.message || data.error || 'API Error');
        }
        return data;
    },

    delete: async (endpoint: string) => {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (res.status === 401) {
            localStorage.removeItem('session');
            window.location.href = '/login';
            throw new Error('Session expired');
        }
        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('API Response Error (Parse):', res.status, text);
            throw new Error(`API Error: ${res.status} ${res.statusText}`);
        }

        if (!res.ok) {
            throw new Error(data.message || data.error || 'API Error');
        }
        return data;
    }
};
