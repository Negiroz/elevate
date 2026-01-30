import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger'
}) => {
    if (!isOpen) return null;

    const getColor = () => {
        switch (type) {
            case 'danger': return 'bg-red-500 hover:bg-red-600';
            case 'warning': return 'bg-yellow-500 hover:bg-yellow-600';
            case 'info': return 'bg-blue-500 hover:bg-blue-600';
            default: return 'bg-primary';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'danger': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
            default: return 'help';
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-surface-dark w-full max-w-md rounded-2xl border border-border-dark shadow-2xl transform transition-all scale-100 opacity-100"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full ${type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'} mx-auto flex items-center justify-center mb-4`}>
                        <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-text-secondary text-sm mb-6">{message}</p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-border-dark text-white font-semibold hover:bg-white/5 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-105 ${getColor()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
