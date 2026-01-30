
import React, { useState } from 'react';
import { Task, TaskPriority, TaskCategory } from '../types';
import { useUsers } from '../UserContext';
import { useTasks } from '../TaskContext';
import { useNotification } from '../NotificationContext';

interface TaskDetailModalProps {
    task: Task;
    onClose: () => void;
    canManage?: boolean; // If true, allows completing/rescheduling (defaults to false for global view unless logic added)
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, canManage = false }) => {
    const { users, user } = useUsers();
    const { resolveTask } = useTasks();
    const { showNotification } = useNotification();

    const [resolutionMode, setResolutionMode] = useState<'complete' | 'reschedule' | null>(null);
    const [resolutionData, setResolutionData] = useState({ feedback: '', date: new Date().toISOString().split('T')[0] });

    const getUser = (id: string) => users.find(user => user.id === id);
    const getUserName = (id: string) => {
        const u = getUser(id);
        return u ? `${u.firstName} ${u.lastName}` : 'Sistema';
    };

    const getPriorityColor = (p: TaskPriority) => {
        switch (p) {
            case 'high': return 'text-red-400 bg-red-400/10';
            case 'medium': return 'text-orange-400 bg-orange-400/10';
            case 'low': return 'text-emerald-400 bg-emerald-400/10';
        }
    };

    const getCategoryIcon = (c: TaskCategory) => {
        switch (c) {
            case 'cell-report': return 'analytics';
            case 'visit': return 'hail';
            case 'study': return 'menu_book';
            case 'pastoral': return 'church';
            case 'automation': return 'smart_toy';
            default: return 'person';
        }
    };

    const formatDate = (dateStr?: string, isDateTime: boolean = false) => {
        if (!dateStr) return '';
        if (!isDateTime) {
            const cleanDate = dateStr.substring(0, 10);
            if (cleanDate.includes('-')) {
                const [year, month, day] = cleanDate.split('-').map(Number);
                const date = new Date(year, month - 1, day, 12, 0, 0);
                return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            }
        }
        return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Determine if current user can manage this task (if not explicitly passed, check ownership)
    const isAssignee = task.assignedToId === user?.id;
    const showActions = canManage || isAssignee;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-surface-dark w-full max-w-xl rounded-3xl border border-border-dark shadow-2xl overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className={`h-2 w-full ${getPriorityColor(task.priority).replace('text-', 'bg-').split(' ')[0]}`}></div>
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-2 ${getPriorityColor(task.priority)}`}>
                            <span className="material-symbols-outlined text-white text-[18px]">{getCategoryIcon(task.category)}</span>
                            {task.category === 'automation' ? '🤖 Tarea Automatizada' : `Prioridad ${task.priority}`}
                        </div>
                        <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-3xl">close</span>
                        </button>
                    </div>

                    <h2 className="text-3xl font-black text-white mb-4 leading-tight">{task.title}</h2>
                    <p className="text-text-secondary text-base leading-relaxed mb-8 bg-[#111822] p-4 rounded-2xl border border-border-dark/40">
                        {task.description || 'Sin descripción adicional.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Asignado a</span>
                            <div className="flex items-center gap-3">
                                <img src={`https://picsum.photos/seed/${task.assignedToId}/100/100`} className="w-8 h-8 rounded-full border border-border-dark" alt="avatar" />
                                <div>
                                    <p className="text-white font-bold text-sm leading-none">{getUserName(task.assignedToId)}</p>
                                    <p className="text-[10px] text-primary font-bold">{getUser(task.assignedToId)?.role || 'Usuario'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Asignado por</span>
                            <div className="flex items-center gap-3">
                                {task.category === 'automation' ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full border border-border-dark bg-primary flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-[18px]">smart_toy</span>
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm leading-none">Elevate</p>
                                            <p className="text-[10px] text-text-secondary font-bold">Sistema</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <img src={`https://picsum.photos/seed/${task.createdByUserId}/100/100`} className="w-8 h-8 rounded-full border border-border-dark" alt="avatar" />
                                        <div>
                                            <p className="text-white font-bold text-sm leading-none">{getUserName(task.createdByUserId)}</p>
                                            <p className="text-[10px] text-text-secondary font-bold">{getUser(task.createdByUserId)?.role || 'Sistema'}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-6 border-t border-border-dark/30">
                        <div className="bg-[#111822] px-4 py-2 rounded-xl flex items-center gap-2 border border-border-dark/50">
                            <span className="material-symbols-outlined text-orange-400 text-[18px]">calendar_today</span>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-bold">Vencimiento</span>
                                <span className="text-white text-xs font-bold">{formatDate(task.dueDate)}</span>
                            </div>
                        </div>
                        <div className="bg-[#111822] px-4 py-2 rounded-xl flex items-center gap-2 border border-border-dark/50">
                            <span className="material-symbols-outlined text-emerald-400 text-[18px]">history</span>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-bold">Creada el</span>
                                <span className="text-white text-xs font-bold">{formatDate(task.createdAt, true)}</span>
                            </div>
                        </div>
                        <div className="bg-[#111822] px-4 py-2 rounded-xl flex items-center gap-2 border border-border-dark/50">
                            <span className="material-symbols-outlined text-primary text-[18px]">info</span>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-text-secondary uppercase font-bold">Estado</span>
                                <span className={`text-xs font-bold ${task.status === 'completed' ? 'text-green-400' : 'text-orange-400'}`}>
                                    {task.status === 'completed' ? 'Completada' : 'Pendiente'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {showActions && (
                        <div className="flex flex-col gap-3 mt-8">
                            {task.status === 'pending' ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setResolutionMode('reschedule')}
                                        className="py-3 rounded-xl font-bold text-sm bg-surface-dark border border-border-dark text-white hover:bg-[#233348] transition-all"
                                    >
                                        Reprogramar
                                    </button>
                                    <button
                                        onClick={() => setResolutionMode('complete')}
                                        className="py-3 rounded-xl font-bold text-sm bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all"
                                    >
                                        Completar
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => resolveTask(task.id, 'pending')}
                                    className="w-full py-4 rounded-xl font-black text-sm bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
                                >
                                    Reabrir Tarea
                                </button>
                            )}

                            {resolutionMode && task.status === 'pending' && (
                                <div className="bg-[#111822] p-4 rounded-xl border border-border-dark animate-in slide-in-from-top-2">
                                    <h3 className="text-white font-bold mb-3">
                                        {resolutionMode === 'complete' ? 'Finalizar Tarea' : 'Reprogramar Tarea'}
                                    </h3>

                                    {resolutionMode === 'reschedule' && (
                                        <div className="mb-3">
                                            <label className="text-[10px] uppercase font-bold text-text-secondary">Nueva Fecha</label>
                                            <input
                                                type="date"
                                                value={resolutionData.date}
                                                onChange={e => setResolutionData({ ...resolutionData, date: e.target.value })}
                                                className="w-full bg-surface-dark border border-border-dark rounded-lg p-2 text-white text-sm mt-1"
                                            />
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <label className="text-[10px] uppercase font-bold text-text-secondary">
                                            {resolutionMode === 'complete' ? 'Resultado / Comentarios (Requerido)' : 'Motivo del cambio'}
                                        </label>
                                        <textarea
                                            value={resolutionData.feedback}
                                            onChange={e => setResolutionData({ ...resolutionData, feedback: e.target.value })}
                                            placeholder={resolutionMode === 'complete' ? "¿Qué se hizo? ¿Cuál fue el resultado?" : "Escribe la razón..."}
                                            className="w-full bg-surface-dark border border-border-dark rounded-lg p-2 text-white text-sm mt-1 h-20"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!resolutionData.feedback.trim()) {
                                                    showNotification("Por favor escribe un comentario o resultado.", 'warning');
                                                    return;
                                                }

                                                if (resolutionMode === 'complete') {
                                                    await resolveTask(task.id, 'completed', resolutionData.feedback);
                                                    onClose();
                                                } else {
                                                    await resolveTask(task.id, 'pending', resolutionData.feedback, resolutionData.date);
                                                }

                                                setResolutionMode(null);
                                                setResolutionData({ feedback: '', date: new Date().toISOString().split('T')[0] });
                                            }}
                                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-green-500 transition-colors"
                                        >
                                            Confirmar
                                        </button>
                                        <button
                                            onClick={() => setResolutionMode(null)}
                                            className="flex-1 bg-transparent text-text-secondary py-2 rounded-lg font-bold text-xs hover:text-white transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {task.feedback && (
                        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined text-blue-400 text-[18px]">forum</span>
                                <span className="text-blue-400 font-bold text-xs uppercase">Feedback / Resultado</span>
                            </div>
                            <p className="text-white text-sm whitespace-pre-wrap font-mono">{task.feedback}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDetailModal;
