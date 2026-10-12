/** docs/Gherkin/personal/notes.feature、assets.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { MAX_NOTES, NoteService, type Note, type NoteInput, type NotePatch, type NoteRepo } from '../src/modules/notes/notes.js';
import type { AssetNoteRepo } from '../src/routes/assets.js';
import { testApp, type TestApp } from './helpers.js';

/** 記憶體版:排序規則同 DrizzleNoteRepo */
export class MemoryNoteRepo implements NoteRepo {
  rows: (Note & { empNo: string })[] = [];
  private seq = 0;
  async list(empNo: string): Promise<Note[]> {
    return this.rows
      .filter((r) => r.empNo === empNo)
      .sort(
        (a, b) =>
          Number(a.done) - Number(b.done) ||
          Number(a.dueDate === null) - Number(b.dueDate === null) ||
          (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
          b.id - a.id,
      )
      .map(({ empNo: _e, ...n }) => n);
  }
  async count(empNo: string): Promise<number> {
    return this.rows.filter((r) => r.empNo === empNo).length;
  }
  async create(empNo: string, input: NoteInput): Promise<Note> {
    const now = new Date().toISOString();
    const n = {
      id: ++this.seq,
      empNo,
      title: input.title,
      content: input.content ?? null,
      category: input.category,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      done: false,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(n);
    const { empNo: _e, ...note } = n;
    return note;
  }
  async update(empNo: string, id: number, patch: NotePatch): Promise<Note | null> {
    const r = this.rows.find((x) => x.id === id && x.empNo === empNo);
    if (!r) return null;
    Object.assign(r, patch);
    const { empNo: _e, ...note } = r;
    return note;
  }
  async remove(empNo: string, id: number): Promise<boolean> {
    const i = this.rows.findIndex((x) => x.id === id && x.empNo === empNo);
    if (i < 0) return false;
    this.rows.splice(i, 1);
    return true;
  }
}

const base = { title: '繳交報告', category: '重要截止', priority: 'high' } as const;

describe('個人提醒', () => {
  let t: TestApp;
  let repo: MemoryNoteRepo;
  const assetCalls: string[] = [];
  const assets: AssetNoteRepo = {
    list: async (emp) => (assetCalls.push(emp), [{ compDb: 'DS11', assetNo: 'A001', assetSub: '0', note: '放在 3F', hasPhoto: true }]),
  };
  const call = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp }) } });

  before(async () => {
    repo = new MemoryNoteRepo();
    t = await testApp({ notes: new NoteService(repo), assets });
  });
  after(() => t.close());

  it('新增提醒', async () => {
    const res = await call('POST', '/v1/notes', { ...base, dueDate: '2026-10-31' });
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().title, '繳交報告');
    assert.equal(res.json().done, false);
    assert.equal(res.json().dueDate, '2026-10-31');
  });

  it('只看得到自己的提醒', async () => {
    await call('POST', '/v1/notes', { ...base, title: 'B 的提醒' }, 'B000001');
    const items = (await call('GET', '/v1/notes')).json().items as Note[];
    assert.ok(items.every((n) => n.title !== 'B 的提醒'));
  });

  it('未完成在前,依到期日排序', async () => {
    const emp = 'C000001';
    const done = (await call('POST', '/v1/notes', { ...base, title: '已完成', dueDate: '2026-01-01' }, emp)).json();
    await call('PATCH', `/v1/notes/${done.id}`, { done: true }, emp);
    await call('POST', '/v1/notes', { ...base, title: '無到期日' }, emp);
    await call('POST', '/v1/notes', { ...base, title: '較晚', dueDate: '2026-12-01' }, emp);
    await call('POST', '/v1/notes', { ...base, title: '較早', dueDate: '2026-11-01' }, emp);
    const titles = ((await call('GET', '/v1/notes', undefined, emp)).json().items as Note[]).map((n) => n.title);
    assert.deepEqual(titles, ['較早', '較晚', '無到期日', '已完成']);
  });

  it('標記完成與修改', async () => {
    const n = (await call('POST', '/v1/notes', base)).json();
    const r1 = await call('PATCH', `/v1/notes/${n.id}`, { done: true });
    assert.equal(r1.statusCode, 200);
    assert.equal(r1.json().done, true);
    assert.equal((await call('PATCH', `/v1/notes/${n.id}`, { title: '  新標題 ' })).json().title, '新標題');
  });

  it('不能修改或刪除別人的提醒', async () => {
    const other = (await call('POST', '/v1/notes', { ...base, title: 'B 私人' }, 'B000001')).json();
    const p = await call('PATCH', `/v1/notes/${other.id}`, { title: '改掉' });
    assert.equal(p.statusCode, 404);
    assert.equal(p.json().code, 'PORTAL_NOTE_NOT_FOUND');
    assert.equal((await call('DELETE', `/v1/notes/${other.id}`)).statusCode, 404);
    assert.equal(repo.rows.find((r) => r.id === other.id)!.title, 'B 私人');
    assert.equal((await call('DELETE', `/v1/notes/${other.id}`, undefined, 'B000001')).statusCode, 204);
  });

  it('欄位驗證', async () => {
    for (const bad of [
      { ...base, title: '   ' },
      { ...base, category: '其他' },
      { ...base, priority: 'urgent' },
      { ...base, dueDate: '2026/10/31' },
    ]) {
      const r = await call('POST', '/v1/notes', bad);
      assert.equal(r.statusCode, 400, JSON.stringify(bad));
      assert.equal(r.json().code, 'VALIDATION_FAILED');
    }
    assert.equal((await call('PATCH', '/v1/notes/1', {})).statusCode, 400);
  });

  it('每人最多 500 筆', async () => {
    const emp = 'D000001';
    for (let i = 0; i < MAX_NOTES; i++) await repo.create(emp, base);
    const r = await call('POST', '/v1/notes', base, emp);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_NOTE_LIMIT');
  });

  it('查看本人資產備註', async () => {
    const r = await call('GET', '/v1/assets/notes');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().items[0], { compDb: 'DS11', assetNo: 'A001', assetSub: '0', note: '放在 3F', hasPhoto: true });
    assert.deepEqual(assetCalls, ['S112009']);
  });
});
