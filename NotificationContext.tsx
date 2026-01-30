import React, { createContext, useContext, useState, ReactNode } from 'react';
import ToastContainer from './components/ToastContainer';
import { ToastProps, ToastType } from './components/Toast';

interface NotificationContextType {
    showNotification: (message: string, type?: ToastType, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Omit<ToastProps, 'onClose'>[]>([]);

    const showNotification = (message: string, type: ToastType = 'info', duration = 4000) => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type, duration }]);
    };

    const closeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <ToastContainer toasts={toasts} onClose={closeToast} />
        </NotificationContext.Provider>
    );
};
