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
      // Delegate to server for idempotent run
      await api.post('/tasks/automations/run', {});
      // Fetch tasks to ensure we have the latest ones
      await fetchTasks();
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
