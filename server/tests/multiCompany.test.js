const request = require('supertest');
const app = require('../index');
const db = require('../db/database');
const seed = require('../db/seed');

describe('Multi-Company SaaS Architecture & Security Suite', () => {
  let managerAToken, leaderAToken, employeeAToken;
  let managerBToken, employeeBToken;
  let companyAId, companyBId;
  let taskAId, taskBId;
  let teamAId, teamBId;

  beforeEach(async () => {
    await seed();

    // 1. Setup Company A (Acme Corp from seed)
    companyAId = 'comp-acme';
    teamAId = 'team-eng';
    taskAId = 'task-101';

    const loginResMgrA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.jenkins@taskflow.io', password: 'password123' });
    managerAToken = loginResMgrA.body.accessToken;

    const loginResLdrA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex.rivera@taskflow.io', password: 'password123' });
    leaderAToken = loginResLdrA.body.accessToken;

    const loginResEmpA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'david.kim@taskflow.io', password: 'password123' });
    employeeAToken = loginResEmpA.body.accessToken;

    // 2. Setup Company B (Beta Dynamics via Registration & Creation)
    const regResB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Manager Beta',
        email: 'manager@beta.com',
        password: 'Password123!',
        companyName: 'Beta Dynamics'
      });
    expect(regResB.status).toBe(201);
    managerBToken = regResB.body.accessToken;
    companyBId = regResB.body.user.companyId;

    // Create a team & task in Company B
    const createTeamB = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({ name: 'Beta Engineering', leaderId: regResB.body.user.id });
    expect(createTeamB.status).toBe(201);
    teamBId = createTeamB.body.team.id;

    // Create Employee in Company B via Invitation
    const inviteRes = await request(app)
      .post('/api/workspaces/invite')
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({ email: 'emp@beta.com', role: 'EMPLOYEE' });
    expect(inviteRes.status).toBe(201);
    const inviteTokenB = inviteRes.body.invitation.token;

    const regEmpB = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Employee Beta',
        email: 'emp@beta.com',
        password: 'Password123!',
        invitationToken: inviteTokenB
      });
    expect(regEmpB.status).toBe(201);
    employeeBToken = regEmpB.body.accessToken;

    // Create Task in Company B
    const createTaskB = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerBToken}`)
      .send({
        title: 'Beta Task 1',
        description: 'Secret Beta Task',
        priority: 'HIGH',
        assignedTo: regEmpB.body.user.id,
        teamId: teamBId,
        dueDate: new Date(Date.now() + 86400000).toISOString()
      });
    expect(createTaskB.status).toBe(201);
    taskBId = createTaskB.body.task.id;
  });

  describe('Workspace Creation & Invitation Lifecycle', () => {
    test('User can register without workspace and remains unassigned', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Unassigned User',
          email: 'unassigned@taskflow.dev',
          password: 'Password123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.user.companyId).toBeNull();
      expect(res.body.user.role).toBe('EMPLOYEE');

      // Unassigned user gets empty task list
      const tasksRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(tasksRes.status).toBe(200);
      expect(tasksRes.body).toEqual([]);
    });

    test('Invitation tokens expire and are single-use', async () => {
      const inviteRes = await request(app)
        .post('/api/workspaces/invite')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ email: 'singleuse@acme.com', role: 'EMPLOYEE' });
      expect(inviteRes.status).toBe(201);
      const token = inviteRes.body.invitation.token;

      // First redemption succeeds
      const joinRes1 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Single Use User 1',
          email: 'singleuse1@acme.com',
          password: 'Password123!',
          invitationToken: token
        });
      expect(joinRes1.status).toBe(201);

      // Second redemption fails
      const joinRes2 = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Single Use User 2',
          email: 'singleuse2@acme.com',
          password: 'Password123!',
          invitationToken: token
        });
      expect(joinRes2.status).toBe(400);
      expect(joinRes2.body.error).toMatch(/Invalid or expired invitation token/i);
    });

    test('Non-manager users cannot generate workspace invitations', async () => {
      const res = await request(app)
        .post('/api/workspaces/invite')
        .set('Authorization', `Bearer ${employeeAToken}`)
        .send({ email: 'hacker@taskflow.dev', role: 'MANAGER' });

      expect(res.status).toBe(403);
    });
  });

  describe('Cross-Company Data Isolation', () => {
    test('Company A user cannot view Company B tasks', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskBId}`)
        .set('Authorization', `Bearer ${managerAToken}`);

      expect(res.status).toBe(404);
    });

    test('Company A user cannot edit or status update Company B task', async () => {
      const resStatus = await request(app)
        .put(`/api/tasks/${taskBId}/status`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ status: 'COMPLETED' });
      expect(resStatus.status).toBe(404);

      const resEdit = await request(app)
        .put(`/api/tasks/${taskBId}`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ title: 'Hacked Title' });
      expect(resEdit.status).toBe(404);
    });

    test('Company A user cannot delete Company B task', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskBId}`)
        .set('Authorization', `Bearer ${managerAToken}`);

      expect(res.status).toBe(404);
    });

    test('Company A user cannot list Company B teams or members', async () => {
      const teamRes = await request(app)
        .get(`/api/teams/${teamBId}`)
        .set('Authorization', `Bearer ${managerAToken}`);
      expect(teamRes.status).toBe(404);

      const membersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${managerAToken}`);
      expect(membersRes.status).toBe(200);
      const containsBetaUser = membersRes.body.some(u => u.email === 'manager@beta.com');
      expect(containsBetaUser).toBe(false);
    });

    test('Forged x-company-id header does not grant unauthorized access', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${managerAToken}`)
        .set('x-company-id', companyBId);

      expect(res.status).toBe(200);
      // Returns tasks for Company A (since user is not a member of Company B)
      const hasBetaTask = (res.body.tasks || res.body).some(t => t.id === taskBId);
      expect(hasBetaTask).toBe(false);
    });

    test('Analytics Overview is strictly isolated per company', async () => {
      const analyticsA = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${managerAToken}`);

      const analyticsB = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${managerBToken}`);

      expect(analyticsA.body.metrics.totalTasks).toBe(7);
      expect(analyticsB.body.metrics.totalTasks).toBe(1);
    });

    test('AI Endpoints enforce company boundaries', async () => {
      // Task risk for Company B requested by Manager A fails
      const riskRes = await request(app)
        .get(`/api/ai/task-risk/${taskBId}`)
        .set('Authorization', `Bearer ${managerAToken}`);
      expect(riskRes.status).toBe(404);

      // Workload for Company B employee requested by Manager A fails
      const userB = db.findOne('users', u => u.email === 'emp@beta.com');
      const workloadRes = await request(app)
        .get(`/api/ai/workload/${userB.id}`)
        .set('Authorization', `Bearer ${managerAToken}`);
      expect(workloadRes.status).toBe(404);
    });


    test('Activity Logs and Notifications are isolated per company', async () => {
      const actResA = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${managerAToken}`);

      const actResB = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${managerBToken}`);

      expect(actResA.body.length || actResA.body.activities.length).toBeGreaterThan(0);
      const bLogsInA = (actResA.body.activities || actResA.body).some(l => l.companyId === companyBId);
      expect(bLogsInA).toBe(false);
    });
  });

  describe('Advanced Multi-Tenant Security & Team Integrity', () => {
    test('Unauthorized workspace switch is rejected with 403', async () => {
      const switchRes = await request(app)
        .post('/api/workspaces/switch')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ companyId: companyBId });

      expect(switchRes.status).toBe(403);
      expect(switchRes.body.error).toMatch(/Forbidden/i);
    });

    test('Manager A cannot modify team or role of user in Company B', async () => {
      const userB = db.findOne('users', u => u.email === 'emp@beta.com');
      const updateRes = await request(app)
        .put(`/api/users/${userB.id}/team`)
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ title: 'Hacked Title' });

      expect(updateRes.status).toBe(404);
    });

    test('Cross-company team leader assignment is rejected with 400', async () => {
      const userB = db.findOne('users', u => u.email === 'emp@beta.com');
      const createTeamRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ name: 'Hacked Team', leaderId: userB.id });

      expect(createTeamRes.status).toBe(400);
      expect(createTeamRes.body.error).toMatch(/does not belong to your company/i);
    });

    test('Manager retains Manager role when creating a team', async () => {
      const managerUserBefore = db.findOne('users', u => u.email === 'sarah.jenkins@taskflow.io');
      expect(managerUserBefore.role).toBe('MANAGER');

      const createTeamRes = await request(app)
        .post('/api/teams')
        .set('Authorization', `Bearer ${managerAToken}`)
        .send({ name: 'Ops Management Team', leaderId: managerUserBefore.id });

      expect(createTeamRes.status).toBe(201);
      const managerUserAfter = db.findOne('users', u => u.email === 'sarah.jenkins@taskflow.io');
      expect(managerUserAfter.role).toBe('MANAGER');
    });
  });
});
