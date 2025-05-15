'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, User, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ROLE_DESCRIPTIONS, ROLE_HIERARCHY, UserRole } from '@/types/roles';

interface RoleSelectorProps {
  value: UserRole;
  onValueChange: (value: UserRole) => void;
  disabled?: boolean;
  className?: string;
}

// Map roles to icons
const roleIcons: Record<UserRole, React.ReactNode> = {
  owner: <ShieldAlert className="h-4 w-4 ml-2 text-purple-600" />,
  admin: <ShieldAlert className="h-4 w-4 ml-2" />,
  individual_admin: <ShieldAlert className="h-4 w-4 ml-2 text-blue-600" />,
  engineer: <ShieldCheck className="h-4 w-4 ml-2" />,
  supervisor: <Shield className="h-4 w-4 ml-2" />,
  technician: <ShieldQuestion className="h-4 w-4 ml-2" />,
  assistant: <Shield className="h-4 w-4 ml-2 opacity-70" />,
  user: <User className="h-4 w-4 ml-2" />,
  independent: <UserCog className="h-4 w-4 ml-2" />
};

export function RoleSelector({ value, onValueChange, disabled = false, className }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);

  // Translate role to Arabic
  const getRoleLabel = (role: UserRole): string => {
    switch (role) {
      case 'owner': return 'مالك النظام';
      case 'admin': return 'مسؤول';
      case 'individual_admin': return 'مسؤول نظام الأفراد';
      case 'engineer': return 'مهندس';
      case 'supervisor': return 'مشرف';
      case 'technician': return 'فني';
      case 'assistant': return 'مساعد فني';
      case 'user': return 'مستخدم';
      case 'independent': return 'مستخدم مستقل';
      default: return role;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <div className="flex items-center">
            {roleIcons[value]}
            <span>{getRoleLabel(value)}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="space-y-1">
          {ROLE_HIERARCHY.map((role) => (
            <div
              key={role}
              className={cn(
                "flex items-center px-2 py-1.5 text-sm rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                value === role ? "bg-accent text-accent-foreground" : ""
              )}
              onClick={() => {
                onValueChange(role as UserRole);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "ml-2 h-4 w-4",
                  value === role ? "opacity-100" : "opacity-0"
                )}
              />
              {roleIcons[role as UserRole]}
              <span className="ml-1">{getRoleLabel(role as UserRole)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
