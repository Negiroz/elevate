import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConsolidationTask, Stage, ConsolidationStep } from './types';
import { api } from './lib/api';
import { useNotification } from './NotificationContext';
import { useTasks } from './TaskContext';

interface ConsolidationContextType {
  tasks: ConsolidationTask[];
  stages: Stage[];
  loading: boolean;
  addTask: (task: Omit<ConsolidationTask, 'id' | 'lastActivity'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<ConsolidationTask>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, newStageId: string) => Promise<void>;
  addStage: (title: string, color: string) => Promise<void>;
  updateStage: (id: string, updates: Partial<Stage>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  reorderStages: (startIndex: number, endIndex: number) => Promise<void>;
  refreshTasks: () => Promise<void>;
  steps: { [profileId: string]: ConsolidationStep[] };
  fetchSteps: (profileId: string) => Promise<void>;
  toggleStep: (stepId: string, completed: boolean) => Promise<void>;
  archiveCard: (profileId: string) => Promise<void>;
  scheduleAppointment: (profileId: string, date: string, time: string, note: string) => Promise<void>;
  logPendingCall: (profileId: string, reason: string) => Promise<void>;
}

const ConsolidationContext = createContext<ConsolidationContextType | undefined>(undefined);

import { useUsers } from './UserContext';

// ... imports

export const ConsolidationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [tasks, setTasks] = useState<ConsolidationTask[]>([]);
  const [steps, setSteps] = useState<{ [profileId: string]: ConsolidationStep[] }>({});
  const [loading, setLoading] = useState(true);
  const { showNotification } = useNotification();
  const { refreshTasks: refreshGlobalTasks } = useTasks();
  const { user } = useUsers(); // Get user state

