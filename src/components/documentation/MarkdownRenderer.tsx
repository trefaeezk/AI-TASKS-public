import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({ content }) => {
  // التعامل مع المحتوى الفارغ
  if (!content || content.trim() === '') {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>لا يوجد محتوى للعرض.</p>
      </div>
    );
  }

  return (
    <div className="markdown-content prose prose-sm md:prose-base lg:prose-lg dark:prose-invert max-w-none" dir="rtl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4 border-b pb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-4 mb-2" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-lg font-bold mt-3 mb-2" {...props} />,
          h5: ({ node, ...props }) => <h5 className="text-base font-bold mt-2 mb-1" {...props} />,
          h6: ({ node, ...props }) => <h6 className="text-sm font-bold mt-2 mb-1" {...props} />,
          p: ({ node, ...props }) => <p className="my-3 leading-relaxed" {...props} />,
          a: ({ node, ...props }) => <a className="text-primary hover:underline" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside my-4 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-4 space-y-1" {...props} />,
          li: ({ node, ...props }) => <li className="my-1" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-r-4 border-primary pr-4 italic my-4" {...props} />
          ),
          img: ({ node, alt, src, ...props }) => {
            if (src?.startsWith('./images/')) {
              // تحويل المسار النسبي إلى مسار مطلق
              const absolutePath = src.replace('./images/', '/docs/debug/images/');
              return (
                <div className="my-4">
                  <img
                    src={absolutePath}
                    alt={alt || ''}
                    className="rounded-md max-w-full h-auto"
                    {...props}
                  />
                  {alt && <p className="text-center text-sm text-muted-foreground mt-1">{alt}</p>}
                </div>
              );
            }
            return (
              <div className="my-4">
                <img
                  src={src || ''}
                  alt={alt || ''}
                  className="rounded-md max-w-full h-auto"
                  {...props}
                />
                {alt && <p className="text-center text-sm text-muted-foreground mt-1">{alt}</p>}
              </div>
            );
          },
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="my-4 overflow-auto">
                <pre className="p-4 rounded-md bg-muted">
                  <code className={`language-${match[1]} font-mono text-sm`} {...props}>
                    {String(children).replace(/\n$/, '')}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-muted px-1.5 py-0.5 rounded-sm font-mono text-sm" {...props}>
                {children}
              </code>
            );
          },
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <Table {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <TableHeader {...props} />,
          tbody: ({ node, ...props }) => <TableBody {...props} />,
          tr: ({ node, ...props }) => <TableRow {...props} />,
          th: ({ node, ...props }) => <TableHead className="text-right" {...props} />,
          td: ({ node, ...props }) => <TableCell {...props} />,
          hr: ({ node, ...props }) => <hr className="my-6 border-t border-border" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownRenderer;
