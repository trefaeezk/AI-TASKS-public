'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types/roles';
import { CreateUserInput } from '@/types/user';
import { SystemType } from '@/types/system';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Schema for form validation
const createUserSchema = z.object({
  email: z.string().email({ message: 'البريد الإلكتروني غير صالح.' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' }),
  name: z.string().min(1, { message: 'الاسم مطلوب.' }),
  role: z.enum(['system_owner', 'system_admin', 'organization_owner', 'org_admin', 'org_supervisor', 'org_engineer', 'org_technician', 'org_assistant', 'independent'], {
    errorMap: () => ({ message: 'الدور مطلوب.' })
  }),
  accountType: z.enum(['individual', 'organization'], {
    errorMap: () => ({ message: 'نوع الحساب مطلوب.' })
  }),
  organizationId: z.string().optional(),
  departmentId: z.string().optional(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

interface CreateUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (userData: CreateUserInput) => Promise<void>;
  loading: boolean;
}

export function CreateUserDialog({ isOpen, onOpenChange, onSubmit, loading }: CreateUserDialogProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      role: 'org_assistant' as UserRole, // الافتراضي حسب الهيكلة الموحدة
      accountType: 'individual' as SystemType,
      organizationId: '',
      departmentId: '',
    },
  });

  // Get current values
  const currentRole = watch('role') as UserRole;
  const currentAccountType = watch('accountType') as SystemType;

  const handleFormSubmit = async (data: CreateUserFormValues) => {
    try {
      await onSubmit(data as CreateUserInput);
      reset();
    } catch (error) {
      console.error("Error during user creation submission:", error);
    }
  };

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
          <DialogDescription>
            أدخل تفاصيل المستخدم الجديد أدناه. سيتم إنشاء الحساب وتعيين الدور المحدد له.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
          {/* Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              الاسم
            </Label>
            <Input
              id="name"
              {...register('name')}
              className="col-span-3 bg-input"
              aria-invalid={errors.name ? "true" : "false"}
            />
          </div>
          {errors.name && <p className="col-span-4 text-right text-sm text-destructive">{errors.name.message}</p>}

          {/* Email */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              البريد الإلكتروني
            </Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className="col-span-3 bg-input"
              aria-invalid={errors.email ? "true" : "false"}
            />
          </div>
          {errors.email && <p className="col-span-4 text-right text-sm text-destructive">{errors.email.message}</p>}

          {/* Password */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              كلمة المرور
            </Label>
            <Input
              id="password"
              type="password"
              {...register('password')}
              className="col-span-3 bg-input"
              aria-invalid={errors.password ? "true" : "false"}
            />
          </div>
          {errors.password && <p className="col-span-4 text-right text-sm text-destructive">{errors.password.message}</p>}

          {/* Role */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              الدور
            </Label>
            <div className="col-span-3">
              <Select
                value={currentRole}
                onValueChange={(value) => setValue('role', value as UserRole)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر دورًا" />
                </SelectTrigger>
                <SelectContent>
                  {/* أدوار النظام العامة */}
                  <SelectItem value="system_owner">مالك النظام</SelectItem>
                  <SelectItem value="system_admin">أدمن النظام العام</SelectItem>
                  <SelectItem value="independent">مستخدم مستقل</SelectItem>

                  {/* أدوار المؤسسات */}
                  <SelectItem value="organization_owner">مالك المؤسسة</SelectItem>
                  <SelectItem value="org_admin">أدمن المؤسسة</SelectItem>
                  <SelectItem value="org_supervisor">مشرف</SelectItem>
                  <SelectItem value="org_engineer">مهندس</SelectItem>
                  <SelectItem value="org_technician">فني</SelectItem>
                  <SelectItem value="org_assistant">مساعد فني</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {errors.role && <p className="col-span-4 text-right text-sm text-destructive">{errors.role.message}</p>}

          {/* Account Type */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="accountType" className="text-right">
              نوع الحساب
            </Label>
            <div className="col-span-3">
              <Select
                value={currentAccountType}
                onValueChange={(value) => setValue('accountType', value as SystemType)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الحساب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">فردي</SelectItem>
                  <SelectItem value="organization">مؤسسة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {errors.accountType && <p className="col-span-4 text-right text-sm text-destructive">{errors.accountType.message}</p>}

          {/* Organization ID - Only shown for organization accounts */}
          {currentAccountType === 'organization' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="organizationId" className="text-right">
                  معرف المؤسسة
                </Label>
                <Input
                  id="organizationId"
                  {...register('organizationId')}
                  className="col-span-3 bg-input"
                />
              </div>
              {errors.organizationId && <p className="col-span-4 text-right text-sm text-destructive">{errors.organizationId.message}</p>}
            </>
          )}

          {/* Department ID - Only shown for organization accounts */}
          {currentAccountType === 'organization' && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="departmentId" className="text-right">
                  معرف القسم
                </Label>
                <Input
                  id="departmentId"
                  {...register('departmentId')}
                  className="col-span-3 bg-input"
                />
              </div>
              {errors.departmentId && <p className="col-span-4 text-right text-sm text-destructive">{errors.departmentId.message}</p>}
            </>
          )}

          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">إلغاء</Button>
            </DialogClose>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء المستخدم'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
