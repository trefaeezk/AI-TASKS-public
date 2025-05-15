// src/components/auth/AuthFormWrapper.tsx
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface AuthFormWrapperProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode; // Optional footer content (e.g., links)
}

export function AuthFormWrapper({ title, description, children, footer }: AuthFormWrapperProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-100 via-white to-violet-100 dark:from-gray-900 dark:via-black dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl border-border bg-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">{title}</CardTitle>
          {description && <CardDescription className="text-muted-foreground">{description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
        </CardContent>
        {footer && (
           <div className="p-6 pt-0 text-center text-sm text-muted-foreground">
                {footer}
           </div>
        )}
      </Card>
    </div>
  );
}
