
export enum UserRole {
  PASTOR = 'Pastor',
  ASSOCIATE_PASTOR = 'Pastor Asociado',
  LEADER = 'Líder de Célula',
  DISTRICT_SUPERVISOR = 'Supervisor de Distrito',
  MEMBER = 'Miembro',
  TIMOTEO = 'Timoteo',
  VISITOR = 'Visitante',
  ADMIN = 'Administrador'
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  active: boolean;
  imageUrl?: string;
  joinDate: string;
  districtId?: string;
  cellId?: string;
  birthDate?: string;
  maritalStatus?: string;
  gender?: 'Masculino' | 'Femenino' | 'Otro';
  profession?: string;
  address?: string;
  phone?: string;
  consolidationStageId?: string;
  visitDate?: string;
  notes?: string;
  conversionOrigin?: string; // 'cell', 'service', 'event'
  conversionEventId?: string;
}

export interface District {
  id: string;
  name: string;
  supervisorId: string;
  cellCount: number;
  active: boolean;
  color?: string;
}

export interface Cell {
  id: string;
  name: string;
  leaderId: string;
  districtId: string;
  memberCount: number;
  imageUrl?: string;
  meetingDay?: string;
}

export interface Stage {
  id: string;
  title: string;
  color: string;
}

export interface ConsolidationTask {
  id: string;
  name: string;
  stage: string;
  lastActivity: string;
  progress?: number;
  districtId?: string;
  cellId?: string; // ID of the assigned cell
  relatedMemberId?: string; // Link to the Member Profile (bidirectional sync)
  birthDate?: string;
  address?: string;
  gender?: 'Masculino' | 'Femenino' | 'Otro';
  active: boolean;
  phone?: string;
  notes?: string;
  visitDate?: string; // Fecha estipulada para la cita/visita
  completedSteps?: number;
  totalSteps?: number;
  conversionOrigin?: string;
  conversionEventId?: string;
}

export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'cell-report' | 'visit' | 'study' | 'personal' | 'pastoral' | 'automation';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate: string;
  createdAt: string;
  assignedToId: string;
  createdByUserId: string;
  relatedMemberId?: string;
  feedback?: string; // Result or Notes upon completion/rescheduling
}

export const CONSOLIDATION_STAGE_IDS = {
  ASSIGNMENT_PENDING: 'cd68673a-9851-4a39-95bf-980bf4036f57'
};

export interface ConsolidationStep {
  id: string;
  profileId: string;
  stepName: string;
  completed: boolean;
  completedAt?: string;
  stepOrder: number;
}

