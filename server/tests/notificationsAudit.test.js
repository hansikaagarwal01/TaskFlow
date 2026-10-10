process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const seed = require('../db/seed');

describe('TaskFlow Phase 5 — Notifications + Audit System Hardening Test Suite', () => {
  let managerToken;
  let leaderEngToken;
  let leaderProdToken;
  let empEng1Token;
  let empEng2Token;
  let empProd1Token;

  beforeEach(async () => {
    await seed();

    const mgrRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.jenkins@taskflow.io', password: 'password123' });
    managerToken = mgrRes.body.accessToken;

    const ldrEngRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex.rivera@taskflow.io', password: 'password123' });
    leaderEngToken = ldrEngRes.body.accessToken;

    const ldrProdRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'maya.lin@taskflow.io', password: 'password123' });
    leaderProdToken = ldrProdRes.body.accessToken;

    const empEng1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'david.kim@taskflow.io', password: 'password123' });
    empEng1Token = empEng1Res.body.accessToken;

    const empEng2Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'elena.rostova@taskflow.io', password: 'password123' });
    empEng2Token = empEng2Res.body.accessToken;

    const empProd1Res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'marcus.vance@taskflow.io', password: 'password123' });
    empProd1Token = empProd1Res.body.accessToken;
  });

  describe('1. NOTIFICATION SYSTEM HARDENING', () => {
    test('1. User receives notifications only for their own account', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${empEng2Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('notifications');
      expect(res.body.notifications.every(n => n.userId === 'u-emp-eng2')).toBe(true);
    });

    test('2. IDOR Prevention: User cannot mark another user notification as read', async () => {
      const notifs = db.find('notifications', n => n.userId === 'u-mgr-1');
      expect(notifs.length).toBeGreaterThan(0);
      const targetNotifId = notifs[0].id;

      const res = await request(app)
        .patch(`/api/notifications/${targetNotifId}/read`)
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    test('3. Marking notification as read is idempotent', async () => {
      const notifs = db.find('notifications', n => n.userId === 'u-emp-eng2');
      expect(notifs.length).toBeGreaterThan(0);
      const targetNotifId = notifs[0].id;

      const res1 = await request(app)
        .patch(`/api/notifications/${targetNotifId}/read`)
        .set('Authorization', `Bearer ${empEng2Token}`);
      expect(res1.status).toBe(200);
      expect(res1.body.isRead).toBe(true);

      const res2 = await request(app)
        .patch(`/api/notifications/${targetNotifId}/read`)
        .set('Authorization', `Bearer ${empEng2Token}`);
      expect(res2.status).toBe(200);
      expect(res2.body.isRead).toBe(true);
    });

    test('4. Mark all as read updates all unread notifications for authenticated user', async () => {
      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');

      const unreadManagerNotifs = db.find('notifications', n => n.userId === 'u-mgr-1' && !n.isRead);
      expect(unreadManagerNotifs.length).toBe(0);
    });

    test('5. Non-existent notification ID returns 404', async () => {
      const res = await request(app)
        .patch('/api/notifications/notif-ghost-9999/read')
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('2. AUTOMATED NOTIFICATION TRIGGERS', () => {
    test('6. Leader creating task triggers notification for Manager', async () => {
      const initialMgrNotifs = db.find('notifications', n => n.userId === 'u-mgr-1').length;

      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${leaderEngToken}`)
        .send({
          title: 'Automated Trigger Task Test',
          description: 'Trigger test',
          priority: 'HIGH',
          assignedTo: 'u-emp-eng1',
          dueDate: '2026-12-31'
        });

      expect(res.status).toBe(201);

      const newMgrNotifs = db.find('notifications', n => n.userId === 'u-mgr-1');
      expect(newMgrNotifs.length).toBe(initialMgrNotifs + 1);
      expect(newMgrNotifs[newMgrNotifs.length - 1].type).toBe('APPROVAL_REQUEST');
    });

    test('7. Manager rejecting task triggers notification for Leader creator', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Needs scope update' });

      expect(res.status).toBe(200);

      const leaderNotifs = db.find('notifications', n => n.userId === 'u-ldr-eng');
      const rejectionNotif = leaderNotifs.find(n => n.type === 'TASK_REJECTED' && n.taskId === 'task-102');
      expect(rejectionNotif).toBeDefined();
    });

    test('8. Manager approving task triggers notification for Assignee', async () => {
      const res = await request(app)
        .post('/api/approvals/task-102/approve')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);

      const assigneeNotifs = db.find('notifications', n => n.userId === 'u-emp-eng1');
      const approvedNotif = assigneeNotifs.find(n => n.type === 'TASK_ASSIGNED' && n.taskId === 'task-102');
      expect(approvedNotif).toBeDefined();
    });

    test('9. Duplicate rapid notification creation is prevented', async () => {
      const res1 = await request(app)
        .post('/api/approvals/task-103/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Duplicate test' });
      expect(res1.status).toBe(200);

      const notifCountAfterFirst = db.find('notifications').length;

      // Duplicate attempt within 5s window
      const res2 = await request(app)
        .post('/api/approvals/task-103/reject')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ rejectionReason: 'Duplicate test' });

      // Second attempt returns 400 because task is no longer PENDING_APPROVAL
      expect(res2.status).toBe(400);
      expect(db.find('notifications').length).toBe(notifCountAfterFirst);
    });
  });

  describe('3. AUDIT TRAIL HARDENING', () => {
    test('10. Global activity feed requires authentication', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(401);
    });

    test('11. Leader activity feed is restricted to their assigned team', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${leaderEngToken}`);

      expect(res.status).toBe(200);
      const list = res.body.activities || res.body;

      // Check that all returned logs belong to team-eng users or team-eng tasks
      const teamEngUserIds = ['u-ldr-eng', 'u-emp-eng1', 'u-emp-eng2'];
      const allEng = list.every(log => teamEngUserIds.includes(log.userId) || log.userId === 'u-mgr-1');
      expect(allEng).toBe(true);
    });

    test('12. Employee activity feed is restricted to own actions or assigned tasks', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${empEng1Token}`);

      expect(res.status).toBe(200);
      const list = res.body.activities || res.body;

      const validForEmp1 = list.every(log => log.userId === 'u-emp-eng1' || log.taskId === 'task-102' || log.taskId === 'task-105');
      expect(validForEmp1).toBe(true);
    });

    test('13. Activity log entries are immutable (no PUT/DELETE endpoints)', async () => {
      const resPut = await request(app)
        .put('/api/activity/act-1')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ action: 'FORGED_ACTION' });
      expect(resPut.status).toBe(404);

      const resDelete = await request(app)
        .delete('/api/activity/act-1')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(resDelete.status).toBe(404);
    });
  });
});
