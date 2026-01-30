import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './lib/api';
import { useNotification } from './NotificationContext';

export interface Event {
    id: string;
    name: string;
    description: string;
    date: string;
    image_url: string;
    active: boolean;
    attendance_count?: number;
    conversion_count?: number;
    retention_count?: number;
}

interface EventContextType {
    events: Event[];
    loading: boolean;
    addEvent: (event: Omit<Event, 'id' | 'attendance_count' | 'conversion_count'>) => Promise<void>;
    updateEvent: (id: string, updates: Partial<Event>) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
    refreshEvents: () => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const { showNotification } = useNotification();

    const refreshEvents = async () => {
        setLoading(true);
        try {
            const data = await api.get('/events');
            setEvents(data);
        } catch (error) {
            console.error('Error fetching events:', error);
            showNotification('Error al cargar eventos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const session = localStorage.getItem('session');
        if (session) {
            refreshEvents();
        } else {
            setLoading(false);
        }
    }, []);

    const addEvent = async (event: Omit<Event, 'id' | 'attendance_count' | 'conversion_count'>) => {
        try {
            await api.post('/events', event);
            showNotification('Evento creado exitosamente', 'success');
            refreshEvents();
        } catch (error) {
            console.error('Error adding event:', error);
            showNotification('Error al crear evento', 'error');
            throw error;
        }
    };

    const updateEvent = async (id: string, updates: Partial<Event>) => {
        try {
            await api.patch(`/events/${id}`, updates);
            showNotification('Evento actualizado', 'success');
            refreshEvents();
        } catch (error) {
            console.error('Error updating event:', error);
            showNotification('Error al actualizar evento', 'error');
            throw error;
        }
    };

    const deleteEvent = async (id: string) => {
        try {
            await api.delete(`/events/${id}`);
            showNotification('Evento eliminado', 'success');
            refreshEvents();
        } catch (error) {
            console.error('Error deleting event:', error);
            showNotification('Error al eliminar evento', 'error');
            throw error;
        }
    };

    return (
        <EventContext.Provider value={{ events, loading, addEvent, updateEvent, deleteEvent, refreshEvents }}>
            {children}
        </EventContext.Provider>
    );
};

export const useEvents = () => {
    const context = useContext(EventContext);
    if (!context) {
        throw new Error('useEvents must be used within an EventProvider');
    }
    return context;
};
