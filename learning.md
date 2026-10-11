# TaskFlow — Learning Log

This file contains concepts, architecture, and implementation details
that I will understand after the complete TaskFlow application is built.

The development approach is:

Build → Test → Finish → Understand → Debug → Modify

---

# 1. System Architecture

Things to understand:

- React + Vite architecture
- Frontend/backend separation
- REST API architecture
- Request/response lifecycle
- Express application structure
- Routes
- Controllers
- Services
- Middleware
- Database layer
- Environment variables
- Frontend API communication

---

# 2. Authentication

Things to understand:

- Authentication vs authorization
- Password hashing
- Argon2id
- JWT
- Access tokens
- Refresh tokens
- HttpOnly cookies
- Secure cookies
- SameSite cookies
- Token expiration
- Refresh token rotation
- Session management
- Logout
- Logout from all devices
- Password reset
- Email verification

---

# 3. Authorization & RBAC

Things to understand:

- Role-Based Access Control
- Manager permissions
- Leader permissions
- Employee permissions
- Resource-level authorization
- Object-level authorization
- Team-level authorization
- Why frontend authorization is not enough
- How backend authorization works

---

# 4. Database

Things to understand:

- PostgreSQL
- Prisma
- Database schema
- Primary keys
- Foreign keys
- Relationships
- One-to-many relationships
- Many-to-many relationships
- Indexes
- Transactions
- Database migrations
- Connection pooling

Entities:

- User
- Team
- Task
- TaskDependency
- Session
- Activity
- Notification

---

# 5. Backend

Things to understand:

- Node.js
- Express
- REST APIs
- HTTP methods
- Status codes
- Request
- Response
- Middleware
- Controllers
- Services
- Error handling
- Validation
- Zod
- Async/await

---

# 6. Task Workflow

Things to understand:

Task lifecycle:

PENDING
→ IN_PROGRESS
→ COMPLETED

Approval lifecycle:

PENDING_APPROVAL
→ APPROVED

or:

PENDING_APPROVAL
→ REJECTED
→ RESUBMITTED
→ PENDING_APPROVAL

Things to understand:

- Business rules
- State transitions
- Approval workflow
- Task dependencies
- Rejected task workflow
- Task reassignment

---

# 7. Frontend

Things to understand:

- React components
- Props
- State
- Context
- Hooks
- React Router
- Protected routes
- API client
- Authentication state
- Loading states
- Error states
- Forms
- Responsive layouts
- Tailwind CSS
- Lucide React
- Recharts

---

# 8. Security

Things to understand:

- HTTPS
- CORS
- CSRF
- XSS
- SQL injection
- Rate limiting
- Helmet
- Input validation
- Secure cookies
- Secret management
- Password security
- API security
- Object-level authorization
- Secure error handling

---


# 9. Testing

Things to understand:

- Unit testing
- Integration testing
- API testing
- Authentication testing
- Authorization testing
- End-to-end testing
- Playwright
- Vitest
- Supertest

Important security tests:

- Unauthorized request
- Wrong role
- Wrong task owner
- Wrong team
- Expired token
- Invalid token
- Revoked session
- Refresh token reuse

---

# 11. Production

Things to understand:

- Environment variables
- Docker
- CI/CD
- GitHub Actions
- HTTPS
- Cloud deployment
- Database backups
- Logging
- Monitoring
- Error tracking
- Health checks
- Performance
- Rate limiting

---

# 12. Debugging

Things to understand:

When something breaks, trace:

Frontend
↓
API request
↓
Route
↓
Middleware
↓
Controller
↓
Service
↓
Database
↓
Response
↓
Frontend

Learn how to use:

- Browser DevTools
- Network tab
- Console
- Backend logs
- Postman/Thunder Client
- Database inspection
- Git
- Stack traces

---

# 13. Features I Want To Be Able To Modify Myself

After understanding the project, I should be able to:

- Add a new role
- Add a new API endpoint
- Add a new database entity
- Add a new relationship
- Add a new page
- Add a new permission
- Modify task workflow
- Add notifications
- Add task comments
- Add file attachments
- Modify dashboard analytics
- Find and fix bugs
- Find authorization vulnerabilities

---

# 13. Questions To Answer After Building

- How does a login request travel through the system?
- How does the backend know who the user is?
- How does JWT work?
- Why do we need refresh tokens?
- Why are refresh tokens stored in HttpOnly cookies?
- How does RBAC work?
- How does the backend prevent an employee from accessing another employee's task?
- How does a task move from pending to completed?
- How does manager approval work?
- How does React communicate with Express?
- How does Express communicate with PostgreSQL?
- Why do we need Prisma?
- How do database transactions work?
- How would I debug a failed API request?
- How would I deploy TaskFlow?

---

# Final Goal

By the end of the project, I should be able to:

1. Explain the complete TaskFlow architecture.
2. Trace a request from frontend to database.
3. Understand the authentication system.
4. Understand the authorization system.
5. Understand the database schema.
6. Debug backend and frontend problems.
7. Modify existing features.
8. Add new features.
9. Identify common security vulnerabilities.
10. Deploy and maintain the application.

I do NOT need to memorize the code.

I need to understand:

WHAT it does
WHY it exists
HOW the pieces communicate
HOW to debug it
HOW to modify it

