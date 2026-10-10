const fs = require('fs');
const path = require('path');
const db = require('./database');

const DB_FILE = path.join(__dirname, 'data.json');
const BACKUP_FILE = path.join(__dirname, 'data.json.bak');

/**
 * Migration Script: Safely converts single-tenant schema data into multi-tenant structure.
 */
function migrate() {
  console.log('🔄 Starting TaskFlow Multi-Tenant Migration...');

  // Create a backup before modifying
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, BACKUP_FILE);
    console.log(`📦 Backup created at ${BACKUP_FILE}`);
  }

  const defaultCompany = {
    id: 'comp-acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const companies = db.find('companies');
  if (!companies.some(c => c.id === 'comp-acme')) {
    db.insert('companies', defaultCompany);
  }

  const users = db.find('users');
  users.forEach(user => {
    const activeCompanyId = user.activeCompanyId || 'comp-acme';
    db.update('users', user.id, { activeCompanyId });

    const existingMember = db.findOne('workspaceMembers', m => m.userId === user.id && m.companyId === activeCompanyId);
    if (!existingMember) {
      db.insert('workspaceMembers', {
        id: `wm-${user.id}-${activeCompanyId}`,
        userId: user.id,
        companyId: activeCompanyId,
        role: user.role || 'EMPLOYEE',
        joinedAt: user.createdAt || new Date().toISOString()
      });
    }
  });

  const teams = db.find('teams');
  teams.forEach(team => {
    if (!team.companyId) {
      db.update('teams', team.id, { companyId: 'comp-acme' });
    }
  });

  const tasks = db.find('tasks');
  tasks.forEach(task => {
    if (!task.companyId) {
      db.update('tasks', task.id, { companyId: 'comp-acme' });
    }
  });

  const logs = db.find('activityLogs');
  logs.forEach(log => {
    if (!log.companyId) {
      db.update('activityLogs', log.id, { companyId: 'comp-acme' });
    }
  });

  const notifications = db.find('notifications');
  notifications.forEach(n => {
    if (!n.companyId) {
      db.update('notifications', n.id, { companyId: 'comp-acme' });
    }
  });

  console.log('✅ Multi-Tenant Migration Completed Successfully!');
}

/**
 * Rollback Script: Restores data.json from backup if migration fails or issues arise.
 */
function rollback() {
  console.log('⚠️ Restoring TaskFlow database from backup...');
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, DB_FILE);
    db.init();
    console.log('✅ Rollback successful. Database state restored.');
  } else {
    console.error('❌ No backup file found to perform rollback.');
  }
}

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--rollback') {
    rollback();
  } else {
    migrate();
  }
}

module.exports = { migrate, rollback };
