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

if (prisma && typeof prisma.$connect === 'function') {
  prisma.$connect().then(() => {
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
      }
    } catch (err) {}
  }
}

const db = new PrismaIntegratedDatabase();
module.exports = db;
