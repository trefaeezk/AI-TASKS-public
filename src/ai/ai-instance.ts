/**
 * ملف انتقالي لتوفير واجهة متوافقة مع الملفات القديمة
 *
 * هذا الملف يحل محل الملف القديم الذي كان يستخدم مكتبة genkit
 * ويوفر واجهة متوافقة للملفات القديمة التي لم يتم تحديثها بعد
 */

// كائن وهمي يحاكي واجهة genkit
export const z = {
  object: () => ({
    describe: () => ({}),
  }),
  string: () => ({
    describe: () => ({
      optional: () => ({}),
    }),
  }),
  number: () => ({
    describe: () => ({
      optional: () => ({}),
    }),
  }),
  boolean: () => ({
    describe: () => ({
      optional: () => ({}),
    }),
  }),
  array: (schema: any) => ({
    describe: () => ({}),
  }),
  enum: (values: string[]) => ({
    describe: () => ({
      optional: () => ({}),
    }),
  }),
  union: (schemas: any[]) => ({
    describe: () => ({}),
  }),
  literal: (value: any) => ({
    describe: () => ({}),
  }),
};

// كائن وهمي يحاكي واجهة genkit AI
export const ai = {
  definePrompt: (config: any) => {
    return async (input: any) => {
      console.warn('Using deprecated AI flow. Please update to use the new AI service.');
      return { output: {} };
    };
  },
  defineFlow: (config: any, handler: any) => {
    return async (input: any) => {
      console.warn('Using deprecated AI flow. Please update to use the new AI service.');
      return {};
    };
  },
};
