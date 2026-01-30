import React, { useState } from 'react';

interface OfferingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { cashBs: number; cashUsd: number; transfer: number }) => void;
    isSaving: boolean;
    initialData?: { cashBs: number; cashUsd: number; transfer: number } | null;
}

const OfferingModal: React.FC<OfferingModalProps> = ({ isOpen, onClose, onSave, isSaving, initialData }) => {
    const [cashBs, setCashBs] = useState('');
    const [cashUsd, setCashUsd] = useState('');
    const [transfer, setTransfer] = useState('');

    React.useEffect(() => {
        if (isOpen && initialData) {
            setCashBs(initialData.cashBs.toString());
            setCashUsd(initialData.cashUsd.toString());
            setTransfer(initialData.transfer.toString());
        } else if (isOpen && !initialData) {
            // Reset if opening new
            setCashBs('');
            setCashUsd('');
            setTransfer('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            cashBs: parseFloat(cashBs) || 0,
            cashUsd: parseFloat(cashUsd) || 0,
            transfer: parseFloat(transfer) || 0
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-dark border border-border-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-border-dark bg-[#111822]">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">payments</span>
                        Reporte de Ofrendas
                    </h2>
                    <p className="text-text-secondary text-xs mt-1">Ingresa los montos recolectados en la reunión.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                                Efectivo (Bs)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold">Bs</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={cashBs}
                                    onChange={(e) => setCashBs(e.target.value)}
                                    className="w-full bg-[#0b0f15] border border-border-dark rounded-xl pl-10 pr-4 py-3 text-white font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                                Efectivo ($)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={cashUsd}
                                    onChange={(e) => setCashUsd(e.target.value)}
                                    className="w-full bg-[#0b0f15] border border-border-dark rounded-xl pl-10 pr-4 py-3 text-white font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
                                Transferencia
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary material-symbols-outlined text-[18px]">credit_card</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={transfer}
                                    onChange={(e) => setTransfer(e.target.value)}
                                    className="w-full bg-[#0b0f15] border border-border-dark rounded-xl pl-10 pr-4 py-3 text-white font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl font-bold text-text-secondary hover:bg-white/5 transition-all"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-3 px-4 rounded-xl font-black bg-primary text-white shadow-lg shadow-primary/25 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                        >
                            {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OfferingModal;
