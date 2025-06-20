
// src/types/task.ts
import type { Timestamp } from 'firebase/firestore';

// Define Duration Unit type
export type DurationUnit = 'hours' | 'days' | 'weeks';

// Define Task Status type
export type TaskStatus = 'pending' | 'hold' | 'completed' | 'in-progress' | 'cancelled' | 'pending-approval';

// Define Priority Level type (1: Highest, 5: Lowest) or string values
export type PriorityLevel = 1 | 2 | 3 | 4 | 5 | 'high' | 'medium' | 'low';

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
  completedDate?: Date; // Date when the task was completed
  durationValue?: number;
  durationUnit?: DurationUnit;
  priority?: PriorityLevel;
  priorityReason?: string;
  status: TaskStatus;
  progress?: number; // Progress percentage (0-100)
  taskCategoryName?: string;
  categoryId?: string; // ID of the task category
  milestones?: Milestone[]; // Array of milestones with JS Date dueDate
  title?: string; // Alternative to description, used in some contexts
  notes?: string; // Additional notes
  comment?: string; // Comments on the task

  // Task context fields
  taskContext?: TaskContext; // individual, department, or organization
  organizationId?: string; // ID of the organization (for department and organization contexts)
  departmentId?: string; // ID of the department (for department context)
  assignedToUserId?: string; // ID of the user assigned to the task (for single assignment)
  assignedToUserIds?: string[]; // IDs of users assigned to the task (for multiple assignment)
  parentTaskId?: string; // ID of the parent task (for subtasks)

  // OKR fields
  objectiveId?: string; // ID of the objective this task is linked to
  keyResultId?: string; // ID of the key result this task is linked to
  linkedToOkr?: boolean; // Whether this task is linked to any key result

  // Approval fields
  requiresApproval?: boolean; // Whether this task requires approval
  approvalLevel?: 'department' | 'organization'; // Level of approval required
  approved?: boolean; // Whether the task is approved (true/false/undefined)
  approvedBy?: string; // ID of the user who approved the task
  approvedByName?: string; // Name of the user who approved the task
  approvedAt?: Timestamp; // When the task was approved
  rejectedBy?: string; // ID of the user who rejected the task
  rejectedAt?: Timestamp; // When the task was rejected
  rejectionReason?: string; // Reason for rejection
  submittedBy?: string; // ID of the user who submitted the task for approval
  submittedByName?: string; // Name of the user who submitted the task for approval
  submittedAt?: Timestamp; // When the task was submitted for approval
  notificationRead?: boolean; // Whether the notification has been read

  // Additional fields for task management
  userId?: string; // ID of the user who owns the task (for backward compatibility)
  createdBy?: string; // ID of the user who created the task
  order?: number; // Order for sorting tasks
  createdAt?: Date; // When the task was created
  updatedAt?: Date; // When the task was last updated
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
    assignedToUserId?: string | null; // ID of the user assigned to the task (for single assignment)
    assignedToUserIds?: string[] | null; // IDs of users assigned to the task (for multiple assignment)
    parentTaskId?: string | null; // ID of the parent task (for subtasks)

    // OKR fields
    objectiveId?: string | null; // ID of the objective this task is linked to
    keyResultId?: string | null; // ID of the key result this task is linked to
    linkedToOkr?: boolean | null; // Whether this task is linked to any key result

    // Additional fields for task management
    createdBy?: string | null; // ID of the user who created the task
    order?: number | null; // Order for sorting tasks
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

// Export Task as an alias for TaskType for backward compatibility
export type Task = TaskType;
