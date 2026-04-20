import { z } from 'zod';

export const projectFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: 'Judul inisiatif wajib diisi' })
    .max(200, { message: 'Judul maksimal 200 karakter' }),
  description: z
    .string()
    .trim()
    .min(1, { message: 'Deskripsi wajib diisi' })
    .max(5000, { message: 'Deskripsi maksimal 5000 karakter' }),
  unit: z
    .string()
    .trim()
    .max(100, { message: 'Unit/Divisi maksimal 100 karakter' })
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z
    .string()
    .min(1, { message: 'Tanggal mulai wajib diisi' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal tidak valid' }),
  end_date: z
    .string()
    .min(1, { message: 'Tanggal selesai wajib diisi' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggal tidak valid' }),
}).refine(
  (data) => {
    if (data.start_date && data.end_date) {
      return data.start_date <= data.end_date;
    }
    return true;
  },
  {
    message: 'Tanggal selesai harus setelah atau sama dengan tanggal mulai',
    path: ['end_date'],
  }
);

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export function validateProjectForm(data: unknown): { 
  success: boolean; 
  data?: ProjectFormData; 
  errors?: Record<string, string>;
} {
  const result = projectFormSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const field = err.path[0] as string;
    if (!errors[field]) {
      errors[field] = err.message;
    }
  });
  
  return { success: false, errors };
}
