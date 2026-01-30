import React, { useEffect } from 'react';
import { useConsolidation } from '../ConsolidationContext';
import { ConsolidationStep } from '../types';

interface ConsolidationStepsProps {
    profileId: string;
}

const ConsolidationSteps: React.FC<ConsolidationStepsProps> = ({ profileId }) => {
    const { steps, fetchSteps, toggleStep, scheduleAppointment, logPendingCall, updateTask } = useConsolidation();

    // Hooks MUST be at top level
    const [showScheduleModal, setShowScheduleModal] = React.useState(false);
    const [showPendingModal, setShowPendingModal] = React.useState(false);
    const [scheduleData, setScheduleData] = React.useState({ date: '', time: '', note: '' });
    const [pendingReason, setPendingReason] = React.useState('');

    // New State for Next Visit Prompt
    // New State for Next Visit Prompt
    const [showNextVisitModal, setShowNextVisitModal] = React.useState(false);
    const [pendingStepId, setPendingStepId] = React.useState<string | null>(null);
    const [nextVisitData, setNextVisitData] = React.useState({ date: '', time: '', note: '' });

    useEffect(() => {
        fetchSteps(profileId);
    }, [profileId]);

    const profileSteps = steps[profileId] || [];

    const handleToggle = (stepId: string, currentStatus: boolean, stepName: string) => {
        // If we are unchecking, just do it.
        if (currentStatus) {
            toggleStep(stepId, false);
            return;
        }

        // If checking specific steps, intercept
        const isTargetStep = stepName === 'Visita de vínculo' || stepName.startsWith('Tema');

        if (isTargetStep) {
            setPendingStepId(stepId);
            setNextVisitData({ date: '', time: '', note: '' }); // Reset
            setShowNextVisitModal(true);
        } else {
            toggleStep(stepId, true);
        }
    };

    const confirmNextVisit = async () => {
        if (!pendingStepId) return;

        // Update visit date if provided
        if (nextVisitData.date && nextVisitData.time) {
            const combinedDate = `${nextVisitData.date} ${nextVisitData.time}`;
            await updateTask(profileId, { visitDate: combinedDate, notes: nextVisitData.note });
        }

        // Complete the step
        await toggleStep(pendingStepId, true);

        // Cleanup
        setShowNextVisitModal(false);
        setPendingStepId(null);
    };

    const handleSpecialStep = (type: 'realizado' | 'pendiente') => {
        if (type === 'realizado') setShowScheduleModal(true);
        else setShowPendingModal(true);
    };

    const confirmSchedule = async () => {
        if (!scheduleData.date || !scheduleData.time) return;
        await scheduleAppointment(profileId, scheduleData.date, scheduleData.time, scheduleData.note);
        setShowScheduleModal(false);
        setScheduleData({ date: '', time: '', note: '' });
    };

    const confirmPending = async () => {
        if (!pendingReason) return;
        await logPendingCall(profileId, pendingReason);
        setShowPendingModal(false);
        setPendingReason('');
    };

    if (profileSteps.length === 0) {
        return <div className="text-gray-500 text-sm">No hay pasos de consolidación asignados.</div>;
    }

    return (
        <div className="space-y-3 mt-4">
            <h3 className="text-lg font-medium text-white mb-2">Pasos de Consolidación</h3>
            <div className="space-y-2">
                {profileSteps.map((step) => {
                    const isCallStep = step.stepName === 'Llamada y programación de cita' || step.stepName.toLowerCase().includes('llamada y programación');

                    if (isCallStep && !step.completed) {
                        return (
                            <div key={step.id} className="p-4 rounded-lg border border-indigo-500/50 bg-indigo-900/10 mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-white font-bold">{step.stepName}</span>
                                    <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase">Acción Requerida</span>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleSpecialStep('realizado')}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                        Realizado
                                    </button>
                                    <button
                                        onClick={() => handleSpecialStep('pendiente')}
                                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">phone_missed</span>
                                        Pendiente / No Contesta
                                    </button>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={step.id}
                            className={`flex items-center p-3 rounded-lg border transition-colors ${step.completed
                                ? 'bg-green-900/20 border-green-800'
                                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                }`}
                        >
                            <input
                                type="checkbox"
                                checked={step.completed}
                                onChange={() => handleToggle(step.id, step.completed, step.stepName)}
                                className="w-5 h-5 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-700 mr-3"
                            />
                            <div className="flex-1">
                                <span className={`text-sm ${step.completed ? 'text-gray-400 line-through' : 'text-gray-200'}`}>
                                    {step.stepName}
                                </span>
                                {step.completed && step.completedAt && (
                                    <div className="text-xs text-green-400 mt-0.5">
                                        Completado: {new Date(step.completedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal: Agendar Cita */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowScheduleModal(false)}>
                    <div className="bg-[#1a2332] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-500">event</span>
                            Programar Cita
                        </h4>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary"
                                    value={scheduleData.date}
                                    onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Hora</label>
                                <input
                                    type="time"
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary"
                                    value={scheduleData.time}
                                    onChange={e => setScheduleData({ ...scheduleData, time: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Nota de Cita</label>
                                <textarea
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary h-24 resize-none"
                                    placeholder="Detalles importantes para la visita..."
                                    value={scheduleData.note}
                                    onChange={e => setScheduleData({ ...scheduleData, note: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setShowScheduleModal(false)} className="flex-1 py-2 text-text-secondary hover:text-white transition-colors">Cancelar</button>
                                <button onClick={confirmSchedule} className="flex-1 bg-primary text-white py-2 rounded-lg font-bold hover:bg-blue-600 transition-colors">Confirmar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Pendiente */}
            {showPendingModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowPendingModal(false)}>
                    <div className="bg-[#1a2332] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-500">phone_missed</span>
                            Registro de Pendiente
                        </h4>

                        <div className="space-y-4">
                            <p className="text-sm text-text-secondary">Se creará un recordatorio automático para volver a llamar mañana. Por favor indica el motivo:</p>
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Motivo</label>
                                <textarea
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary h-24 resize-none"
                                    placeholder="Ej: No contestó, numero equivocado, pidió llamar luego..."
                                    value={pendingReason}
                                    onChange={e => setPendingReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setShowPendingModal(false)} className="flex-1 py-2 text-text-secondary hover:text-white transition-colors">Cancelar</button>
                                <button onClick={confirmPending} className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-bold hover:bg-orange-500 transition-colors">Registrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Próxima Visita */}
            {showNextVisitModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowNextVisitModal(false)}>
                    <div className="bg-[#1a2332] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500">next_plan</span>
                            Programar Próxima Visita
                        </h4>

                        <div className="space-y-4">
                            <p className="text-sm text-text-secondary">
                                ¡Excelente progreso! ¿Cuándo se realizará la próxima visita o sesión?
                            </p>

                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Fecha</label>
                                <input
                                    type="date"
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary"
                                    value={nextVisitData.date}
                                    onChange={e => setNextVisitData({ ...nextVisitData, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Hora</label>
                                <input
                                    type="time"
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary"
                                    value={nextVisitData.time}
                                    onChange={e => setNextVisitData({ ...nextVisitData, time: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs text-text-secondary uppercase mb-1 block">Nota (Opcional)</label>
                                <textarea
                                    className="w-full bg-[#111822] text-white border border-border-dark rounded-lg p-2 outline-none focus:border-primary h-20 resize-none text-sm"
                                    placeholder="Detalles sobre la visita..."
                                    value={nextVisitData.note}
                                    onChange={e => setNextVisitData({ ...nextVisitData, note: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => setShowNextVisitModal(false)}
                                    className="flex-1 py-2 text-text-secondary hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmNextVisit}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-500 transition-colors"
                                    disabled={!nextVisitData.date || !nextVisitData.time}
                                >
                                    Confirmar y Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsolidationSteps;
