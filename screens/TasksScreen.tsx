
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTasks } from '../TaskContext';
import { useUsers } from '../UserContext';
import { TaskStatus, TaskPriority, TaskCategory, UserRole, Task } from '../types';
import TaskDetailModal from '../components/TaskDetailModal';
import { useDistricts } from '../DistrictContext';
import { useCells } from '../CellContext';

const TasksScreen: React.FC = () => {
  const { tasks, addTask, updateTaskStatus, deleteTask, getOverdueReportsCount, resolveTask } = useTasks();
  const { users, user } = useUsers();
  const { districts } = useDistricts();
  const { cells } = useCells();

  const currentUserId = user?.id || '';
  const currentUser = users.find(u => u.id === currentUserId) || (user || { id: '', role: UserRole.VISITOR, firstName: '', lastName: '', email: '', active: false, joinDate: '' });

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [showForm, setShowForm] = useState(false);
  const [criticalFilter, setCriticalFilter] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  // Form state
  // We initialize with empty string for ID, will update when user loads or when form opens
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    category: 'personal' as TaskCategory,
    dueDate: new Date().toISOString().split('T')[0],
    assignedToId: currentUserId
  });

  // Update assignedToId when user loads
  useEffect(() => {
    if (currentUserId && !newTask.assignedToId) {
      setNewTask(prev => ({ ...prev, assignedToId: currentUserId }));
    }
  }, [currentUserId]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    addTask({
      ...newTask,
      status: 'pending',
      createdByUserId: currentUserId
    });

    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      category: 'personal',
      dueDate: new Date().toISOString().split('T')[0],
      assignedToId: currentUserId
    });
    setShowForm(false);
  };

  // Jerarquía de asignación
  const getAssignables = () => {
    if ([UserRole.PASTOR, UserRole.ADMIN, UserRole.ASSOCIATE_PASTOR].includes(currentUser.role as UserRole)) {
      return users; // Pueden asignar a todos
    }
    return users.filter(u => u.id === currentUserId || u.role === UserRole.MEMBER || u.role === UserRole.VISITOR);
  };

  const filteredTasks = tasks.filter(t => {
    const isRelated = t.assignedToId === currentUserId || t.createdByUserId === currentUserId;
    if (!isRelated) return false;

    // Fix: Hide automation tasks created by me but assigned to others to avoid clutter/duplicates perception
    if (t.category === 'automation' && t.createdByUserId === currentUserId && t.assignedToId !== currentUserId) {
      return false;
    }

    if (criticalFilter) return t.category === 'cell-report' && t.status !== 'completed' && t.assignedToId === currentUserId;
    if (filter === 'all') return true;
    if (filter === 'pending') return t.status !== 'completed';
    return t.status === 'completed';
  });

  const overdueCount = getOverdueReportsCount(currentUserId);

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

  const getTaskVisuals = (task: Task) => {
    const title = task.title.toLowerCase();

    if (task.category === 'automation' || task.category === 'personal' || task.category === 'pastoral') {
      if (title.includes('cumpleaños')) return { icon: 'cake', color: 'text-pink-400 bg-pink-400/10', label: 'Cumpleaños' };
      if (title.includes('visita')) return { icon: 'hail', color: 'text-blue-400 bg-blue-400/10', label: 'Visita' };
      if (title.includes('atención pastoral')) return { icon: 'church', color: 'text-purple-400 bg-purple-400/10', label: 'Pastoral' };
    }

    switch (task.category) {
      case 'cell-report': return { icon: 'analytics', color: 'text-amber-400 bg-amber-400/10', label: 'Reporte' };
      case 'visit': return { icon: 'hail', color: 'text-blue-400 bg-blue-400/10', label: 'Visita' };
      case 'study': return { icon: 'menu_book', color: 'text-cyan-400 bg-cyan-400/10', label: 'Estudio' };
      case 'pastoral': return { icon: 'church', color: 'text-purple-400 bg-purple-400/10', label: 'Pastoral' };
      case 'automation': return { icon: 'smart_toy', color: 'text-indigo-400 bg-indigo-400/10', label: 'Auto' };
      default: return { icon: 'person', color: 'text-slate-400 bg-slate-400/10', label: 'Tarea' };
    }
  };

  const formatDate = (dateStr?: string, isDateTime: boolean = false) => {
    if (!dateStr) return '';

    if (!isDateTime) {
      // Force local date interpretation for Due Dates. 
      // We take the first 10 chars (YYYY-MM-DD) and construct a local date.
      // We set time to 12:00 PM to be safe against DST shifts.
      const cleanDate = dateStr.substring(0, 10);
      if (cleanDate.includes('-')) {
        const [year, month, day] = cleanDate.split('-').map(Number);
        const date = new Date(year, month - 1, day, 12, 0, 0);
        return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }

    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!user) {
    return <div className="p-10 text-center text-white">Cargando tareas o sesión expirada...</div>;
  }

  return (
    <Layout title="Mis Tareas">
      <div className="max-w-5xl mx-auto w-full pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">Gestión de Actividades</h1>
            <p className="text-text-secondary text-sm">Jerarquía: {currentUser.role}. Control de asignaciones.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setFilter('pending'); setCriticalFilter(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'pending' && !criticalFilter ? 'bg-primary text-white' : 'bg-surface-dark text-text-secondary'}`}
            >
              Pendientes
            </button>
            <button
              onClick={() => { setFilter('completed'); setCriticalFilter(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'completed' ? 'bg-primary text-white' : 'bg-surface-dark text-text-secondary'}`}
            >
              Completadas
            </button>
          </div>
        </div>

        {overdueCount > 0 && (
          <div className="bg-[#192433] border-l-4 border-red-500 rounded-r-2xl p-6 mb-10 flex flex-col md:flex-row justify-between gap-6 items-center shadow-xl">
            <div className="flex items-center gap-5">
              <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <span className="material-symbols-outlined text-3xl">error</span>
              </div>
              <div>
                <h3 className="text-white text-lg font-black">Atención Pendiente</h3>
                <p className="text-text-secondary text-sm">Tienes {overdueCount} reporte(s) urgente(s) asignados.</p>
              </div>
            </div>
            <button onClick={() => setCriticalFilter(!criticalFilter)} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black">
              {criticalFilter ? 'Ver Todo' : 'Resolver Ahora'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {showForm ? (
            <form onSubmit={handleAddTask} className="bg-surface-dark p-6 rounded-2xl border-2 border-primary/40 shadow-2xl flex flex-col gap-4">
              <input
                autoFocus
                placeholder="Título de la tarea..."
                className="bg-[#111822] border-border-dark rounded-xl text-white text-sm p-3"
                value={newTask.title}
                onChange={e => setNewTask({ ...newTask, title: e.target.value })}
              />
              <textarea
                placeholder="Descripción..."
                className="bg-[#111822] border-border-dark rounded-xl text-white text-xs p-3 h-20"
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-[10px] text-text-secondary uppercase font-bold ml-1">Asignar a:</label>
                <select
                  className="w-full bg-[#111822] border-border-dark rounded-xl text-white text-[11px] p-2"
                  value={newTask.assignedToId}
                  onChange={e => setNewTask({ ...newTask, assignedToId: e.target.value })}
                >
                  {getAssignables().map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="bg-[#111822] border-border-dark rounded-xl text-white text-[10px] p-2"
                  value={newTask.priority}
                  onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
                <input
                  type="date"
                  className="bg-[#111822] border-border-dark rounded-xl text-white text-[10px] p-2"
                  value={newTask.dueDate}
                  onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-xl text-xs font-bold">Crear Tarea</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 text-text-secondary py-2 text-xs font-bold">Cerrar</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="bg-transparent border-2 border-dashed border-border-dark p-6 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-primary/50 text-text-secondary h-full min-h-[220px]">
              <span className="material-symbols-outlined text-4xl">add_task</span>
              <p className="font-bold text-sm text-center">Asignar Nueva Tarea</p>
            </button>
          )}
          {filteredTasks.map((task) => {
            const visuals = getTaskVisuals(task);
            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`bg-surface-dark p-6 rounded-2xl border border-border-dark shadow-lg group cursor-pointer hover:border-primary/40 transition-all ${task.status === 'completed' ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded flex items-center gap-1 ${visuals.color}`}>
                    <span className="material-symbols-outlined text-[12px]">{visuals.icon}</span>
                    {visuals.label}
                  </div>
                  {task.createdByUserId === currentUserId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                      className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-all p-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>

                <h4 className={`text-white font-black text-lg mb-1 ${task.status === 'completed' ? 'line-through opacity-50' : ''}`}>{task.title}</h4>
                <p className="text-text-secondary text-[11px] mb-4 line-clamp-2">{task.description}</p>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-text-secondary font-bold uppercase">Asignada a:</span>
                    <span className="text-primary font-bold">{getUserName(task.assignedToId)}</span>
                  </div>

                  {/* Automation/Birthday Extra Info */}
                  {task.relatedMemberId && (() => {
                    const relatedMember = users.find(u => u.id === task.relatedMemberId);
                    if (relatedMember) {
                      const memberDistrict = districts.find(d => d.id === relatedMember.districtId);
                      const memberCell = cells.find(c => c.id === relatedMember.cellId);
                      const memberCellLeader = users.find(u => u.id === memberCell?.leaderId);
                      const memberDistrictSupervisor = users.find(u => u.id === memberDistrict?.supervisorId);

                      const isSupervisorOrAbove = [UserRole.DISTRICT_SUPERVISOR, UserRole.PASTOR, UserRole.ASSOCIATE_PASTOR, UserRole.ADMIN].includes(currentUser.role as UserRole);
                      const isPastorOrAbove = [UserRole.PASTOR, UserRole.ASSOCIATE_PASTOR, UserRole.ADMIN].includes(currentUser.role as UserRole);
                      return (
                        <div className="mt-3 pt-3 border-t border-border-dark/30 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-text-secondary font-bold uppercase w-14">Rol:</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${relatedMember.role === UserRole.PASTOR ? 'bg-purple-500/10 text-purple-400' :
                              relatedMember.role === UserRole.LEADER ? 'bg-blue-500/10 text-blue-400' :
                                relatedMember.role === UserRole.TIMOTEO ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
                                  'bg-slate-500/10 text-slate-400'
                              }`}>{relatedMember.role}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-text-secondary font-bold uppercase w-14">Distrito:</span>
                            <span className="text-emerald-400 font-bold">{memberDistrict?.name || 'Sin Distrito'}</span>
                          </div>
                          {isPastorOrAbove && memberDistrictSupervisor && (
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-text-secondary font-bold uppercase w-14">Sup:</span>
                              <span className="text-orange-400 font-bold">{memberDistrictSupervisor.firstName} {memberDistrictSupervisor.lastName}</span>
                            </div>
                          )}
                          {isSupervisorOrAbove && (
                            <>
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-text-secondary font-bold uppercase w-14">Célula:</span>
                                <span className="text-blue-400 font-bold">{memberCell?.name || 'Sin Célula'}</span>
                              </div>
                              {memberCellLeader && (
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className="text-text-secondary font-bold uppercase w-14">Líder:</span>
                                  <span className="text-cyan-400 font-bold">{memberCellLeader.firstName} {memberCellLeader.lastName}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border-dark/30">
                  <div className="text-[10px] text-text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">event</span>
                    {formatDate(task.dueDate)}
                  </div>

                  {task.assignedToId === currentUserId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed');
                      }}
                      className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${task.status === 'completed' ? 'bg-orange-500/10 text-orange-400' : 'bg-primary text-white shadow-lg'}`}
                    >
                      {task.status === 'completed' ? 'Reabrir' : 'Completar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          canManage={selectedTask.assignedToId === currentUserId}
        />
      )}
    </Layout>
  );
};

export default TasksScreen;
