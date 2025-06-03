
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaskCategories } from '@/hooks/useTaskCategories'; // Ensure this hook is correctly implemented
import type { TaskCategoryDefinition } from '@/types/task';
import { Trash2, Edit, PlusCircle, Palette, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

interface ManageCategoriesDialogProps {
  userId: string;
  children: React.ReactNode; // To wrap the trigger button
  onCategoriesUpdated?: () => void; // Optional callback after updates
}

// Simple Color Picker Component (adjust styling as needed)
const ColorPicker = ({ value, onChange }: { value: string; onChange: (color: string) => void }) => {
    const colors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#6B7280', '#EC4899', '#FBBF24']; // Example palette

    return (
        <div className="flex flex-wrap gap-2">
            {colors.map(color => (
                <button
                    key={color}
                    type="button"
                    onClick={() => onChange(color)}
                    className={cn(
                        "w-6 h-6 rounded-full border-2",
                        value === color ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                >
                    {value === color && <Check className="w-4 h-4 text-white mx-auto" />}
                </button>
            ))}
             {/* Fallback for custom color input if needed */}
             {/* <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded-full border border-input" /> */}
        </div>
    );
};

export function ManageCategoriesDialog({ userId, children, onCategoriesUpdated }: ManageCategoriesDialogProps) {
    const { categories, loading, addCategory, deleteCategory, editCategory } = useTaskCategories(userId);
    const { toast } = useToast();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#6B7280'); // Default color
    const [editingCategory, setEditingCategory] = useState<TaskCategoryDefinition | null>(null);
    const [editedName, setEditedName] = useState('');
    const [editedColor, setEditedColor] = useState('');

    useEffect(() => {
        // Reset fields when dialog closes or editing state changes
        if (!isDialogOpen || !editingCategory) {
            setNewCategoryName('');
            setNewCategoryColor('#6B7280');
            setEditingCategory(null);
            setEditedName('');
            setEditedColor('');
        } else {
            setEditedName(editingCategory.name);
            setEditedColor(editingCategory.color || '#6B7280');
        }
    }, [isDialogOpen, editingCategory]);

    const handleAddCategory = async () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) {
            toast({ title: 'خطأ', description: 'اسم الفئة مطلوب.', variant: 'destructive' });
            return;
        }
        await addCategory({ name: trimmedName, color: newCategoryColor });
        setNewCategoryName('');
        setNewCategoryColor('#6B7280');
        onCategoriesUpdated?.();
    };

    const handleDeleteCategory = async (categoryId: string) => {
        // Add confirmation dialog here if desired
        await deleteCategory(categoryId);
        onCategoriesUpdated?.();
    };

     const handleEditCategory = (category: TaskCategoryDefinition) => {
        setEditingCategory(category);
        setEditedName(category.name);
        setEditedColor(category.color || '#6B7280');
    };

    const handleSaveEdit = async () => {
        if (!editingCategory) return;
        const trimmedName = editedName.trim();
        if (!trimmedName) {
            toast({ title: 'خطأ', description: 'اسم الفئة مطلوب.', variant: 'destructive' });
            return;
        }
        await editCategory(editingCategory.id, { name: trimmedName, color: editedColor });
        setEditingCategory(null);
        onCategoriesUpdated?.();
    };

    const handleCancelEdit = () => {
        setEditingCategory(null);
    };

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            {/* Apply fixed height and overflow handling to DialogContent */}
            <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[90vh]" dir="rtl">
                <DialogHeader>
                    <DialogTitle>إدارة فئات المهام</DialogTitle>
                    <DialogDescription>
                        قم بإضافة، تعديل، أو حذف فئات المهام الخاصة بك.
                    </DialogDescription>
                </DialogHeader>

                 {/* Make the main content area scrollable */}
                 <ScrollArea className="flex-1 py-4 overflow-y-auto"> {/* Added ScrollArea */}
                     {/* Add New Category Section */}
                    <div className="grid gap-4 border-b pb-6 mb-4">
                        <h3 className="text-lg font-medium">إضافة فئة جديدة</h3>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-cat-name" className="text-right whitespace-nowrap">
                                الاسم
                            </Label>
                            <Input
                                id="new-cat-name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                className="col-span-3 bg-input"
                                placeholder="اسم الفئة..."
                            />
                        </div>
                        <div className="grid grid-cols-4 items-start gap-4">
                            <Label className="text-right pt-1">
                                اللون
                            </Label>
                            <div className="col-span-3">
                                <ColorPicker value={newCategoryColor} onChange={setNewCategoryColor} />
                            </div>
                        </div>
                        <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()} className="w-full justify-self-end mt-2 bg-primary hover:bg-primary/90">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة فئة
                        </Button>
                    </div>

                    {/* Existing Categories List */}
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium mb-2">الفئات الحالية</h3>
                        {loading ? (
                            <p>جار تحميل الفئات...</p>
                        ) : categories.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center">لا توجد فئات معرفة.</p>
                        ) : (
                            categories.map(category => (
                                <div key={category.id} className="flex items-center gap-2 p-2 border rounded-md bg-card hover:bg-muted/50">
                                    {editingCategory?.id === category.id ? (
                                        // Edit Mode
                                        <>
                                            <Input
                                                value={editedName}
                                                onChange={(e) => setEditedName(e.target.value)}
                                                className="flex-1 h-8 bg-input"
                                                placeholder="اسم الفئة..."
                                            />
                                            <ColorPicker value={editedColor} onChange={setEditedColor} />
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleSaveEdit}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleCancelEdit}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </>
                                    ) : (
                                        // Display Mode
                                        <>
                                            <span
                                                className="inline-block h-4 w-4 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: category.color || '#6B7280' }}
                                            />
                                            <span className="flex-1 text-sm truncate">{category.name}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleEditCategory(category)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCategory(category.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea> {/* End ScrollArea */}

                <DialogFooter className="mt-auto pt-4 border-t"> {/* Added border-t and padding */}
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            إغلاق
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