  useEffect(() => {
    const init = async () => {
      if (!user) return; // Don't fetch if not logged in

      try {
        await Promise.all([fetchStages(), fetchTasks()]);
      } catch (error) {
        console.error("Error loading consolidation data:", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]); // Re-run when user changes (login/logout)

  const fetchStages = async () => {
    try {
      const data = await api.get('/consolidation_stages');
      if (data) {
        setStages(data.map((s: any) => ({
          id: s.id,
          title: s.title,
          color: s.color
        })));
      }
    } catch (e) {
      console.error('Error fetching stages:', e);
    }
  };

  const fetchTasks = async () => {
    // REFACTOR: Fetch from 'profiles' where stage is not null
    const profiles = await api.get('/profiles?include_stats=true');
    const consolidationProfiles = profiles.filter((p: any) => p.consolidation_stage_id && (p.active === 1 || p.active === true));

    // Sort logic handled in backend sql usually, but here array:
    consolidationProfiles.sort((a: any, b: any) => {
      return new Date(b.join_date).getTime() - new Date(a.join_date).getTime();
    });

    setTasks(consolidationProfiles.map(mapDbToTask));
  };

  const mapDbToTask = (data: any): ConsolidationTask => ({
    id: data.id,
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
    stage: data.consolidation_stage_id || '',
    lastActivity: data.join_date,
    progress: 0,
    phone: data.phone,
    districtId: data.district_id,
    cellId: data.cell_id,
    active: data.active === 1 || data.active === true,
    gender: data.gender,
    birthDate: data.birth_date,
    address: data.address,
    notes: data.notes || '',
    relatedMemberId: data.id,
    completedSteps: data.completed_steps || 0,
    totalSteps: data.total_steps || 0,
    visitDate: data.visit_date
  });

  const fetchSteps = async (profileId: string) => {
    try {
      const data = await api.get(`/profiles/${profileId}/steps`);
      if (data) {
        const mappedSteps = data.map((s: any) => ({
          id: s.id,
          profileId: s.profile_id,
          stepName: s.step_name,
          completed: s.completed === 1,
          completedAt: s.completed_at,
          stepOrder: s.step_order
        }));
        setSteps(prev => ({ ...prev, [profileId]: mappedSteps }));

        // SYNC: Update the main tasks list with these new counts
        setTasks(prev => prev.map(t => {
          if (t.id === profileId) {
            return {
              ...t,
              totalSteps: mappedSteps.length,
              completedSteps: mappedSteps.filter((s: any) => s.completed).length
            };
          }
          return t;
        }));
      }
    } catch (e) {
      console.error('Error fetching steps:', e);
    }
  };

  const toggleStep = async (stepId: string, completed: boolean) => {
    try {
      const res = await api.patch(`/steps/${stepId}`, { completed });
      let updatedProfileId = '';

      // Updates steps state
      setSteps(prev => {
        const newState = { ...prev };
        for (const pid in newState) {
          const stepIndex = newState[pid].findIndex(s => s.id === stepId);
          if (stepIndex !== -1) {
            updatedProfileId = pid;
            newState[pid][stepIndex] = {
              ...newState[pid][stepIndex],
              completed,
              completedAt: res.completed_at
            };
            break;
          }
        }
        return newState;
      });

      // SYNC: Update tasks state for the board card
      if (updatedProfileId) {
        setTasks(prev => prev.map(t => {
          if (t.id === updatedProfileId) {
            // Recalculate based on current steps state (which we just updated? No, access prev steps is hard here)
            // Better to just incr/decr or read from steps check
            // We can read from 'steps' state but it might be stale in this closure?
            // Let's use functional update or re-calculate carefully.
            // Simplified: completed ? t.completedSteps + 1 : t.completedSteps - 1
            const newCompleted = (t.completedSteps || 0) + (completed ? 1 : -1);
            return { ...t, completedSteps: newCompleted };
          }
          return t;
        }));
      }

    } catch (e) {
      console.error('Error updating step:', e);
      showNotification('Error al actualizar el paso', 'error');
    }
  };

  const archiveCard = async (profileId: string) => {
    try {
      // Archive removes from board by clearing the stage, but keeps Member Active.
      await api.patch(`/profiles/${profileId}`, { consolidation_stage_id: null });
      setTasks(prev => prev.filter(t => t.id !== profileId));
      showNotification('Tarjeta archivada del tablero (Miembro sigue activo)', 'success');
    } catch (e) {
      console.error('Error archiving card:', e);
      showNotification('Error al archivar la tarjeta', 'error');
    }
  };

  const addStage = async (title: string, color: string) => {
    const position = stages.length;
    await api.post('/consolidation_stages', { title, color, position });
    await fetchStages();
  };

  const updateStage = async (id: string, updates: Partial<Stage>) => {
    await api.patch(`/consolidation_stages/${id}`, updates);
    await fetchStages();
  };

  const deleteStage = async (id: string) => {
    if (stages.length <= 1) return;
    await api.delete(`/consolidation_stages/${id}`);
    await fetchStages();
  };

  const reorderStages = async (startIndex: number, endIndex: number) => {
    const result = Array.from(stages);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setStages(result);

    // Save positions one by one (could be optimized batch)
    // For simplicity, we just iterate.
    for (let i = 0; i < result.length; i++) {
      await api.patch(`/consolidation_stages/${(result[i] as any).id}`, { position: i });
    }
  };

  const addTask = async (data: Omit<ConsolidationTask, 'id' | 'lastActivity'>) => {
    // REFACTOR: Creates a new MEMBER profile
    const names = data.name.split(' ');
    const lastName = names.length > 1 ? names.pop() : '';
    const firstName = names.join(' ');

    const res = await api.post('/profiles', {
      first_name: firstName,
      last_name: lastName,
      consolidation_stage_id: data.stage,
      phone: data.phone || null,
      district_id: data.districtId || null,
      cell_id: data.cellId || null,
      gender: data.gender || null,
      active: true,
      birth_date: data.birthDate || null,
      address: data.address || null,
      conversion_origin: data.conversionOrigin || null,
      conversion_event_id: data.conversionEventId || null
    });
    // Notes logic skipped as field missing in profiles table schema for now

    await fetchTasks();
    if (res && res.id) {
      // Fetch steps for the new task immediately
      await fetchSteps(res.id);

      // AUTOMATION: If created with District and Cell, mark step as completed
      if (data.districtId && data.cellId) {
        try {
          // We need to find the step ID. fetchSteps updates state but might be async/stale in closure.
          // Using direct API fetch to be safe/fast
          const sData = await api.get(`/profiles/${res.id}/steps`);
          if (sData) {
            const step = sData.find((s: any) => s.step_name === 'Asignar distrito y célula');
            if (step) {
              await toggleStep(step.id, true);
              showNotification('Paso "Asignar distrito y célula" completado automáticamente.', 'success');
            }
          }
        } catch (e) {
          console.error("Error auto-completing step on creation", e);
        }
      }
    }
  };

  const updateTask = async (id: string, updates: Partial<ConsolidationTask>) => {
    const dbUpdates: any = {};
    if (updates.name) {
      const names = updates.name.split(' ');
      dbUpdates.last_name = names.length > 1 ? names.pop() : '';
      dbUpdates.first_name = names.join(' ');
    }
    if (updates.stage !== undefined) dbUpdates.consolidation_stage_id = updates.stage;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.districtId !== undefined) dbUpdates.district_id = updates.districtId;
    if (updates.cellId !== undefined) dbUpdates.cell_id = updates.cellId;
    if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.visitDate !== undefined) dbUpdates.visit_date = updates.visitDate;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    await api.patch(`/profiles/${id}`, dbUpdates);

    // AUTOMATION: If District and Cell are assigned (or being assigned), complete the step.
    // Check current task state + updates
    const currentTask = tasks.find(t => t.id === id);
    const hasDistrict = updates.districtId || (currentTask?.districtId && updates.districtId !== null);
    const hasCell = updates.cellId || (currentTask?.cellId && updates.cellId !== null);

    if (hasDistrict && hasCell) {
      // Ensure steps are loaded
      let taskSteps = steps[id];
      if (!taskSteps) {
        await fetchSteps(id);
        taskSteps = steps[id];
        // Note: fetchSteps updates state, but 'steps' ref here might be stale in closure? 
        // However, await fetchSteps *should* update state, but react state update isn't immediate in this closure.
        // We might need to refetch steps result directly from fetchSteps return? 
        // Let's modify fetchSteps to return data or fetch API directly here to be safe.
        // For safety, let's fetch API directly here to find the step ID.
        try {
          const sData = await api.get(`/profiles/${id}/steps`);
          if (sData) {
            const step = sData.find((s: any) => s.step_name === 'Asignar distrito y célula');
            if (step && (step.completed === 0 || step.completed === false)) {
              await toggleStep(step.id, true);
              showNotification('Paso "Asignar distrito y célula" completado automáticmente.', 'success');
            }
          }
        } catch (e) { console.error('Auto-step error', e); }
      } else {
        // We have steps in state (maybe stale? but safe to try)
        const step = taskSteps.find(s => s.stepName === 'Asignar distrito y célula');
        if (step && !step.completed) {
          await toggleStep(step.id, true);
          showNotification('Paso "Asignar distrito y célula" completado automáticmente.', 'success');
        }
      }
    }

    await fetchTasks();
  };

  const deleteTask = async (id: string) => {
    // Remove from board -> set stage to null
    await api.patch(`/profiles/${id}`, { consolidation_stage_id: null });
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const moveTask = async (id: string, newStageId: string) => {
    const targetStage = stages.find(s => s.id === newStageId);

    // Check current task data
    const currentTask = tasks.find(t => t.id === id);

    // RESTRICTION: Prevent move to 'Por contactar' if 'Asignar distrito y célula' is not complete
    // FIX: If they HAVE District and Cell assigned, we auto-complete the step instead of blocking.
    if (targetStage && targetStage.title === 'Por contactar') {
      let taskSteps = steps[id];
      // If not in state, fetch valid data
      if (!taskSteps) {
        try {
          const sData = await api.get(`/profiles/${id}/steps`);
          if (sData) {
            taskSteps = sData.map((s: any) => ({
              id: s.id, profileId: s.profile_id, stepName: s.step_name,
              completed: s.completed === 1, completedAt: s.completed_at, stepOrder: s.step_order
            }));
            // Update state just in case
            setSteps(prev => ({ ...prev, [id]: taskSteps }));
          }
        } catch (e) { console.error("Error fetching steps for move check", e); }
      }

      const requiredStep = taskSteps?.find(s => s.stepName === 'Asignar distrito y célula');

      // Check if task has data (District & Cell)
      const hasData = currentTask?.districtId && currentTask?.cellId;

      if (requiredStep) {
        if (hasData && !requiredStep.completed) {
          // Has data but step is unchecked -> Auto-complete it and ALLOW move
          await toggleStep(requiredStep.id, true);
          showNotification('Paso "Asignar distrito y célula" completado automáticamente (Datos encontrados).', 'success');
        } else if (!hasData && !requiredStep.completed) {
          // No data and step unchecked -> BLOCK move
          showNotification('No se puede mover a "Por contactar": Debe asignar Distrito y Célula primero.', 'error');
          return; // ABORT MOVE
        }
      }
    }

    // Finally update
    await updateTask(id, { stage: newStageId });

    // Automation Trigger
    if (targetStage) {
      await checkAutomationRules(id, targetStage.title);

      // CLEANUP: If moving to Agendados (or later), clear pending calls
      if (targetStage.title === 'Agendados' || targetStage.position >= 2) {
        await cleanupPendingCalls(id);
      }
    }
  };

  const cleanupPendingCalls = async (profileId: string) => {
    try {
      // 1. Fetch all tasks (inefficient but safe for now, or use specific endpoint if available)
      // Ideally backend should handle this, but frontend logic for now:
      const allTasks = await api.get('/tasks');
      if (allTasks) {
        const pendingCalls = allTasks.filter((t: any) =>
          t.related_member_id === profileId &&
          t.category === 'consolidation_local' &&
          t.status === 'pending'
        );

        // 2. Mark them as completed
        for (const task of pendingCalls) {
          await api.patch(`/tasks/${task.id}`, { status: 'completed' });
        }

        if (pendingCalls.length > 0) {
          // Trigger a refresh of global tasks if possible, or just let UI update eventually
          // We don't have direct access to refreshGlobalTasks from here easily without prop drilling
          // but the Board reads from global 'tasks' in ConsolidationScreen which uses useTasks().
          // So we might need to trigger a refresh there.
          // For now, this updates the DB. The UI in ConsolidationScreen reads from globalTasks.
        }
      }
    } catch (e) {
      console.error("Error cleaning up pending calls", e);
    }
  };

  const scheduleAppointment = async (profileId: string, date: string, time: string, note: string) => {
    try {
      await api.patch(`/profiles/${profileId}`, {
        visit_date: `${date} ${time}`,
        notes: note
      });

      // Find and complete the step
      let taskSteps = steps[profileId];
      if (!taskSteps) {
        const sData = await api.get(`/profiles/${profileId}/steps`);
        if (sData) {
          taskSteps = sData.map((s: any) => ({
            id: s.id, profileId: s.profile_id, stepName: s.step_name,
            completed: s.completed === 1, completedAt: s.completed_at, stepOrder: s.step_order
          }));
        }
      }

      const step = taskSteps?.find((s: any) => s.stepName === 'Llamada y programación de cita' || s.stepName.toLowerCase().includes('llamada y'));
      if (step && !step.completed) {
        await toggleStep(step.id, true);
      }

      // Move to 'Agendados'
      const agendadosStage = stages.find(s => s.title === 'Agendados');
      if (agendadosStage) {
        await updateTask(profileId, { stage: agendadosStage.id });
      }

      showNotification('Cita programada exitosamente.', 'success');
      await fetchTasks();

      // CLEANUP: Also clean pending calls since appointment is set
      await cleanupPendingCalls(profileId);

    } catch (e) {
      console.error('Error scheduling:', e);
      showNotification('Error al programar cita', 'error');
    }
  };

  const logPendingCall = async (profileId: string, reason: string) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await api.post('/tasks', {
        title: 'Re-intentar contacto (Pendiente)',
        description: `Motivo: ${reason}`,
        status: 'pending',
        priority: 'high',
        category: 'consolidation_local',
        due_date: dateStr,
        related_member_id: profileId
      });

      showNotification('Recordatorio de llamada creado para mañana.', 'info');
    } catch (e) {
      console.error('Error logging pending call:', e);
      showNotification('Error al registrar pendiente', 'error');
    }
  };

  const checkAutomationRules = async (profileId: string, stageTitle: string) => {
    // Automation disabled by user request. Only Birthday automation (in TaskContext) remains.
    return;
  };

  return (
    <ConsolidationContext.Provider value={{
      tasks, stages, loading, addTask, updateTask, deleteTask, moveTask,
      addStage, updateStage, deleteStage, reorderStages,
      refreshTasks: fetchTasks,
      steps: steps || {},
      fetchSteps, toggleStep, archiveCard,
      scheduleAppointment, logPendingCall
    }}>
      {children}
    </ConsolidationContext.Provider>
  );
};

export const useConsolidation = () => {
  const context = useContext(ConsolidationContext);
  if (!context) throw new Error('useConsolidation must be used within a ConsolidationProvider');
  return context;
};
