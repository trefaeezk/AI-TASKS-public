
// src/hooks/useTaskCategories.ts

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { db } from '@/config/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore';
import type { TaskCategoryDefinition } from '@/types/task';
import { useToast } from '@/hooks/use-toast'; // Import useToast here

// Define the hook
export const useTaskCategories = (userId?: string) => {
    const { toast } = useToast();
    const [categories, setCategories] = useState<TaskCategoryDefinition[]>([]);
    const [loading, setLoading] = useState(true); // Start loading true

    // Fetch/Simulate fetching categories based on userId
    useEffect(() => {
        console.log("useTaskCategories: useEffect triggered. userId:", userId);
        if (!userId) {
            console.log("useTaskCategories: No userId provided, clearing categories.");
            setCategories([]);
            setLoading(false);
            return;
        }

        // --- Real Firestore Implementation ---
        console.log("useTaskCategories: Setting up Firestore listener for userId:", userId);
        setLoading(true);
        const catColRef = collection(db, 'taskCategories');
        const q = query(
            catColRef,
            where('userId', '==', userId),
            orderBy('name', 'asc') // استخدام الفهرس المركب userId + name لتحسين الأداء والترتيب
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log("useTaskCategories: Firestore snapshot received.");
            const fetchedCategories: TaskCategoryDefinition[] = [];
            snapshot.forEach((doc) => {
                // Basic data validation
                const data = doc.data();
                if (data && data.name && data.userId === userId) {
                     fetchedCategories.push({
                        id: doc.id,
                        userId: data.userId,
                        name: data.name,
                        color: data.color || undefined // Handle optional color
                    } as TaskCategoryDefinition);
                } else {
                    console.warn(`useTaskCategories: Skipping invalid category document ${doc.id}`, data);
                }
            });
            const sortedCategories = fetchedCategories.sort((a, b) => a.name.localeCompare(b.name));
            console.log("useTaskCategories: Setting categories from Firestore:", sortedCategories);
            setCategories(sortedCategories); // Set and sort
            setLoading(false); // Set loading false *after* state update
        }, (error) => {
            console.error("useTaskCategories: Error fetching categories:", error);

            // التعامل مع أخطاء الصلاحيات بعد تسجيل الخروج
            if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
              console.warn("useTaskCategories: Permission denied, user may have been signed out.");
              // لا نعرض toast في هذه الحالة لأنه قد يكون بسبب تسجيل الخروج
              setLoading(false);
              setCategories([]);
              return;
            }

            toast({ title: 'خطأ في تحميل الفئات', variant: 'destructive' });
            setLoading(false);
            setCategories([]); // Clear categories on error
        });
        // Cleanup the listener on unmount or when userId changes
        return () => {
            console.log("useTaskCategories: Unsubscribing from Firestore listener.");
            unsubscribe();
        };
        // --- End Real Firestore Implementation ---

    }, [userId, toast]); // Re-run effect when userId or toast changes


    // Functions to add/edit/delete categories
    const addCategory = useCallback(async (newCategoryData: Omit<TaskCategoryDefinition, 'id' | 'userId'>) => {
        if (!userId) {
             toast({ title: 'خطأ', description: 'معرف المستخدم غير موجود.', variant: 'destructive' });
             return;
        }
        const trimmedName = newCategoryData.name.trim();
        if (!trimmedName) {
            toast({ title: 'خطأ', description: 'اسم الفئة مطلوب.', variant: 'destructive' });
            return;
        }

        // Prevent adding duplicates (case-insensitive check)
        if (categories.some(cat => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
            toast({ title: 'الفئة موجودة', description: `الفئة "${trimmedName}" موجودة بالفعل.`, variant: 'default' });
            return;
        }

        const categoryToAdd = { ...newCategoryData, name: trimmedName, userId };
        console.log("useTaskCategories: Attempting to add category to Firestore:", categoryToAdd);

        // Add to Firestore - Listener will handle the UI update
        try {
             const docRef = await addDoc(collection(db, 'taskCategories'), categoryToAdd);
             console.log("useTaskCategories: Category added to Firestore with ID:", docRef.id);
             toast({ title: 'تمت إضافة الفئة', description: `تمت إضافة "${trimmedName}".` });
             // No need for optimistic update here if the listener is active
        } catch (error) {
             console.error("useTaskCategories: Error adding category to Firestore:", error);
             toast({ title: 'خطأ في إضافة الفئة', variant: 'destructive' });
             // No explicit revert needed as the listener didn't pick up the failed add
        }
    }, [userId, categories, toast]); // Added categories dependency for duplicate check

    const deleteCategory = useCallback(async (categoryId: string) => {
        // Get category details *before* attempting delete for potential revert
        const categoryToDelete = categories.find(cat => cat.id === categoryId);
         if (!categoryToDelete) {
             console.warn("useTaskCategories: Category to delete not found locally:", categoryId);
             // Optionally try deleting directly from Firestore anyway, or return early
             // For safety, let's return if not found locally
             return;
         }
         console.log("useTaskCategories: Attempting to delete category from Firestore:", categoryToDelete);

        // Delete from Firestore - Listener will handle UI update
        try {
             await deleteDoc(doc(db, 'taskCategories', categoryId));
             console.log("useTaskCategories: Category deleted request sent to Firestore:", categoryId);
             toast({ title: 'تم حذف الفئة', variant: 'default' }); // Use default variant, not destructive
             // No optimistic update needed here if the listener is active
        } catch (error) {
             console.error("useTaskCategories: Error deleting category from Firestore:", error);
             toast({ title: 'خطأ في حذف الفئة', variant: 'destructive' });
             // No explicit revert needed as the listener didn't pick up the failed delete
        }
    }, [categories, toast]); // Added categories dependency to find the item for revert logic if needed

    // Add editCategory function
    const editCategory = useCallback(async (categoryId: string, updates: Partial<Pick<TaskCategoryDefinition, 'name' | 'color'>>) => {
        const originalCategory = categories.find(cat => cat.id === categoryId);
        if (!originalCategory) {
            console.warn("useTaskCategories: Category to edit not found locally:", categoryId);
            return;
        }

         const trimmedName = updates.name?.trim();
         if (trimmedName === '') {
            toast({ title: 'خطأ', description: 'اسم الفئة لا يمكن أن يكون فارغًا.', variant: 'destructive' });
            return; // Prevent saving empty name
         }
         const finalUpdates = { ...updates, name: trimmedName || originalCategory.name }; // Use trimmed name or original if empty

         // Check for duplicate name (excluding the category being edited)
         if (finalUpdates.name && categories.some(cat => cat.id !== categoryId && cat.name.toLowerCase() === finalUpdates.name.toLowerCase())) {
            toast({ title: 'الفئة موجودة', description: `الفئة "${finalUpdates.name}" موجودة بالفعل.`, variant: 'default' });
            return;
         }

        console.log("useTaskCategories: Attempting to edit category in Firestore:", categoryId, "with updates:", finalUpdates);

        // Update Firestore - Listener will handle UI update
        try {
            await updateDoc(doc(db, 'taskCategories', categoryId), finalUpdates);
            console.log("useTaskCategories: Category update request sent to Firestore:", categoryId);
            toast({ title: 'تم تعديل الفئة', description: `تم تعديل "${finalUpdates.name ?? originalCategory.name}".` });
             // No optimistic update needed here if the listener is active
        } catch (error) {
            console.error("useTaskCategories: Error editing category in Firestore:", error);
            toast({ title: 'خطأ في تعديل الفئة', variant: 'destructive' });
            // No explicit revert needed as the listener didn't pick up the failed update
        }
    }, [categories, toast]); // Added categories dependency for checks and potential revert


    // --- Category Color Map ---
     const categoryColorMap = useMemo(() => {
        const map = new Map<string, string>();
        categories.forEach(cat => {
            if (cat.name && cat.color) {
                map.set(cat.name, cat.color);
            }
        });
         // console.log("useTaskCategories: Recalculated categoryColorMap:", map); // Reduced logging frequency
        return map;
    }, [categories]);

    const getCategoryColor = useCallback((categoryName?: string): string | undefined => {
        return categoryName ? categoryColorMap.get(categoryName) : undefined;
    }, [categoryColorMap]);


    // Return values from the hook
    return { categories, loading, addCategory, deleteCategory, editCategory, getCategoryColor };
};


