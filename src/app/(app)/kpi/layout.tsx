
import type { ReactNode } from 'react';

// This layout ensures the KPI page uses the main app layout defined in (app)/layout.tsx
export default function KpiLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
