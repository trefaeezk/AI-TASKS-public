import React from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import Layout from '@/components/Layout';
import DocumentationPage from '@/components/documentation/DocumentationPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const Documentation: NextPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // التحقق من تسجيل الدخول
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/documentation');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head>
        <title>الوثائق - نظام إدارة المهام</title>
        <meta name="description" content="وثائق نظام إدارة المهام" />
      </Head>
      <DocumentationPage />
    </Layout>
  );
};

export default Documentation;
