
// src/types/task.ts
import type { Timestamp } from 'firebase/firestore';

// Define Duration Unit type
export type DurationUnit = 'hours' | 'days' | 'weeks';

// Define Task Status type
export type TaskStatus = 'pending' | 'completed' | 'hold';

// Define Priority Level type (1: Highest, 5: Lowest)
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;

// Define Task Context type
export type TaskContext = 'individual' | 'department' | 'organization';

// Define Milestone interface used in the application logic (with JS Date)
export interface Milestone {
    id: string;
    description: string;
    completed: boolean;
    weight: number;
    dueDate?: Date; // JS Date object, optional
    assignedToUserId?: string; // ID of the user assigned to this milestone
}

// Define the Task interface used within the application logic (with JS Date)
export interface TaskType {
  id: string;
  description: string;
  details?: string;
  startDate?: Date; // JS Date object, optional
  dueDate?: Date; // JS Date object, optional
  durationValue?: number;
  durationUnit?: DurationUnit;
  priority?: PriorityLevel;
  priorityReason?: string;
  status: TaskStatus;
  taskCategoryName?: string;
  milestones?: Milestone[]; // Array of milestones with JS Date dueDate

  // Task context fields
  taskContext?: TaskContext; // individual, department, or organization
  organizationId?: string; // ID of the organization (for department and organization contexts)
  departmentId?: string; // ID of the department (for department context)
  assignedToUserId?: string; // ID of the user assigned to the task
  parentTaskId?: string; // ID of the parent task (for subtasks)

  // OKR fields
  objectiveId?: string; // ID of the objective this task is linked to
  keyResultId?: string; // ID of the key result this task is linked to
  linkedToOkr?: boolean; // Whether this task is linked to any key result
}

// Interface for storing Firestore milestone data (with Firestore Timestamp)
export interface MilestoneFirestoreData {
    id: string;
    description: string;
    completed: boolean;
    weight: number;
    dueDate?: Timestamp | null; // Firestore Timestamp or null
    assignedToUserId?: string | null; // ID of the user assigned to this milestone
}

// Interface for data stored in Firestore (uses Timestamp)
export interface TaskFirestoreData {
    description: string;
    userId: string;
    status: TaskStatus;
    details?: string | null;
    startDate?: Timestamp | null;
    dueDate?: Timestamp | null;
    durationValue?: number | null;
    durationUnit?: DurationUnit | null;
    priority?: PriorityLevel | null;
    priorityReason?: string | null;
    taskCategoryName?: string | null;
    milestones?: MilestoneFirestoreData[] | null; // Array of milestones with Timestamp dueDate

    // Task context fields
    taskContext?: TaskContext | null; // individual, department, or organization
    organizationId?: string | null; // ID of the organization (for department and organization contexts)
    departmentId?: string | null; // ID of the department (for department context)
    assignedToUserId?: string | null; // ID of the user assigned to the task
    parentTaskId?: string | null; // ID of the parent task (for subtasks)

    // OKR fields
    objectiveId?: string | null; // ID of the objective this task is linked to
    keyResultId?: string | null; // ID of the key result this task is linked to
    linkedToOkr?: boolean | null; // Whether this task is linked to any key result

    createdAt?: Timestamp | null; // When the task was created
    updatedAt?: Timestamp | null; // When the task was last updated
}

// Interface for user-defined categories
export interface TaskCategoryDefinition {
    id: string;
    userId: string;
    name: string;
    color?: string;
}
