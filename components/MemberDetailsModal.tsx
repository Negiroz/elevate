import React, { useEffect, useState } from 'react';
import ConsolidationSteps from './ConsolidationSteps';
import { User, UserRole } from '../types';
import { useDistricts } from '../DistrictContext';
import { useCells } from '../CellContext';
import { useConsolidation } from '../ConsolidationContext';
import { useTasks } from '../TaskContext';
import { useUsers } from '../UserContext';
import { api } from '../lib/api';

interface MemberDetailsModalProps {
    member: User;
    onClose: () => void;
}

interface TimelineEvent {
    id: string;
    date: string;
    type: 'join' | 'attendance' | 'consolidation' | 'other';
    title: string;
    description: string;
    icon: string;
    color: string;
}

const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({ member, onClose }) => {
    const { districts } = useDistricts();
    const { cells } = useCells();
    const { stages } = useConsolidation();
    const { tasks: globalTasks, addTask, updateTaskStatus } = useTasks();
    const { users } = useUsers();
    const { tasks: consolidationTasks } = useConsolidation(); // Get consolidation tasks

    // Find live consolidation task data to ensure reactivity
    const consolidationData = consolidationTasks.find(t => t.id === member.id);
    const liveVisitDate = consolidationData?.visitDate || member.visitDate;
    const liveNotes = consolidationData?.notes || member.notes;

    const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'tasks' | 'steps'>('steps');
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskAssignee, setNewTaskAssignee] = useState<string>('');

    // Derived State
    const memberTasks = globalTasks.filter(t => t.relatedMemberId === member.id);
    const potentialAssignees = users.filter(u => u.active && (u.role === 'Líder' || u.role === 'Admin' || u.role === 'Administrador' || u.role === 'Pastor'));

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            const sessionStr = localStorage.getItem('session');
            const sessionUser = sessionStr ? JSON.parse(sessionStr).user : null;
            const creatorId = sessionUser?.id;
            const assigneeId = newTaskAssignee || creatorId;

            await addTask({
                title: newTaskTitle,
                status: 'pending',
                priority: 'medium',
                category: 'consolidation',
                dueDate: new Date().toISOString().split('T')[0],
                assignedToId: assigneeId,
                relatedMemberId: member.id,
                createdByUserId: creatorId
            });
            setNewTaskTitle('');
        } catch (error) {
            console.error(error);
        }
    };

    const toggleTask = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        await updateTaskStatus(taskId, newStatus);
    };

    const getAssigneeName = (id: string) => {
        const u = users.find(u => u.id === id);
        return u ? `${u.firstName} ${u.lastName}` : 'Sin asignar';
    };

    // Helper to get names
    const districtName = districts.find(d => d.id === member.districtId)?.name || 'Sin Distrito';
    const cellName = cells.find(c => c.id === member.cellId)?.name || 'Sin Célula';

    useEffect(() => {
        fetchTimeline();
    }, [member.id, liveVisitDate, liveNotes]);

    const fetchTimeline = async () => {
        setLoading(true);
        const events: TimelineEvent[] = [];

        // 1. Evento de Ingreso
        events.push({
            id: 'join',
            date: member.joinDate,
            type: 'join',
            title: 'Se unió a la iglesia',
            description: `Registrado como ${member.role}`,
            icon: 'how_to_reg',
            color: 'bg-blue-500'
        });

        try {
            // 2. Asistencias
            const attendanceData = await api.get(`/attendance?member_id=${member.id}`);
            if (attendanceData && Array.isArray(attendanceData)) {
                attendanceData.forEach((att: any) => {
                    events.push({
                        id: att.id,
                        date: att.date,
                        type: 'attendance',
                        title: att.type === 'cell' ? 'Asistencia a Célula' : 'Asistencia a Servicio',
                        description: att.status === 'present' ? 'Asistió puntualmente' : 'Se registró inasistencia',
                        icon: att.status === 'present' ? 'check_circle' : 'cancel',
                        color: att.status === 'present' ? 'bg-emerald-500' : 'bg-red-500'
                    });
                });
            }

            // 3. Tareas (Completadas Generales + Consolidation Local)
            const tasksData = await api.get(`/tasks?related_member_id=${member.id}`);
            if (tasksData && Array.isArray(tasksData)) {
                tasksData.forEach((task: any) => {
                    const isLocal = task.category === 'consolidation_local';
                    const isCompleted = task.status === 'completed';

                    // Show if completed (general) OR if it is a local consolidation task (pending or completed)
                    if (isCompleted || isLocal) {
                        events.push({
                            id: task.id,
                            date: task.due_date,
                            type: isLocal ? 'consolidation_event' : 'task',
                            title: task.title,
                            description: task.description || (isLocal ? 'Evento de consolidación' : 'Tarea completada'),
                            icon: isLocal ? 'phone_callback' : 'task_alt',
                            color: isLocal ? 'bg-orange-500' : 'bg-purple-500'
                        });
                    }
                });
            }

            // 4. Pasos de Consolidación Completados
            const stepsData = await api.get(`/profiles/${member.id}/steps`);
            if (stepsData && Array.isArray(stepsData)) {
                // Filter completed steps
                const completedSteps = stepsData.filter((s: any) => s.completed === 1 || s.completed === true);
                completedSteps.forEach((step: any) => {
                    // Check if completed_at exists, else assume recent? Or ignore?
                    // If completed_at is null, we might skip or put at end.
                    if (step.completed_at) {
                        events.push({
                            id: step.id,
                            date: step.completed_at,
                            type: 'consolidation',
                            title: `Paso Completado: ${step.step_name}`,
                            description: 'Actividad de consolidación finalizada.',
                            icon: 'checklist', // Consolidation icon
                            color: 'bg-indigo-500'
                        });
                    }
                });
            }

            // 5. Cita Programada (Manual check from profile)
            if (member.visitDate) {
                events.push({
                    id: 'visit-scheduled',
                    date: member.visitDate,
                    type: 'consolidation',
                    title: 'Cita Programada',
                    description: member.notes ? `Nota: ${member.notes}` : 'Visita de consolidación agendada',
                    icon: 'event',
                    color: 'bg-pink-500'
                });
            }

        } catch (error) {
            console.error('Error fetching timeline:', error);
        }

        // Ordenar por fecha descendente
        events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTimeline(events);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#0b1016] w-full max-w-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="relative h-32 bg-gradient-to-r from-blue-900/50 to-purple-900/50">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-all z-10">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                    <div className="absolute -bottom-12 left-8 flex items-end gap-4">
                        <img
                            src={member.imageUrl || `https://picsum.photos/seed/${member.id}/150/150`}
                            className="w-24 h-24 rounded-2xl border-4 border-[#0b1016] object-cover shadow-xl bg-[#111822]"
                            alt={member.firstName}
                        />
                        <div className="pb-2 mb-1">
                            <h2 className="text-2xl font-black text-white leading-none mb-1">{member.firstName} {member.lastName}</h2>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-white/10 text-white text-[10px] font-black uppercase tracking-widest border border-white/5">
                                    {member.role}
                                </span>
                                <span className={`w-2 h-2 rounded-full ${member.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mt-16 px-8 flex gap-6 border-b border-white/5 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('steps')}
                        className={`pb-3 text-sm font-bold tracking-wide transition-all whitespace-nowrap ${activeTab === 'steps' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-white'}`}
                    >
                        Pasos de Consolidación
                    </button>
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`pb-3 text-sm font-bold tracking-wide transition-all whitespace-nowrap ${activeTab === 'timeline' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-white'}`}
                    >
                        Línea de Vida
                    </button>
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`pb-3 text-sm font-bold tracking-wide transition-all whitespace-nowrap ${activeTab === 'info' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-white'}`}
                    >
                        Información Personal
                    </button>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`pb-3 text-sm font-bold tracking-wide transition-all whitespace-nowrap ${activeTab === 'tasks' ? 'text-primary border-b-2 border-primary' : 'text-text-secondary hover:text-white'}`}
                    >
                        Tareas ({memberTasks.filter(t => t.status !== 'completed').length})
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                    {activeTab === 'steps' && (
                        <div className="h-full">
                            <h3 className="text-xl font-bold text-white mb-4">Lista de Chequeo</h3>
                            <ConsolidationSteps profileId={member.id} />
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="space-y-6">
                            {loading ? (
                                <div className="text-center py-10 text-text-secondary">Cargando historia...</div>
                            ) : timeline.length === 0 ? (
                                <div className="text-center py-10 text-text-secondary">No hay eventos registrados.</div>
                            ) : (
                                <div className="relative pl-4 border-l border-white/10 space-y-8">
                                    {timeline.map((event, index) => (
                                        <div key={index} className="relative pl-6">
                                            <div className={`absolute -left-[21px] top-1 w-10 h-10 rounded-full border-4 border-[#0b1016] ${event.color} flex items-center justify-center shadow-lg z-10`}>
                                                <span className="material-symbols-outlined text-white text-[18px]">{event.icon}</span>
                                            </div>
                                            <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="text-white font-bold">{event.title}</h4>
                                                    <span className="text-[10px] text-text-secondary font-mono bg-black/20 px-2 py-1 rounded">
                                                        {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="text-text-secondary text-xs">{event.description}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* End of line */}
                                    <div className="relative pl-6 opacity-30">
                                        <div className="absolute -left-[14px] top-1 w-6 h-6 rounded-full bg-slate-800 border-4 border-[#0b1016]"></div>
                                        <p className="text-xs text-text-secondary pt-1">Inicio de la historia</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'info' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Correo Electrónico</p>
                                    <p className="text-white font-medium">{member.email || 'No registrado'}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Distrito</p>
                                    <p className="text-white font-medium">{districtName}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Fecha de Nacimiento</p>
                                    <p className="text-white font-medium">
                                        {member.birthDate
                                            ? new Date(member.birthDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) + ` (${new Date().getFullYear() - new Date(member.birthDate).getFullYear()} años)`
                                            : 'No registrada'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Estado Civil</p>
                                        <p className="text-white font-medium">{member.maritalStatus || '-'}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                        <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Género</p>
                                        <p className="text-white font-medium">{member.gender || '-'}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Teléfono</p>
                                    <p className="text-white font-medium">{member.phone || 'No registrado'}</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Fecha de Ingreso</p>
                                    <p className="text-white font-medium">{new Date(member.joinDate).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Etapa de Consolidación</p>
                                    <p className="text-white font-medium text-primary font-bold">
                                        {stages.find(s => s.id === member.consolidationStageId)?.title || 'Sin etapa asignada'}
                                    </p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Célula</p>
                                    <p className="text-white font-medium">{cellName}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Profesión</p>
                                    <p className="text-white font-medium">{member.profession || 'No registrada'}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-text-secondary uppercase tracking-widest mb-1">Dirección</p>
                                    <p className="text-white font-medium">{member.address || 'No registrada'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="flex flex-col h-full">
                            {/* Create Task Form */}
                            <form onSubmit={handleCreateTask} className="mb-6 bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Nueva Tarea</h4>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-surface-dark border border-border-dark rounded-lg p-2 text-sm text-white focus:border-primary outline-none"
                                        placeholder="Descripción de la tarea..."
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        autoFocus
                                    />
                                    <select
                                        value={newTaskAssignee}
                                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                                        className="bg-surface-dark border border-border-dark rounded-lg p-2 text-sm text-white focus:border-primary outline-none max-w-[150px]"
                                    >
                                        <option value="">Asignar a mí</option>
                                        {potentialAssignees.map(u => (
                                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="submit"
                                        disabled={!newTaskTitle.trim()}
                                        className="bg-primary text-white p-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </form>

                            {/* Tasks List */}
                            <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                                {memberTasks.length === 0 ? (
                                    <div className="text-center py-10 text-text-secondary italic border-2 border-dashed border-white/5 rounded-xl">
                                        No hay tareas pendientes para este miembro.
                                    </div>
                                ) : (
                                    memberTasks.sort((a, b) => (a.status === b.status ? 0 : a.status === 'completed' ? 1 : -1)).map((task) => (
                                        <div key={task.id} className={`p-4 rounded-xl border transition-all flex items-start gap-4 ${task.status === 'completed' ? 'bg-white/5 border-white/5 opacity-60' : 'bg-[#1a2332] border-border-dark hover:border-primary/50'}`}>
                                            <button
                                                onClick={() => toggleTask(task.id, task.status)}
                                                className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${task.status === 'completed'
                                                    ? 'bg-green-500 border-green-500'
                                                    : 'border-text-secondary hover:border-primary bg-surface-dark'
                                                    }`}
                                            >
                                                {task.status === 'completed' && <span className="material-symbols-outlined text-[14px] text-white">check</span>}
                                            </button>

                                            <div className="flex-1">
                                                <h4 className={`text-sm font-medium ${task.status === 'completed' ? 'text-text-secondary line-through' : 'text-white'}`}>
                                                    {task.title}
                                                </h4>
                                                <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-text-secondary">
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                                        {task.dueDate || 'Sin fecha'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                                        Resp: <span className="text-white font-medium">{getAssigneeName(task.assignedToId)}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                    }
                </div >

            </div >
        </div >
    );
};

export default MemberDetailsModal;
