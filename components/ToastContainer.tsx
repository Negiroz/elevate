import React from 'react';
import Toast, { ToastProps } from './Toast';

interface ToastContainerProps {
    toasts: Omit<ToastProps, 'onClose'>[];
    onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end pointer-events-none">
            {/* Pointer events none on container, auto on toasts so clicks pass through empty space */}
            <div className="pointer-events-auto">
                {toasts.map(toast => (
                    <Toast
                        key={toast.id}
                        {...toast}
                        onClose={onClose}
                    />
                ))}
            </div>
        </div>
    );
};

export default ToastContainer;
