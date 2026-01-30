import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    onClose: (id: string) => void;
    duration?: number;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);
        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const getStyles = () => {
        switch (type) {
            case 'success':
                return 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400';
            case 'error':
                return 'bg-red-500/10 border-red-500/50 text-red-400';
            case 'warning':
                return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400';
            case 'info':
            default:
                return 'bg-blue-500/10 border-blue-500/50 text-blue-400';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
        }
    };

    return (
        <div className={`
      flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl min-w-[300px] animate-slide-in-right mb-3
      ${getStyles()}
    `}>
            <span className="material-symbols-outlined text-[20px]">{getIcon()}</span>
            <p className="text-sm font-bold flex-1">{message}</p>
            <button
                onClick={() => onClose(id)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
                <span className="material-symbols-outlined text-[16px]">close</span>
            </button>

            <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s ease-out forwards;
        }
      `}</style>
        </div>
    );
};

export default Toast;
