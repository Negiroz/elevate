import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './lib/api';
import { useNotification } from './NotificationContext';

export interface Announcement {
    id: string;
    title: string;
    message: string;
    image_url: string;
    active: boolean;
    created_at: string;
}

interface AnnouncementContextType {
    announcements: Announcement[];
    activeAnnouncements: Announcement[];
    loading: boolean;
    addAnnouncement: (data: Partial<Announcement>) => Promise<void>;
    updateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
    deleteAnnouncement: (id: string) => Promise<void>;
    refreshAnnouncements: () => Promise<void>;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export const AnnouncementProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();

    const refreshAnnouncements = async () => {
        setLoading(true);
        try {
            const data = await api.get('/announcements');
            setAnnouncements(data);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem('session');
        if (session) {
            refreshAnnouncements();
        } else {
            setLoading(false);
        }
    }, []);

    const activeAnnouncements = announcements.filter(a => a.active);

    const addAnnouncement = async (data: Partial<Announcement>) => {
        try {
            await api.post('/announcements', data);
            showNotification('Anuncio creado', 'success');
            refreshAnnouncements();
        } catch (error) {
            showNotification('Error al crear anuncio', 'error');
            throw error;
        }
    };

    const updateAnnouncement = async (id: string, data: Partial<Announcement>) => {
        try {
            await api.patch(`/announcements/${id}`, data);
            showNotification('Anuncio actualizado', 'success');
            refreshAnnouncements();
        } catch (error) {
            showNotification('Error al actualizar anuncio', 'error');
            throw error;
        }
    };

    const deleteAnnouncement = async (id: string) => {
        try {
            await api.delete(`/announcements/${id}`);
            showNotification('Anuncio eliminado', 'success');
            refreshAnnouncements();
        } catch (error) {
            showNotification('Error al eliminar anuncio', 'error');
            throw error;
        }
    };

    return (
        <AnnouncementContext.Provider value={{
            announcements,
            activeAnnouncements,
            loading,
            addAnnouncement,
            updateAnnouncement,
            deleteAnnouncement,
            refreshAnnouncements
        }}>
            {children}
        </AnnouncementContext.Provider>
    );
};

export const useAnnouncements = () => {
    const context = useContext(AnnouncementContext);
    if (!context) {
        throw new Error('useAnnouncements must be used within an AnnouncementProvider');
    }
    return context;
};
