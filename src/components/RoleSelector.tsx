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
import { useLanguage } from '@/context/LanguageContext';

interface RoleSelectorProps {
  value: UserRole;
  onValueChange: (value: UserRole) => void;
  disabled?: boolean;
  className?: string;
}

// Map roles to icons - النظام الجديد (النمط is* فقط)
const roleIcons: Record<UserRole, React.ReactNode> = {
  // أدوار النظام العامة
  isSystemOwner: <ShieldAlert className="h-4 w-4 ml-2 text-purple-600" />,
  isSystemAdmin: <ShieldAlert className="h-4 w-4 ml-2 text-blue-600" />,
  isIndependent: <UserCog className="h-4 w-4 ml-2" />,

  // أدوار المؤسسات
  isOrgOwner: <ShieldAlert className="h-4 w-4 ml-2 text-orange-600" />,
  isOrgAdmin: <ShieldAlert className="h-4 w-4 ml-2" />,
  isOrgSupervisor: <Shield className="h-4 w-4 ml-2" />,
  isOrgEngineer: <ShieldCheck className="h-4 w-4 ml-2" />,
  isOrgTechnician: <ShieldQuestion className="h-4 w-4 ml-2" />,
  isOrgAssistant: <Shield className="h-4 w-4 ml-2 opacity-70" />
};

export function RoleSelector({ value, onValueChange, disabled = false, className }: RoleSelectorProps) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  // Translate role using translation keys
  const getRoleLabel = (role: UserRole): string => {
    return t(`roles.${role}`, role);
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
