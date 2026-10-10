const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

async function migrateJsonToPostgres() {
  const jsonPath = path.join(__dirname, 'data.json');
  if (!fs.existsSync(jsonPath)) {
    console.log('ℹ️ No data.json found to migrate.');
    return;
  }

  console.log('🔄 Starting JSON to PostgreSQL migration via Prisma...');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  const users = data.users || [];
  const teams = data.teams || [];
  const tasks = data.tasks || [];
  const activityLogs = data.activityLogs || [];
  const notifications = data.notifications || [];
  const sessions = data.sessions || [];

  try {
    // 1. Clean existing PostgreSQL data safely
    await prisma.notification.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.task.deleteMany();
    await prisma.user.updateMany({ data: { teamId: null } });
    await prisma.team.deleteMany();
    await prisma.user.deleteMany();

    // 2. Migrate Users (First pass without teamId to avoid circular FK checks)
    for (const u of users) {
      await prisma.user.create({
        data: {
          id: u.id,
          email: u.email.toLowerCase(),
          name: u.name,
          passwordHash: u.passwordHash,
          role: u.role,
          title: u.title || null,
          avatar: u.avatar || null,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
          updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
        }
      });
    }

    // 3. Migrate Teams
    for (const t of teams) {
      await prisma.team.create({
        data: {
          id: t.id,
          name: t.name,
          description: t.description || null,
          leaderId: t.leaderId || null,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
        }
      });
    }

    // 4. Update Users with teamId
    for (const u of users) {
      if (u.teamId) {
        await prisma.user.update({
          where: { id: u.id },
          data: { teamId: u.teamId }
        });
      }
    }

    // 5. Migrate Tasks
    for (const t of tasks) {
      await prisma.task.create({
        data: {
          id: t.id,
          title: t.title,
          description: t.description || null,
          priority: t.priority,
          status: t.status,
          approvalStatus: t.approvalStatus,
          assignedTo: t.assignedTo,
          teamId: t.teamId,
          createdBy: t.createdBy,
          dueDate: t.dueDate,
          rejectionReason: t.rejectionReason || null,
          createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
        }
      });
    }

    // 6. Migrate Sessions
    for (const s of sessions) {
      await prisma.session.create({
        data: {
          id: s.id,
          userId: s.userId,
          tokenHash: s.tokenHash,
          expiresAt: new Date(s.expiresAt),
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          lastUsedAt: s.lastUsedAt ? new Date(s.lastUsedAt) : new Date(),
          revokedAt: s.revokedAt ? new Date(s.revokedAt) : null,
          ipAddress: s.ipAddress || null,
          userAgent: s.userAgent || null
        }
      });
    }

    // 7. Migrate Activity Logs
    for (const a of activityLogs) {
      await prisma.activityLog.create({
        data: {
          id: a.id,
          taskId: a.taskId || null,
          userId: a.userId,
          action: a.action,
          details: a.details || null,
          timestamp: a.timestamp ? new Date(a.timestamp) : new Date()
        }
      });
    }

    // 8. Migrate Notifications
    for (const n of notifications) {
      await prisma.notification.create({
        data: {
          id: n.id,
          userId: n.userId,
          title: n.title,
          message: n.message,
          type: n.type,
          taskId: n.taskId || null,
          isRead: n.isRead || false,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date()
        }
      });
    }

    console.log(`✅ Successfully migrated JSON data to PostgreSQL:
    - ${users.length} Users
    - ${teams.length} Teams
    - ${tasks.length} Tasks
    - ${sessions.length} Active Sessions
    - ${activityLogs.length} Activity Logs
    - ${notifications.length} Notifications`);
  } catch (err) {
    console.error('❌ Data migration failed:', err);
    throw err;
  }
}

if (require.main === module) {
  migrateJsonToPostgres().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = migrateJsonToPostgres;
