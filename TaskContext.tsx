import React, { createContext, useContext, useState, useEffect } from 'react';
import { Task, TaskStatus } from './types';
import { api } from './lib/api';
import { useUsers } from './UserContext';

interface TaskContextType {
  tasks: Task[];
  loading: boolean;
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  getOverdueReportsCount: (userId: string) => number;
  getPendingCount: (userId: string) => number;
  resolveTask: (id: string, status: TaskStatus, feedback?: string, newDueDate?: string) => Promise<void>;
  refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUsers();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const hasCheckedBirthdays = React.useRef(false);

  useEffect(() => {
    if (user) {
      fetchTasks();
      if (!hasCheckedBirthdays.current) {
        checkDailyBirthdayTasks();
        hasCheckedBirthdays.current = true;
      }
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [user]);

  const checkDailyBirthdayTasks = async () => {
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) return;
      const { user } = JSON.parse(sessionStr);

      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${mm}-${dd}`;

      // 1. Get all active users
      const users = await api.get('/profiles');
      // Filter in memory since API is simple
      const activeUsersWithBirthday = users.filter((u: any) =>
        (u.active === 1 || u.active === true) && u.birth_date
      );

      // 2. Filter for users having birthday today
      const todayBirthdays = activeUsersWithBirthday.filter((user: any) => {
        const [, month, day] = user.birth_date.split('-');
        return month === mm && day === dd;
      });

      if (todayBirthdays.length === 0) return;

      // 3. Get generic roles/entities needed for assignment
      const cellData = await api.get('/cells');
      const districtData = await api.get('/districts');

      const pastorData = users.filter((p: any) =>
        p.role === 'Pastor' || p.role === 'Pastor Asociado'
      );

      const cellsMap = new Map(cellData?.map((c: any) => [c.id, c.leader_id]));
      const districtsMap = new Map(districtData?.map((d: any) => [d.id, d.supervisor_id]));
      const pastorIds = pastorData?.map((p: any) => p.id) || [];

      // 4. Create tasks for each birthday person
      for (const birthdayPerson of todayBirthdays) {
        const assignees = new Set<string>();

        // Add Cell Leader
        if (birthdayPerson.cell_id && cellsMap.has(birthdayPerson.cell_id)) {
          const leaderId = cellsMap.get(birthdayPerson.cell_id);
          if (leaderId) assignees.add(leaderId);
        }

        // Add District Supervisor
        if (birthdayPerson.district_id && districtsMap.has(birthdayPerson.district_id)) {
          const supervisorId = districtsMap.get(birthdayPerson.district_id);
          if (supervisorId) assignees.add(supervisorId);
        }

        // Add Pastors
        pastorIds.forEach((id: string) => assignees.add(id));

        // Remove self from assignees if the birthday person holds one of these roles
        assignees.delete(birthdayPerson.id);

        const title = `Llamar a ${birthdayPerson.first_name} ${birthdayPerson.last_name} por su cumpleaños`;
        const description = `Hoy es el cumpleaños de ${birthdayPerson.first_name} ${birthdayPerson.last_name}. ¡Llama para felicitarle! Teléfono: ${birthdayPerson.phone || 'No registrado'}`;

        for (const assigneeId of assignees) {
          // We'll skip duplicate check for simplicity in this migration or assume API handles it?
          // Actually, let's just create it. Real backend would handle unique constraints.
          // Or we filter existing tasks in memory:
          const exists = tasks.some(t =>
            t.category === 'automation' &&
            t.relatedMemberId === birthdayPerson.id &&
            t.assignedToId === assigneeId &&
            t.dueDate === todayStr
          );

          if (!exists) {
            await api.post('/tasks', {
              title,
              description,
              status: 'pending',
              priority: 'high',
              category: 'automation',
              due_date: todayStr,
              assigned_to_id: assigneeId,
              created_by_user_id: user.id,
              related_member_id: birthdayPerson.id
            });
          }
        }
      }

      // Refresh tasks if we added any
      if (todayBirthdays.length > 0) {
        fetchTasks();
      }

    } catch (error) {
      console.error('Error running birthday automation:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const data = await api.get('/tasks');
      // Return ALL tasks. Filtering should happen in consumers if needed.
      setTasks(data.map(mapDbToTask));
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const mapDbToTask = (data: any): Task => ({
    id: data.id,
    title: data.title,
    description: data.description || '',
    status: data.status,
    priority: data.priority,
    category: data.category,
    dueDate: data.due_date,
    createdAt: data.created_at,
    assignedToId: data.assigned_to_id,
    createdByUserId: data.created_by_user_id,
    relatedMemberId: data.related_member_id,
    feedback: data.feedback
  });

  const addTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    try {
      await api.post('/tasks', {
        title: taskData.title,
        description: taskData.description,
        status: taskData.status,
        priority: taskData.priority,
        category: taskData.category,
        due_date: taskData.dueDate,
        assigned_to_id: taskData.assignedToId,
        created_by_user_id: taskData.createdByUserId,
        related_member_id: taskData.relatedMemberId
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  };

  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    try {
      await api.patch(`/tasks/${id}`, { status });
      await fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const resolveTask = async (id: string, status: TaskStatus, feedback?: string, newDueDate?: string) => {
    try {
      // 1. Get current feedback
      // In this simple API we don't have get-single-task endpoint yet exposed in routes.js cleanly?
      // Actually we do not. We can fetch all tasks (cached in state) or add endpoint.
      // Let's rely on current state for simplicity.
      const task = tasks.find(t => t.id === id);
      const currentFeedback = task?.feedback || '';

      const updates: any = { status };

      if (feedback) {
        const timestamp = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
        const actionLabel = status === 'completed' ? 'COMPLETADA' : (newDueDate ? 'REPROGRAMADA' : 'ACTUALIZADA');
        const newEntry = `[${timestamp}] ${actionLabel}: ${feedback}`;
        updates.feedback = currentFeedback ? `${currentFeedback}\n\n${newEntry}` : newEntry;
      }

      if (newDueDate) updates.due_date = newDueDate;

      await api.patch(`/tasks/${id}`, updates);
      await fetchTasks();
    } catch (error) {
      console.error('Error resolving task:', error);
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getOverdueReportsCount = (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t =>
      t.assignedToId === userId &&
      t.category === 'cell-report' &&
      t.status !== 'completed' &&
      t.dueDate <= today
    ).length;
  };

  const getPendingCount = (userId: string) => {
    return tasks.filter(t => t.assignedToId === userId && t.status !== 'completed').length;
  };

  return (
    <TaskContext.Provider value={{
      tasks, loading, addTask, updateTaskStatus, deleteTask,
      getOverdueReportsCount, getPendingCount, resolveTask,
      refreshTasks: fetchTasks
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be used within a TaskProvider');
  return context;
};
