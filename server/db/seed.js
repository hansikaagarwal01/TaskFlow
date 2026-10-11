const { hashPassword } = require('../utils/password');
const db = require('./database');

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

async function seed() {
  console.log('🌱 Starting TaskFlow database seed (Multi-Company SaaS)...');

  const defaultPasswordHash = await hashPassword('password123');

  // 1. Companies
  const companies = [
    {
      id: 'comp-acme',
      name: 'Acme Corp',
      slug: 'acme-corp',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 2. Demo Users
  const users = [
    {
      id: 'u-mgr-1',
      email: 'sarah.jenkins@taskflow.io',
      name: 'Sarah Jenkins',
      passwordHash: defaultPasswordHash,
      role: 'MANAGER',
      teamId: null,
      activeCompanyId: 'comp-acme',
      title: 'Chief Operations Manager',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-ldr-eng',
      email: 'alex.rivera@taskflow.io',
      name: 'Alex Rivera',
      passwordHash: defaultPasswordHash,
      role: 'LEADER',
      teamId: 'team-eng',
      activeCompanyId: 'comp-acme',
      title: 'Engineering Team Lead',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-ldr-prod',
      email: 'maya.lin@taskflow.io',
      name: 'Maya Lin',
      passwordHash: defaultPasswordHash,
      role: 'LEADER',
      teamId: 'team-prod',
      activeCompanyId: 'comp-acme',
      title: 'Head of Product & Design',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-emp-eng1',
      email: 'david.kim@taskflow.io',
      name: 'David Kim',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      teamId: 'team-eng',
      activeCompanyId: 'comp-acme',
      title: 'Full Stack Engineer',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-emp-eng2',
      email: 'elena.rostova@taskflow.io',
      name: 'Elena Rostova',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      teamId: 'team-eng',
      activeCompanyId: 'comp-acme',
      title: 'Backend Systems Engineer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-emp-prod1',
      email: 'marcus.vance@taskflow.io',
      name: 'Marcus Vance',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      teamId: 'team-prod',
      activeCompanyId: 'comp-acme',
      title: 'Senior UI/UX Specialist',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'u-emp-prod2',
      email: 'chloe.dubois@taskflow.io',
      name: 'Chloe Dubois',
      passwordHash: defaultPasswordHash,
      role: 'EMPLOYEE',
      teamId: 'team-prod',
      activeCompanyId: 'comp-acme',
      title: 'Product Researcher',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 3. Workspace Memberships
  const workspaceMembers = users.map(user => ({
    id: `wm-${user.id}-comp-acme`,
    userId: user.id,
    companyId: 'comp-acme',
    role: user.role,
    joinedAt: user.createdAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));

  // 4. Teams
  const teams = [
    {
      id: 'team-eng',
      companyId: 'comp-acme',
      name: 'Engineering Department',
      description: 'Core infrastructure, API development, and frontend application engineering.',
      leaderId: 'u-ldr-eng',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'team-prod',
      companyId: 'comp-acme',
      name: 'Product & Design Ops',
      description: 'User experience research, UI design token system, and product strategy.',
      leaderId: 'u-ldr-prod',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 5. Tasks
  const tasks = [
    {
      id: 'task-101',
      companyId: 'comp-acme',
      title: 'Q4 Security Audit & OAuth2 Integration',
      description: 'Conduct security vulnerability audit on authentication endpoints, implement refresh token rotation, and mandate HTTPS headers.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      approvalStatus: 'NOT_REQUIRED',
      assignedTo: 'u-emp-eng2',
      teamId: 'team-eng',
      createdBy: 'u-mgr-1',
      dueDate: addDays(2),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-102',
      companyId: 'comp-acme',
      title: 'Implement End-to-End Automated Test Suite',
      description: 'Set up Playwright / Cypress integration tests covering critical authentication flows, manager approval triggers, and task status state transitions.',
      priority: 'HIGH',
      status: 'PENDING',
      approvalStatus: 'PENDING_APPROVAL',
      assignedTo: 'u-emp-eng1',
      teamId: 'team-eng',
      createdBy: 'u-ldr-eng',
      dueDate: addDays(4),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-103',
      companyId: 'comp-acme',
      title: 'Design Dark Glassmorphism Design Token System',
      description: 'Create standardized Tailwind CSS color tokens, micro-interaction states, and accessible WCAG AAA compliant contrast presets for the v2.0 dashboard update.',
      priority: 'MEDIUM',
      status: 'PENDING',
      approvalStatus: 'PENDING_APPROVAL',
      assignedTo: 'u-emp-prod1',
      teamId: 'team-prod',
      createdBy: 'u-ldr-prod',
      dueDate: addDays(5),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-104',
      companyId: 'comp-acme',
      title: 'Optimize API Response Latency under 50ms',
      description: 'Profile slow queries on task history endpoints, implement Redis query caching layer, and optimize payload serialization.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      approvalStatus: 'APPROVED',
      assignedTo: 'u-emp-eng2',
      teamId: 'team-eng',
      createdBy: 'u-ldr-eng',
      dueDate: addDays(1),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-105',
      companyId: 'comp-acme',
      title: 'Refactor Legacy Analytics SQL Queries',
      description: 'Refactor aggregated SQL queries into materialized views to prevent database locking during high-volume manager dashboard reads.',
      priority: 'MEDIUM',
      status: 'PENDING',
      approvalStatus: 'REJECTED',
      assignedTo: 'u-emp-eng1',
      teamId: 'team-eng',
      createdBy: 'u-ldr-eng',
      dueDate: addDays(6),
      rejectionReason: 'Scope needs clarification. Please specify whether this will affect real-time activity feed queries or only daily analytics aggregations. Add memory footprint targets.',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-106',
      companyId: 'comp-acme',
      title: 'Conduct Q3 User Experience & Usability Testing',
      description: 'Host 10 qualitative testing sessions with department managers to collect feedback on task creation flow and notification preferences.',
      priority: 'LOW',
      status: 'COMPLETED',
      approvalStatus: 'APPROVED',
      assignedTo: 'u-emp-prod2',
      teamId: 'team-prod',
      createdBy: 'u-ldr-prod',
      dueDate: addDays(-2),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'task-107',
      companyId: 'comp-acme',
      title: 'Database Failover & Automated Backup Strategy',
      description: 'Configure automated hourly database snapshots to S3 bucket with 30-day retention policy and automated disaster recovery drill.',
      priority: 'HIGH',
      status: 'PENDING',
      approvalStatus: 'NOT_REQUIRED',
      assignedTo: 'u-ldr-eng',
      teamId: 'team-eng',
      createdBy: 'u-mgr-1',
      dueDate: addDays(3),
      rejectionReason: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 6. Activity Logs
  const activityLogs = [
    {
      id: 'act-1',
      companyId: 'comp-acme',
      taskId: 'task-101',
      userId: 'u-mgr-1',
      action: 'TASK_CREATED',
      details: 'Created task "Q4 Security Audit & OAuth2 Integration" assigned to Elena Rostova',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'act-2',
      companyId: 'comp-acme',
      taskId: 'task-101',
      userId: 'u-emp-eng2',
      action: 'STATUS_CHANGED',
      details: 'Updated status from PENDING to IN_PROGRESS',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'act-3',
      companyId: 'comp-acme',
      taskId: 'task-102',
      userId: 'u-ldr-eng',
      action: 'SUBMITTED_FOR_APPROVAL',
      details: 'Leader Alex Rivera created task "Implement End-to-End Automated Test Suite" and submitted for Manager approval.',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'act-4',
      companyId: 'comp-acme',
      taskId: 'task-105',
      userId: 'u-mgr-1',
      action: 'REJECTED',
      details: 'Manager Sarah Jenkins rejected task "Refactor Legacy Analytics SQL Queries". Reason: Scope needs clarification...',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'act-5',
      companyId: 'comp-acme',
      taskId: 'task-104',
      userId: 'u-mgr-1',
      action: 'APPROVED',
      details: 'Manager Sarah Jenkins approved task "Optimize API Response Latency under 50ms".',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  // 7. Notifications
  const notifications = [
    {
      id: 'notif-1',
      companyId: 'comp-acme',
      userId: 'u-mgr-1',
      title: 'Task Approval Request',
      message: 'Alex Rivera submitted "Implement End-to-End Automated Test Suite" for your approval.',
      type: 'APPROVAL_REQUEST',
      taskId: 'task-102',
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-2',
      companyId: 'comp-acme',
      userId: 'u-mgr-1',
      title: 'Task Approval Request',
      message: 'Maya Lin submitted "Design Dark Glassmorphism Design Token System" for your approval.',
      type: 'APPROVAL_REQUEST',
      taskId: 'task-103',
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-3',
      companyId: 'comp-acme',
      userId: 'u-ldr-eng',
      title: 'Task Rejection Notice',
      message: 'Sarah Jenkins requested revisions on "Refactor Legacy Analytics SQL Queries". Feedback provided.',
      type: 'TASK_REJECTED',
      taskId: 'task-105',
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'notif-4',
      companyId: 'comp-acme',
      userId: 'u-emp-eng2',
      title: 'Task Assigned',
      message: 'You have been assigned to "Optimize API Response Latency under 50ms". Due in 1 day.',
      type: 'TASK_ASSIGNED',
      taskId: 'task-104',
      isRead: true,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  db.reset({
    companies,
    workspaceMembers,
    invitations: [],
    users,
    teams,
    tasks,
    activityLogs,
    notifications,
    sessions: []
  });

  if (typeof db.ensurePrismaConnected === 'function') {
    const isConnected = await db.ensurePrismaConnected();
    if (isConnected && typeof db.cleanAndSeedPrisma === 'function') {
      await db.cleanAndSeedPrisma({
        companies,
        workspaceMembers,
        invitations: [],
        users,
        teams,
        tasks,
        activityLogs,
        notifications,
        sessions: []
      });
    }
  }

  console.log('✅ TaskFlow database successfully seeded (Multi-Company SaaS)!');
  console.log('Companies created:', companies.length);
  console.log('Users created:', users.length);
  console.log('Teams created:', teams.length);
  console.log('Tasks created:', tasks.length);
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
