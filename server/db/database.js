const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const DB_FILE = path.join(__dirname, 'data.json');

const defaultData = {
  companies: [],
  workspaceMembers: [],
  invitations: [],
  users: [],
  teams: [],
  tasks: [],
  activityLogs: [],
  notifications: [],
  sessions: []
};

let isPrismaConnected = false;
let prismaConnectPromise = null;

if (prisma && typeof prisma.$connect === 'function') {
  prismaConnectPromise = prisma.$connect().then(() => {
    isPrismaConnected = true;
    console.log('PostgreSQL connected via Prisma ORM!');
  }).catch(() => {
    isPrismaConnected = false;
  });
}

class PrismaIntegratedDatabase {
  constructor() {
    this.filePath = DB_FILE;
    this.data = { ...defaultData };
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
        
        if (!this.data.companies) this.data.companies = [];
        if (!this.data.workspaceMembers) this.data.workspaceMembers = [];
        if (!this.data.invitations) this.data.invitations = [];
        if (!this.data.sessions) this.data.sessions = [];
        if (!this.data.users) this.data.users = [];
        if (!this.data.teams) this.data.teams = [];
        if (!this.data.tasks) this.data.tasks = [];
        if (!this.data.activityLogs) this.data.activityLogs = [];
        if (!this.data.notifications) this.data.notifications = [];

        this.migrateLegacyDataIfNeeded();
      } else {
        this.data = { ...defaultData };
        this.save();
      }
    } catch (err) {
      this.data = { ...defaultData };
    }
  }

  migrateLegacyDataIfNeeded() {
    if (this.data.companies.length === 0 && (this.data.users.length > 0 || this.data.teams.length > 0)) {
      const defaultCompany = {
        id: 'comp-acme',
        name: 'Acme Corp',
        slug: 'acme-corp',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.data.companies.push(defaultCompany);

      this.data.users.forEach(user => {
        user.activeCompanyId = user.activeCompanyId || 'comp-acme';
        const exists = this.data.workspaceMembers.some(m => m.userId === user.id && m.companyId === 'comp-acme');
        if (!exists) {
          this.data.workspaceMembers.push({
            id: `wm-${user.id}-comp-acme`,
            userId: user.id,
            companyId: 'comp-acme',
            role: user.role || 'EMPLOYEE',
            joinedAt: user.createdAt || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      });

      this.data.teams.forEach(team => {
        team.companyId = team.companyId || 'comp-acme';
      });

      this.data.tasks.forEach(task => {
        task.companyId = task.companyId || 'comp-acme';
      });

      this.data.activityLogs.forEach(log => {
        log.companyId = log.companyId || 'comp-acme';
      });

      this.data.notifications.forEach(n => {
        n.companyId = n.companyId || 'comp-acme';
      });

      this.save();
    }
  }

  save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      // Non-fatal
    }
  }

  getCollection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }
    return this.data[name];
  }

  find(collectionName, predicate = () => true) {
    const items = this.getCollection(collectionName);
    return items.filter(predicate);
  }

  findOne(collectionName, predicate) {
    const items = this.getCollection(collectionName);
    return items.find(predicate) || null;
  }

  findById(collectionName, id) {
    return this.findOne(collectionName, item => item.id === id);
  }

  insert(collectionName, item) {
    const collection = this.getCollection(collectionName);
    const newItem = {
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
    collection.push(newItem);
    this.save();

    if (isPrismaConnected) {
      this.syncInsertToPrisma(collectionName, newItem).catch(() => {});
    }

    return newItem;
  }

  update(collectionName, id, updates) {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return null;

    const updatedItem = {
      ...collection[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    collection[index] = updatedItem;
    this.save();

    if (isPrismaConnected) {
      this.syncUpdateToPrisma(collectionName, id, updates).catch(() => {});
    }

    return updatedItem;
  }

  delete(collectionName, id) {
    const collection = this.getCollection(collectionName);
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return false;

    collection.splice(index, 1);
    this.save();

    if (isPrismaConnected) {
      this.syncDeleteToPrisma(collectionName, id).catch(() => {});
    }

    return true;
  }

  reset(data) {
    this.data = data ? JSON.parse(JSON.stringify(data)) : { ...defaultData };
    this.save();
  }

  async ensurePrismaConnected() {
    if (prismaConnectPromise) {
      await prismaConnectPromise;
    }
    return isPrismaConnected;
  }

  isPrismaAvailable() {
    return isPrismaConnected;
  }

  async cleanAndSeedPrisma(seedData) {
    if (!isPrismaConnected || !prisma) return;
    try {
      // 1. Delete existing records in reverse foreign key dependency order
      await prisma.notification.deleteMany();
      await prisma.activityLog.deleteMany();
      await prisma.session.deleteMany();
      await prisma.task.deleteMany();
      await prisma.invitation.deleteMany();
      await prisma.workspaceMember.deleteMany();
      await prisma.user.updateMany({ data: { teamId: null } });
      await prisma.team.updateMany({ data: { leaderId: null } });
      await prisma.team.deleteMany();
      await prisma.user.deleteMany();
      await prisma.company.deleteMany();

      // 2. Insert Companies
      for (const c of (seedData.companies || [])) {
        await prisma.company.create({
          data: {
            id: c.id,
            name: c.name,
            slug: c.slug,
            createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date()
          }
        });
      }

      // 3. Insert Users (teamId set to null initially)
      for (const u of (seedData.users || [])) {
        await prisma.user.create({
          data: {
            id: u.id,
            email: u.email.toLowerCase(),
            name: u.name,
            passwordHash: u.passwordHash,
            role: u.role,
            teamId: null,
            activeCompanyId: u.activeCompanyId || null,
            title: u.title || null,
            avatar: u.avatar || null,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date()
          }
        });
      }

      // 4. Insert Teams (leaderId references existing User)
      for (const t of (seedData.teams || [])) {
        await prisma.team.create({
          data: {
            id: t.id,
            companyId: t.companyId,
            name: t.name,
            description: t.description || null,
            leaderId: t.leaderId || null,
            createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            updatedAt: t.updatedAt ? new Date(t.updatedAt) : new Date()
          }
        });
      }

      // 5. Update Users with teamId
      for (const u of (seedData.users || [])) {
        if (u.teamId) {
          await prisma.user.update({
            where: { id: u.id },
            data: { teamId: u.teamId }
          });
        }
      }

      // 6. Insert Workspace Members (references User and Company)
      for (const m of (seedData.workspaceMembers || [])) {
        await prisma.workspaceMember.create({
          data: {
            id: m.id,
            userId: m.userId,
            companyId: m.companyId,
            role: m.role || 'EMPLOYEE',
            joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
            createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date()
          }
        });
      }

      // 7. Insert Tasks (references Company, Assignee, Creator, Team)
      for (const t of (seedData.tasks || [])) {
        await prisma.task.create({
          data: {
            id: t.id,
            companyId: t.companyId,
            title: t.title,
            description: t.description || null,
            priority: t.priority || 'MEDIUM',
            status: t.status || 'PENDING',
            approvalStatus: t.approvalStatus || 'NOT_REQUIRED',
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

      // 8. Insert Activity Logs (references Company, User, Task)
      for (const a of (seedData.activityLogs || [])) {
        await prisma.activityLog.create({
          data: {
            id: a.id,
            companyId: a.companyId || null,
            taskId: a.taskId || null,
            userId: a.userId,
            action: a.action,
            details: a.details || null,
            timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            updatedAt: a.updatedAt ? new Date(a.updatedAt) : new Date()
          }
        });
      }

      // 9. Insert Notifications (references Company, User, Task)
      for (const n of (seedData.notifications || [])) {
        await prisma.notification.create({
          data: {
            id: n.id,
            companyId: n.companyId || null,
            userId: n.userId,
            title: n.title,
            message: n.message,
            type: n.type,
            taskId: n.taskId || null,
            isRead: n.isRead || false,
            createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
            updatedAt: n.updatedAt ? new Date(n.updatedAt) : new Date()
          }
        });
      }
    } catch (err) {}
  }

  async syncInsertToPrisma(collection, item) {
    if (!isPrismaConnected) return;
    try {
      if (collection === 'companies') {
        await prisma.company.create({ data: item });
      } else if (collection === 'workspaceMembers') {
        await prisma.workspaceMember.create({ data: item });
      } else if (collection === 'invitations') {
        await prisma.invitation.create({ data: item });
      } else if (collection === 'users') {
        await prisma.user.create({ data: item });
      } else if (collection === 'teams') {
        await prisma.team.create({ data: item });
      } else if (collection === 'tasks') {
        await prisma.task.create({ data: item });
      } else if (collection === 'sessions') {
        await prisma.session.create({ data: { ...item, expiresAt: new Date(item.expiresAt) } });
      } else if (collection === 'activityLogs') {
        await prisma.activityLog.create({ data: item });
      } else if (collection === 'notifications') {
        await prisma.notification.create({ data: item });
      }
    } catch (err) {}
  }

  async syncUpdateToPrisma(collection, id, updates) {
    if (!isPrismaConnected) return;
    try {
      if (collection === 'companies') {
        await prisma.company.update({ where: { id }, data: updates });
      } else if (collection === 'workspaceMembers') {
        await prisma.workspaceMember.update({ where: { id }, data: updates });
      } else if (collection === 'invitations') {
        await prisma.invitation.update({ where: { id }, data: updates });
      } else if (collection === 'users') {
        await prisma.user.update({ where: { id }, data: updates });
      } else if (collection === 'teams') {
        await prisma.team.update({ where: { id }, data: updates });
      } else if (collection === 'tasks') {
        await prisma.task.update({ where: { id }, data: updates });
      } else if (collection === 'sessions') {
        await prisma.session.update({ where: { id }, data: updates });
      } else if (collection === 'notifications') {
        await prisma.notification.update({ where: { id }, data: updates });
      }
    } catch (err) {}
  }

  async syncDeleteToPrisma(collection, id) {
    if (!isPrismaConnected) return;
    try {
      if (collection === 'companies') {
        await prisma.company.delete({ where: { id } });
      } else if (collection === 'workspaceMembers') {
        await prisma.workspaceMember.delete({ where: { id } });
      } else if (collection === 'invitations') {
        await prisma.invitation.delete({ where: { id } });
      } else if (collection === 'users') {
        await prisma.user.delete({ where: { id } });
      } else if (collection === 'teams') {
        await prisma.team.delete({ where: { id } });
      } else if (collection === 'tasks') {
        await prisma.task.delete({ where: { id } });
      } else if (collection === 'sessions') {
        await prisma.session.delete({ where: { id } });
      } else if (collection === 'notifications') {
        await prisma.notification.delete({ where: { id } });
      } else if (collection === 'activityLogs') {
        await prisma.activityLog.delete({ where: { id } });
      }
    } catch (err) {}
  }
}

const db = new PrismaIntegratedDatabase();
module.exports = db;
