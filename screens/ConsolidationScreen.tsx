
import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useConsolidation } from '../ConsolidationContext';
import { useUsers } from '../UserContext';
import { useCells } from '../CellContext';
import { useDistricts } from '../DistrictContext';
import { useTasks } from '../TaskContext';
import { useNotification } from '../NotificationContext';

const COLORS = [
  'border-blue-500', 'border-purple-500', 'border-emerald-500',
  'border-orange-500', 'border-pink-500', 'border-yellow-500', 'border-red-500'
];

import { User, UserRole, CONSOLIDATION_STAGE_IDS } from '../types';
import MemberDetailsModal from '../components/MemberDetailsModal';
import ConfirmationModal from '../components/ConfirmationModal';

const ConsolidationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { tasks, stages, moveTask, deleteTask, addStage, updateStage, deleteStage, reorderStages, refreshTasks, archiveCard } = useConsolidation();
  const { users, user, deleteUser } = useUsers();
  const { cells } = useCells();
  const { districts } = useDistricts();
  // Using 'globalTasks' to avoid conflict with consolidation 'tasks'
  const { tasks: globalTasks, addTask: addGlobalTask, updateTaskStatus, refreshTasks: refreshGlobalTasks } = useTasks();
  const { showNotification } = useNotification();

  const [searchTerm, setSearchTerm] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedStageIndex, setDraggedStageIndex] = useState<number | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageTitle, setStageTitle] = useState('');
  const [showAddStage, setShowAddStage] = useState(false);

  // Task Input State (Map of memberId -> inputValue)
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});

  // Modal State
  const [selectedCandidate, setSelectedCandidate] = useState<User | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; taskId: string | null; taskName: string }>({
    isOpen: false,
    taskId: null,
    taskName: ''
  });

  const getCellAndLeader = (cellId?: string) => {
    if (!cellId) return { cellName: 'Sin Célula', leaderName: 'Sin Líder', leaderImg: null };
    const cell = cells.find(c => c.id === cellId);
    if (!cell) return { cellName: 'Desconocida', leaderName: 'Sin Líder', leaderImg: null };
    const leader = users.find(u => u.id === cell.leaderId);
    return {
      cellName: cell.name,
      leaderName: leader ? `${leader.firstName} ${leader.lastName}` : 'Sin Líder',
      leaderImg: leader?.imageUrl
    };
  };

  const getDistrictName = (id?: string) => {
    if (!id) return 'Sin Distrito';
    return districts.find(d => d.id === id)?.name || 'Desconocido';
  };

  // RBAC: Filter Tasks for Cell Leaders
  const isCellLeader = user?.role === UserRole.LEADER;

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (isCellLeader && user?.cellId) {
      if (t.cellId !== user.cellId) return false;
    }

    if (user?.role === UserRole.DISTRICT_SUPERVISOR && user?.districtId) {
      if (t.districtId !== user.districtId) return false;
    }

    return matchesSearch;
  });

  const handleCardClick = (e: React.MouseEvent, task: any) => {
    // Prevent opening modal if clicking specific interactive elements inside card
    // (Though e.stopPropagation() on buttons handles this usually)
    const names = task.name.split(' ');
    const lName = names.length > 1 ? names.pop() : '';
    const fName = names.join(' ');
    const notes = task.notes || '';
    const emailMatch = notes.match(/Email: (.*?)(?:\.|$)/);
    const profMatch = notes.match(/Profesión: (.*?)(?:\.|$)/);
    const maritalMatch = notes.match(/Estado Civil: (.*?)(?:\.|$)/);

    const tempUser: User = {
      id: task.id,
      firstName: fName,
      lastName: lName || '',
      email: emailMatch ? emailMatch[1] : '',
      role: UserRole.VISITOR,
      active: task.active,
      imageUrl: '',
      joinDate: task.visitDate || new Date().toISOString(),
      districtId: task.districtId,
      cellId: task.cellId,
      birthDate: task.birthDate,
      maritalStatus: maritalMatch ? maritalMatch[1] : undefined,
      gender: task.gender,
      profession: profMatch ? profMatch[1] : undefined,
      address: task.address,
      phone: task.phone,
      visitDate: task.visitDate,
      notes: task.notes
    };
    setSelectedCandidate(tempUser);
  };

  // Drag and Drop Handlers
  const onTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('type', 'task');
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const onStageDragStart = (e: React.DragEvent, index: number) => {
    setDraggedStageIndex(index);
    e.dataTransfer.setData('type', 'stage');
    e.dataTransfer.setData('stageIndex', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (overColumnId !== columnId) setOverColumnId(columnId);
  };

  const onDragLeave = () => setOverColumnId(null);

  const onDrop = async (e: React.DragEvent, targetStageId: string, targetIndex: number) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    try {
      if (type === 'task') {
        const taskId = e.dataTransfer.getData('taskId') || draggedTaskId;
        if (taskId) {
          const targetStage = stages.find(s => s.id === targetStageId);
          const task = tasks.find(t => t.id === taskId);
          if (!targetStage || !task) throw new Error("Datos inválidos");
          await moveTask(taskId, targetStageId);
        }
      } else if (type === 'stage') {
        const sourceIndexStr = e.dataTransfer.getData('stageIndex');
        const sourceIndex = sourceIndexStr !== "" ? parseInt(sourceIndexStr) : draggedStageIndex;
        if (sourceIndex !== null && sourceIndex !== targetIndex) {
          await reorderStages(sourceIndex, targetIndex);
        }
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setOverColumnId(null);
      setDraggedTaskId(null);
      setDraggedStageIndex(null);
    }
  };

  // Stage Manipulation
  const handleAddStageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (stageTitle.trim()) {
      addStage(stageTitle.trim(), COLORS[Math.floor(Math.random() * COLORS.length)]);
      setStageTitle('');
      setShowAddStage(false);
    }
  };

  const handleUpdateStage = (id: string) => {
    if (stageTitle.trim()) {
      updateStage(id, { title: stageTitle.trim() });
      setEditingStageId(null);
      setStageTitle('');
    }
  };

  const startEditing = (stage: any) => {
    setEditingStageId(stage.id);
    setStageTitle(stage.title);
  };

  // Deletion logic
  const requestDelete = (taskId: string, taskName: string) => {
    setDeleteModal({ isOpen: true, taskId, taskName });
  };

  const confirmDelete = async () => {
    if (deleteModal.taskId) {
      await deleteUser(deleteModal.taskId);
      setDeleteModal({ isOpen: false, taskId: null, taskName: '' });
      showNotification('Miembro eliminado correctamente', 'success');
      await refreshTasks();
    }
  };

  // --- CHECKLIST LOGIC ---
  const handleAddTask = async (memberId: string) => {
    const title = newTaskInputs[memberId]?.trim();
    if (!title) return;

    try {
      const pendingCount = globalTasks.filter(t => t.relatedMemberId === memberId && t.status !== 'completed').length;
      if (pendingCount >= 5) {
        showNotification("Límite de 5 tareas pendientes por candidato", 'warning');
        return;
      }

      await addGlobalTask({
        title,
        status: 'pending',
        priority: 'medium',
        category: 'consolidation',
        dueDate: new Date().toISOString().split('T')[0], // Today
        assignedToId: user?.id, // Default to self
        relatedMemberId: memberId,
        createdByUserId: user?.id
      });

      setNewTaskInputs(prev => ({ ...prev, [memberId]: '' }));
      showNotification("Tarea agregada", 'success');
    } catch (e) {
      showNotification("Error al crear tarea", 'error');
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateTaskStatus(taskId, newStatus);
  };

  return (
    <Layout title="Tablero de Discipulado">
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={confirmDelete}
        title="Eliminar Miembro"
        message={`¿Estás seguro de que deseas eliminar a ${deleteModal.taskName}? Esta acción eliminará permanentemente al miembro y todos sus datos asociados.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
      />

      {selectedCandidate && (
        <MemberDetailsModal member={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
      )}

      <div className="flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 shrink-0 gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Consolidación</h1>
            <p className="text-text-secondary text-sm">Gestiona el progreso y el orden de las etapas de crecimiento.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-dark border-border-dark rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-primary"
                placeholder="Buscar candidato..."
              />
            </div>
            <button
              onClick={() => navigate('/members/create?source=consolidation')}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[20px]">add</span> Nuevo Candidato
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto pb-4 custom-kanban-scroll">
          <div className="flex h-full gap-6 w-max min-w-full">
            {stages.map((stage, index) => {
              const stageTasks = filteredTasks.filter(t => t.stage === stage.id);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => onDragOver(e, stage.id)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, stage.id, index)}
                  className={`w-80 flex flex-col h-full rounded-2xl border transition-all duration-200 overflow-hidden ${overColumnId === stage.id
                    ? 'bg-primary/10 border-primary scale-[1.01]'
                    : 'bg-surface-dark/40 border-border-dark/60'
                    } backdrop-blur-sm ${draggedStageIndex === index ? 'opacity-40 grayscale' : ''}`}
                >
                  {/* Column Header */}
                  <div
                    draggable
                    onDragStart={(e) => onStageDragStart(e, index)}
                    className={`p-4 border-b-2 ${stage.color} bg-[#111822]/50 flex justify-between items-center group/header cursor-grab active:cursor-grabbing`}
                  >
                    {editingStageId === stage.id ? (
                      <input
                        autoFocus
                        value={stageTitle}
                        onChange={(e) => setStageTitle(e.target.value)}
                        onBlur={() => handleUpdateStage(stage.id)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateStage(stage.id)}
                        className="bg-surface-dark text-white text-xs font-bold uppercase rounded px-2 py-1 w-full"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-sm uppercase tracking-widest pointer-events-none">{stage.title}</h3>
                        <button onClick={(e) => { e.stopPropagation(); startEditing(stage); }} className="opacity-0 group-hover/header:opacity-100 transition-opacity">
                          <span className="material-symbols-outlined text-[14px] text-text-secondary hover:text-white">edit</span>
                        </button>
                      </div>
                    )}
                    <span className="bg-[#111822] text-text-secondary text-[10px] px-2 py-0.5 rounded-full border border-border-dark font-bold">{stageTasks.length}</span>
                  </div>

                  {/* Column Content */}
                  <div className="p-3 space-y-4 overflow-y-auto flex-1">
                    {stageTasks.map((task) => {
                      const { cellName, leaderName, leaderImg } = getCellAndLeader(task.cellId);
                      const districtName = getDistrictName(task.districtId);

                      // Filter Checklist Tasks for this member
                      const checklistTasks = globalTasks.filter(gt => gt.relatedMemberId === task.id);
                      // Find pending call (consolidation_local)
                      const pendingCallTask = checklistTasks.find(t => t.category === 'consolidation_local' && t.status !== 'completed');

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => onTaskDragStart(e, task.id)}
                          onClick={(e) => handleCardClick(e, task)}
                          className={`bg-[#111822] p-4 rounded-xl border border-border-dark shadow-lg hover:border-primary/40 transition-all group cursor-pointer active:cursor-grabbing ${!task.active ? 'opacity-60' : ''
                            } ${draggedTaskId === task.id ? 'opacity-40 grayscale-[0.5] scale-95' : ''}`}
                        >
                          {/* Card Header & Info */}
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-white font-bold text-sm">{task.name}</h4>
                              {!task.active && <span className="text-[8px] bg-red-500/10 text-red-400 px-1 rounded uppercase">Inactivo</span>}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/members/edit/${task.id}?source=consolidation`); }} className="text-text-secondary hover:text-primary p-1">
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); requestDelete(task.id, task.name); }} className="text-text-secondary hover:text-red-500 p-1">
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 mb-3">
                            <p className="text-[10px] text-text-secondary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">phone</span>
                              {task.phone || 'Sin teléfono'}
                            </p>
                            <p className="text-[10px] text-primary flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">location_on</span>
                              {districtName} / {cellName}
                            </p>
                          </div>

                          {/* Task Summary Badge */}
                          <div className="mt-4 pt-3 border-t border-dashed border-border-dark/50 flex justify-between items-center">
                            {task.totalSteps ? (
                              <div className={`flex items-center gap-1.5 w-fit px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${task.completedSteps === task.totalSteps
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                                : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                }`}>
                                <span className="material-symbols-outlined text-[12px]">
                                  {task.completedSteps === task.totalSteps ? 'verified' : 'checklist'}
                                </span>
                                <span>
                                  {task.completedSteps}/{task.totalSteps} Pasos
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-secondary">Sin pasos asignados</span>
                            )}

                            {/* Cita Badge - Dynamic Coloring */}
                            {task.visitDate && (() => {
                              const visitDate = new Date(task.visitDate);
                              const now = new Date();
                              const isToday = visitDate.toDateString() === now.toDateString();
                              const isExpired = visitDate < now;

                              let badgeStyle = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"; // Default Future
                              let icon = "event";

                              if (isExpired) {
                                badgeStyle = "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse";
                                icon = "warning"; // Emergency icon
                              } else if (isToday) {
                                badgeStyle = "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
                                icon = "schedule";
                              }

                              return (
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                                  <span className="material-symbols-outlined text-[12px]">{icon}</span>
                                  <span>
                                    {visitDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              );
                            })()}

                            {/* Pending Call Badge */}
                            {pendingCallTask && (
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 border-orange-500/20 text-orange-400">
                                <span className="material-symbols-outlined text-[12px] animate-pulse">phone_callback</span>
                                <span>
                                  Llamada: {new Date(pendingCallTask.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            )}

                            {task.totalSteps && task.completedSteps === task.totalSteps && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('¿Estás seguro de que deseas archivar esta tarjeta?')) {
                                    archiveCard(task.id);
                                  }
                                }}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg shadow-emerald-500/20 transition-all"
                              >
                                <span className="material-symbols-outlined text-[12px]">archive</span>
                                Archivar
                              </button>
                            )}
                          </div>

                          {/* Leader & Progress */}
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-border-dark/30">
                            <div className="flex items-center gap-2">
                              {leaderImg ? (
                                <img src={leaderImg} className="w-5 h-5 rounded-full border border-border-dark" alt="leader" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center border border-border-dark">
                                  <span className="material-symbols-outlined text-[12px] text-slate-500">person</span>
                                </div>
                              )}
                              <span className="text-[10px] text-text-secondary">{leaderName}</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* Add New Column Button */}
            <div className="w-80 h-full">
              {showAddStage ? (
                <form onSubmit={handleAddStageSubmit} className="bg-surface-dark/40 border-2 border-dashed border-primary/30 p-4 rounded-2xl flex flex-col gap-3">
                  <input
                    autoFocus
                    placeholder="Nombre de la etapa..."
                    value={stageTitle}
                    onChange={(e) => setStageTitle(e.target.value)}
                    className="bg-[#111822] border-border-dark rounded-lg text-white text-sm p-3 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-primary text-white py-2 rounded-lg text-xs font-bold">Añadir</button>
                    <button type="button" onClick={() => setShowAddStage(false)} className="flex-1 bg-surface-dark text-text-secondary py-2 rounded-lg text-xs font-bold border border-border-dark">Cancelar</button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddStage(true)}
                  className="w-full h-full border-2 border-dashed border-border-dark/40 rounded-2xl flex flex-col items-center justify-center gap-3 text-text-secondary hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <div className="p-3 rounded-full bg-surface-dark border border-border-dark group-hover:border-primary/40">
                    <span className="material-symbols-outlined text-3xl">add</span>
                  </div>
                  <span className="text-sm font-bold uppercase tracking-wider">Añadir Nueva Etapa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .custom-kanban-scroll::-webkit-scrollbar { height: 10px; }
        .custom-kanban-scroll::-webkit-scrollbar-track { background: #111822; border-radius: 10px; }
        .custom-kanban-scroll::-webkit-scrollbar-thumb { background: #233348; border-radius: 10px; }
        .custom-kanban-scroll::-webkit-scrollbar-thumb:hover { background: #324867; }
        [draggable="true"] { user-select: none; -webkit-user-drag: element; }
      `}</style>
    </Layout>
  );
};

export default ConsolidationScreen;
