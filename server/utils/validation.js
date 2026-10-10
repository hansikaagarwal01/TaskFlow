const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address format').max(255),
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long')
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100, 'Full name is too long'),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters long').max(128, 'Password is too long'),
  companyName: z.string().trim().max(100).optional(),
  invitationToken: z.string().trim().optional()
});

const demoLoginSchema = z.object({
  userId: z.string().min(1, 'userId is required')
});

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().trim().max(2000, 'Description is too long').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH'], { errorMap: () => ({ message: 'Priority must be LOW, MEDIUM, or HIGH' }) }),
  assignedTo: z.string().min(1, 'Assigned user ID is required'),
  teamId: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required')
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED'], { errorMap: () => ({ message: 'Status must be PENDING, IN_PROGRESS, or COMPLETED' }) })
});

const rejectTaskSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'A valid rejection reason must be provided').max(1000)
});

function validateRequest(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues || result.error.errors || [];
      const errorMessages = issues.map(e => e.message).join(', ');
      return res.status(400).json({ error: 'Invalid input data', details: errorMessages });
    }
    req.validatedBody = result.data;
    next();
  };
}

function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const timestamp = Date.parse(dateStr);
  return !isNaN(timestamp);
}

function isPastDate(dateStr) {
  if (!isValidDateString(dateStr)) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  const inputDateStr = new Date(dateStr).toISOString().split('T')[0];
  return inputDateStr < todayStr;
}

module.exports = {
  loginSchema,
  registerSchema,
  demoLoginSchema,
  createTaskSchema,
  updateStatusSchema,
  rejectTaskSchema,
  validateRequest,
  isValidDateString,
  isPastDate
};
