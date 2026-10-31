import request from 'supertest';
import type { App } from 'supertest/types';
import { TestApp } from './utils/test-app';

const BASE = '/api/v1';

async function signUp(server: App, email: string, name = 'Test User') {
  const res = await request(server)
    .post(`${BASE}/auth/register`)
    .send({ email, name, password: 'Password123!' })
    .expect(201);
  return {
    id: res.body.user.id as string,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

describe('Task API (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  afterEach(() => t.reset());
  afterAll(() => t?.close());

  describe('health', () => {
    it('GET /health is public and reports mongodb up', async () => {
      const res = await request(t.server).get(`${BASE}/health`).expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info.mongodb.status).toBe('up');
    });
  });

  describe('auth', () => {
    it('registers, logs in, and never exposes password or refresh hashes', async () => {
      const reg = await request(t.server)
        .post(`${BASE}/auth/register`)
        .send({ email: 'Ada@Example.com', name: 'Ada', password: 'Password123!' })
        .expect(201);

      expect(reg.body.user).toMatchObject({ email: 'ada@example.com', name: 'Ada', role: 'user' });
      expect(reg.body.user.passwordHash).toBeUndefined();
      expect(reg.body.user.refreshTokenHash).toBeUndefined();
      expect(reg.body.user._id).toBeUndefined();
      expect(reg.body.user.id).toEqual(expect.any(String));

      const login = await request(t.server)
        .post(`${BASE}/auth/login`)
        .send({ email: 'ada@example.com', password: 'Password123!' })
        .expect(200);
      expect(login.body.accessToken).toEqual(expect.any(String));
    });

    it('returns 409 on duplicate email', async () => {
      await signUp(t.server, 'dup@example.com');
      const res = await request(t.server)
        .post(`${BASE}/auth/register`)
        .send({ email: 'dup@example.com', name: 'Dup', password: 'Password123!' })
        .expect(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        error: 'CONFLICT',
        path: expect.any(String),
      });
    });

    it('validates the body (400 with field messages, unknown fields rejected)', async () => {
      const res = await request(t.server)
        .post(`${BASE}/auth/register`)
        .send({ email: 'not-an-email', name: 'A', password: 'short', hacker: true })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('email'),
          expect.stringContaining('password'),
          expect.stringContaining('hacker'),
        ]),
      );
    });

    it('rejects wrong credentials with 401', async () => {
      await signUp(t.server, 'ada@example.com');
      await request(t.server)
        .post(`${BASE}/auth/login`)
        .send({ email: 'ada@example.com', password: 'wrong-password' })
        .expect(401);
    });

    it('protects routes: 401 without token, 200 with it', async () => {
      await request(t.server).get(`${BASE}/users/me`).expect(401);

      const { accessToken } = await signUp(t.server, 'ada@example.com');
      const res = await request(t.server)
        .get(`${BASE}/users/me`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(res.body.email).toBe('ada@example.com');
    });

    it('rotates refresh tokens and detects reuse of the old one', async () => {
      const { refreshToken: first } = await signUp(t.server, 'ada@example.com');

      const rotated = await request(t.server)
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: first })
        .expect(200);
      const second = rotated.body.refreshToken as string;
      expect(second).not.toBe(first);

      // replaying the old token fails and revokes the newest one too
      await request(t.server)
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: first })
        .expect(403);
      await request(t.server)
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: second })
        .expect(403);
    });

    it('logout invalidates the refresh token', async () => {
      const { accessToken, refreshToken } = await signUp(t.server, 'ada@example.com');

      await request(t.server)
        .post(`${BASE}/auth/logout`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
      await request(t.server).post(`${BASE}/auth/refresh`).send({ refreshToken }).expect(403);
    });

    it('rejects a refresh token signed with the access secret', async () => {
      const { accessToken } = await signUp(t.server, 'ada@example.com');
      await request(t.server)
        .post(`${BASE}/auth/refresh`)
        .send({ refreshToken: accessToken })
        .expect(401);
    });
  });

  describe('roles', () => {
    it('GET /users is admin-only (403 for a plain user)', async () => {
      const { accessToken } = await signUp(t.server, 'ada@example.com');
      await request(t.server)
        .get(`${BASE}/users`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('projects & tasks', () => {
    let owner: Awaited<ReturnType<typeof signUp>>;
    let member: Awaited<ReturnType<typeof signUp>>;
    let stranger: Awaited<ReturnType<typeof signUp>>;
    let projectId: string;

    const as = (user: { accessToken: string }) => ({ Authorization: `Bearer ${user.accessToken}` });

    beforeEach(async () => {
      owner = await signUp(t.server, 'owner@example.com', 'Owner');
      member = await signUp(t.server, 'member@example.com', 'Member');
      stranger = await signUp(t.server, 'stranger@example.com', 'Stranger');

      const res = await request(t.server)
        .post(`${BASE}/projects`)
        .set(as(owner))
        .send({ name: 'Portfolio', description: 'Things to ship' })
        .expect(201);
      projectId = res.body.id;

      await request(t.server)
        .post(`${BASE}/projects/${projectId}/members`)
        .set(as(owner))
        .send({ email: 'member@example.com' })
        .expect(201);
    });

    it('lists projects for owner and member, but not for strangers', async () => {
      const forOwner = await request(t.server).get(`${BASE}/projects`).set(as(owner)).expect(200);
      const forMember = await request(t.server).get(`${BASE}/projects`).set(as(member)).expect(200);
      const forStranger = await request(t.server)
        .get(`${BASE}/projects`)
        .set(as(stranger))
        .expect(200);

      expect(forOwner.body.meta.total).toBe(1);
      expect(forMember.body.items[0].id).toBe(projectId);
      expect(forStranger.body.items).toHaveLength(0);
      // a stranger gets 404 (not 403) so project ids are not enumerable
      await request(t.server).get(`${BASE}/projects/${projectId}`).set(as(stranger)).expect(404);
    });

    it('only the owner can update, delete or manage members', async () => {
      await request(t.server)
        .patch(`${BASE}/projects/${projectId}`)
        .set(as(member))
        .send({ name: 'Hijacked' })
        .expect(403);
      await request(t.server).delete(`${BASE}/projects/${projectId}`).set(as(member)).expect(403);

      const updated = await request(t.server)
        .patch(`${BASE}/projects/${projectId}`)
        .set(as(owner))
        .send({ name: 'Renamed' })
        .expect(200);
      expect(updated.body.name).toBe('Renamed');
    });

    it('rejects malformed ids with 400 instead of a cast error', async () => {
      await request(t.server).get(`${BASE}/projects/not-an-id`).set(as(owner)).expect(400);
    });

    it('full task lifecycle: create -> filter/sort/paginate -> update -> my tasks -> delete', async () => {
      const mk = (body: Record<string, unknown>) =>
        request(t.server)
          .post(`${BASE}/projects/${projectId}/tasks`)
          .set(as(owner))
          .send(body)
          .expect(201);

      const a = await mk({ title: 'Write README', priority: 'high', assignee: member.id });
      await mk({ title: 'Set up CI', priority: 'medium', status: 'in_progress' });
      await mk({ title: 'Deploy', priority: 'low', dueDate: '2026-12-01T00:00:00.000Z' });

      expect(a.body).toMatchObject({
        title: 'Write README',
        status: 'todo',
        priority: 'high',
        assignee: member.id,
      });

      const high = await request(t.server)
        .get(`${BASE}/projects/${projectId}/tasks?priority=high`)
        .set(as(member))
        .expect(200);
      expect(high.body.items.map((x: any) => x.title)).toEqual(['Write README']);

      const page = await request(t.server)
        .get(`${BASE}/projects/${projectId}/tasks?search=e&sort=title&page=1&limit=2`)
        .set(as(owner))
        .expect(200);
      expect(page.body.items.map((x: any) => x.title)).toEqual(['Deploy', 'Set up CI']);
      expect(page.body.meta).toEqual({ total: 3, page: 1, limit: 2, pages: 2 });

      await request(t.server)
        .get(`${BASE}/projects/${projectId}/tasks?status=bogus`)
        .set(as(owner))
        .expect(400);

      const done = await request(t.server)
        .patch(`${BASE}/projects/${projectId}/tasks/${a.body.id}`)
        .set(as(member))
        .send({ status: 'done' })
        .expect(200);
      expect(done.body.status).toBe('done');

      await request(t.server)
        .patch(`${BASE}/projects/${projectId}/tasks/${a.body.id}`)
        .set(as(owner))
        .send({ assignee: stranger.id })
        .expect(400);

      const mine = await request(t.server).get(`${BASE}/tasks/mine`).set(as(member)).expect(200);
      expect(mine.body.items.map((x: any) => x.id)).toEqual([a.body.id]);

      await request(t.server)
        .get(`${BASE}/projects/${projectId}/tasks`)
        .set(as(stranger))
        .expect(404);

      await request(t.server)
        .delete(`${BASE}/projects/${projectId}/tasks/${a.body.id}`)
        .set(as(owner))
        .expect(204);
      await request(t.server)
        .get(`${BASE}/projects/${projectId}/tasks/${a.body.id}`)
        .set(as(owner))
        .expect(404);
    });
  });
});
