
// src/app/(app)/TaskDataLoader.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { db, auth as firebaseAuthInstance } from '@/config/firebase'; // Import auth for direct check
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { TaskPageProvider } from '@/context/TaskPageContext';
import type { TaskType, TaskFirestoreData, PriorityLevel, Milestone, MilestoneFirestoreData } from '@/types/task';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';
import { useToast } from '@/hooks/use-toast'; // Import useToast

// Function to map Firestore data to TaskType
const mapFirestoreTaskToTaskType = (id: string, data: TaskFirestoreData): TaskType | null => {
    // Basic validation
    if (!data.description || !data.status || !data.userId) {
        console.warn(`TaskDataLoader: Firestore task document ${id} is missing required fields (description, status, userId). Skipping. Data:`, data);
        return null;
    }

    let priority: PriorityLevel | undefined = undefined;
    if (data.priority !== null && data.priority !== undefined) {
        const p = Number(data.priority);
        if (p >= 1 && p <= 5) {
            priority = p as PriorityLevel;
        } else {
            console.warn(`TaskDataLoader: Invalid priority value ${data.priority} for task ${id}. Setting to undefined.`);
        }
    }

    // --- Correct Milestone Mapping ---
    const firestoreMilestones = data.milestones;
    // console.log(`[TaskDataLoader ${id}] Mapping task. Raw milestones data:`, firestoreMilestones); // Reduced verbosity

    // Ensure milestones are correctly mapped or defaulted to an empty array
    const mappedMilestones: Milestone[] = Array.isArray(firestoreMilestones)
        ? firestoreMilestones.map((m: MilestoneFirestoreData) => {
            // Ensure dueDate is converted to Date or remains undefined
            let mappedDueDate: Date | undefined = undefined;
            if (m.dueDate instanceof Timestamp) {
                try {
                    mappedDueDate = m.dueDate.toDate();
                } catch (e) {
                    console.error(`[TaskDataLoader ${id}] Error converting milestone dueDate timestamp:`, e);
                    mappedDueDate = undefined; // Keep undefined on error
                }
            }
            return {
                id: m.id || 'missing-id-' + Math.random().toString(36).substring(7), // Generate temporary ID if missing
                description: m.description || '',
                completed: !!m.completed, // Ensure boolean
                weight: typeof m.weight === 'number' ? m.weight : 0, // Ensure number, default to 0
                dueDate: mappedDueDate, // Use the converted JS Date or undefined
              };
          })
        : []; // Default to empty array if null, undefined, or not an array

     // console.log(`[TaskDataLoader ${id}] Mapped milestones:`, JSON.stringify(mappedMilestones)); // Reduced verbosity

    const mappedTask: TaskType = {
        id,
        description: data.description,
        details: data.details ?? undefined,
        startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
        dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : undefined,
        durationValue: data.durationValue ?? undefined,
        durationUnit: data.durationUnit ?? undefined,
        priority: priority,
        priorityReason: data.priorityReason ?? undefined,
        status: data.status,
        taskCategoryName: data.taskCategoryName ?? undefined,
        milestones: mappedMilestones, // Use the correctly processed milestones array

        // Task context fields
        taskContext: data.taskContext ?? undefined,
        organizationId: data.organizationId ?? undefined,
        departmentId: data.departmentId ?? undefined,
        assignedToUserId: data.assignedToUserId ?? undefined,
        parentTaskId: data.parentTaskId ?? undefined,
    };
    // console.log(`[TaskDataLoader ${id}] Successfully mapped task:`, mappedTask); // Reduced verbosity
    return mappedTask;
};

// --- Task Data Loader Component ---
export function TaskDataLoader({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast(); // Initialize useToast
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
        console.log("TaskDataLoader: No user, clearing tasks and stopping loading.");
        setTasks([]);
        setIsLoading(false);
        setError(null);
        return () => {};
    }

    setIsLoading(true);
    setError(null);
    console.log(`TaskDataLoader: Setting up Firestore listener for user: ${user.uid}`);

    const tasksColRef = collection(db, 'tasks');
    const q = query(
        tasksColRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        // console.log(`TaskDataLoader: Firestore snapshot received. Has pending writes: ${querySnapshot.metadata.hasPendingWrites}`); // Reduced verbosity
        const fetchedTasks: TaskType[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data && typeof data === 'object' && 'userId' in data && data.userId === user.uid) {
                 const mappedTask = mapFirestoreTaskToTaskType(doc.id, data as TaskFirestoreData);
                 if (mappedTask) {
                    fetchedTasks.push(mappedTask);
                 } else {
                    console.warn(`TaskDataLoader: Failed to map task ${doc.id}. Raw data:`, data);
                 }
            } else {
                console.warn(`TaskDataLoader: Query returned task ${doc.id} with unexpected data or wrong user. Raw data:`, data);
            }
        });
        // console.log(`TaskDataLoader: Processed ${fetchedTasks.length} tasks from snapshot. Updating state.`); // Reduced verbosity
        setTasks(fetchedTasks);
        setIsLoading(false);
    }, (err) => {
        // Use the corrected context string here
        const isPermissionError = handleFirestoreError(err, 'TaskDataLoader');

        // Check if the error is a permission error AND the user is now logged out
        if (isPermissionError && !firebaseAuthInstance.currentUser) {
          console.warn("TaskDataLoader: Permission denied after logout, likely normal cleanup. Suppressing error toast.");
          setError(null); // Clear local error state
          setTasks([]);   // Clear tasks
          setIsLoading(false);
          return; // Exit without showing a toast
        }

        // For other errors or permission errors while user is still logged in
        if (!isPermissionError || (isPermissionError && firebaseAuthInstance.currentUser)) {
          setError('حدث خطأ أثناء تحميل المهام.');
          toast({ title: 'خطأ', description: 'حدث خطأ أثناء تحميل المهام.', variant: 'destructive' });
        }
        setIsLoading(false);
        setTasks([]); // Clear tasks on error
    });

    // Add listener to the manager
    firestoreListenerManager.addListener(`task-data-loader-${user.uid}`, unsubscribe);

    return () => {
        console.log(`TaskDataLoader: Unsubscribing from Firestore listener for user: ${user.uid}.`);
        // Remove the specific listener using its key
        firestoreListenerManager.removeListener(`task-data-loader-${user.uid}`);
    };
  }, [user, toast]); // Added toast to dependencies

  if (isLoading && tasks.length === 0) { // Show loading only if tasks are empty and still loading
      return (
           <div className="flex justify-center items-center flex-1 h-full">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">تحميل المهام...</span>
           </div>
      );
  }
   if (error) {
        return (
            <div className="flex justify-center items-center flex-1 h-full text-destructive">
                <p>{error}</p>
            </div>
        );
    }

  // console.log(`[TaskDataLoader Provider] Rendering TaskPageProvider with ${tasks.length} tasks.`); // Reduced verbosity
  return (
    <TaskPageProvider initialTasks={tasks}>
      {children}
    </TaskPageProvider>
  );
}
