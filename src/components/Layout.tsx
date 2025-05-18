import React, { ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title = 'نظام إدارة المهام',
  description = 'نظام متكامل لإدارة المهام والمشاريع',
}) => {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto py-4">
        {children}
      </main>
    </div>
  );
};

export default Layout;
