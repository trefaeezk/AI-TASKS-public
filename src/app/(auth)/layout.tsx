// src/app/(auth)/layout.tsx
import type { ReactNode } from 'react';

// This layout applies only to routes within the (auth) group
// It ensures these pages don't inherit the main app layout (if it exists)
// and provides a clean slate for login/signup/reset forms.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    // Minimal layout wrapper, can be customized further if needed
    // e.g., adding specific headers/footers for auth pages
    <div>
      {children}
    </div>
  );
}
