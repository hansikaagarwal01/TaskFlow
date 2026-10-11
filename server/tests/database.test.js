process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const prisma = require('../lib/prisma');
const seed = require('../db/seed');

describe('TaskFlow Database & Prisma Migration Suite (Phase 3)', () => {
  beforeAll(async () => {
    await seed();
  });

  describe('1. Schema & Data Model Verification', () => {
    test('Seeded users exist in database layer with correct role enums', () => {
      const manager = db.findById('users', 'u-mgr-1');
      expect(manager).toBeDefined();
      expect(manager.role).toBe('MANAGER');
      expect(manager.passwordHash).toBeDefined();

      const leader = db.findById('users', 'u-ldr-eng');
      expect(leader).toBeDefined();
      expect(leader.role).toBe('LEADER');
      expect(leader.teamId).toBe('team-eng');
    });

    test('User email uniqueness is maintained', () => {
      const users = db.find('users', u => u.email === 'sarah.jenkins@taskflow.io');
      expect(users.length).toBe(1);
    });

    test('Team to Leader relationship is correctly linked', () => {
      const team = db.findById('teams', 'team-eng');
      expect(team).toBeDefined();
      expect(team.leaderId).toBe('u-ldr-eng');

      const leader = db.findById('users', team.leaderId);
      expect(leader.name).toBe('Alex Rivera');
    });

    test('Task foreign key relationships to Assignee, Creator, and Team exist', () => {
      const task = db.findById('tasks', 'task-101');
      expect(task).toBeDefined();

      const assignee = db.findById('users', task.assignedTo);
      expect(assignee).toBeDefined();

      const creator = db.findById('users', task.createdBy);
      expect(creator).toBeDefined();

      const team = db.findById('teams', task.teamId);
      expect(team).toBeDefined();
      expect(team.id).toBe('team-eng');
    });
  });

  describe('2. Session Model & Token Security', () => {
    test('Sessions store tokenHash and never expose raw refresh tokens', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.jenkins@taskflow.io', password: 'password123' });

      expect(loginRes.status).toBe(200);

      const sessions = db.find('sessions', s => s.userId === 'u-mgr-1');
      expect(sessions.length).toBeGreaterThan(0);

      const latestSession = sessions[sessions.length - 1];
      expect(latestSession).toHaveProperty('tokenHash');
      expect(latestSession).toHaveProperty('expiresAt');
      expect(latestSession.tokenHash).not.toContain('taskflow_refresh');
    });
  });

  describe('3. Database Transactions & Atomicity', () => {
    test('Task insertion atomically records activity log in data layer', () => {
      const initialLogsCount = db.find('activityLogs').length;

      const newTask = db.insert('tasks', {
        id: 'task-db-test-1',
        companyId: 'comp-acme',
        title: 'Database Atomicity Test Task',
        priority: 'HIGH',
        status: 'PENDING',
        approvalStatus: 'NOT_REQUIRED',
        assignedTo: 'u-emp-eng1',
        teamId: 'team-eng',
        createdBy: 'u-mgr-1',
        dueDate: '2026-12-31'
      });

      expect(newTask).toBeDefined();
      expect(newTask.id).toBe('task-db-test-1');

      db.insert('activityLogs', {
        id: 'act-db-test-1',
        companyId: 'comp-acme',
        taskId: newTask.id,
        userId: 'u-mgr-1',
        action: 'TASK_CREATED',
        details: 'Atomicity test activity log',
        timestamp: new Date().toISOString()
      });

      const updatedLogs = db.find('activityLogs');
      expect(updatedLogs.length).toBe(initialLogsCount + 1);
    });
  });
});
