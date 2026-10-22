/** docs/Gherkin/approval/forms.feature(測試名稱 = 場景名稱) */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  FormService,
  isAllowedFormFile,
  type FormCategory,
  type FormCategoryInput,
  type FormDoc,
  type FormDocInput,
  type FormRepo,
} from '../src/modules/forms/forms.js';
import { testApp, type TestApp } from './helpers.js';

const UUID = '0bc59e51-9188-4e5d-87eb-6467d178efdd';

class MemoryForms implements FormRepo {
  cats: FormCategory[] = [];
  docs: FormDoc[] = [];
  by: string[] = [];
  private seq = 0;
  async categories() {
    return [...this.cats].sort((a, b) => a.sort - b.sort || a.id - b.id);
  }
  async createCategory(i: FormCategoryInput, byEmp: string) {
    this.by.push(byEmp);
    const c = { id: ++this.seq, ...i };
    this.cats.push(c);
    return c;
  }
  async updateCategory(id: number, i: FormCategoryInput) {
    const c = this.cats.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, i);
    return c;
  }
  async deleteCategory(id: number) {
    if (this.docs.some((d) => d.categoryId === id)) return 'in-use' as const;
    const n = this.cats.length;
    this.cats = this.cats.filter((c) => c.id !== id);
    return n === this.cats.length ? ('not-found' as const) : ('ok' as const);
  }
  async categoryExists(id: number) {
    return this.cats.some((c) => c.id === id);
  }
  async categoryNameTaken(name: string, exceptId?: number) {
    return this.cats.some((c) => c.name === name && c.id !== exceptId);
  }
  async forms(all: boolean) {
    return this.docs.filter((d) => all || d.active);
  }
  async createForm(i: FormDocInput, byEmp: string) {
    this.by.push(byEmp);
    const d = { id: ++this.seq, ...i, updatedAt: '2026-10-23T00:00:00.000Z' };
    this.docs.push(d);
    return d;
  }
  async updateForm(id: number, i: FormDocInput) {
    const d = this.docs.find((x) => x.id === id);
    if (!d) return null;
    Object.assign(d, i);
    return d;
  }
  async deleteForm(id: number) {
    const n = this.docs.length;
    this.docs = this.docs.filter((d) => d.id !== id);
    return n !== this.docs.length;
  }
}

describe('表單下載', () => {
  let t: TestApp;
  const repo = new MemoryForms();
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object, emp = 'S112009') =>
    t.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { 'x-internal-token': await t.token({ sub: emp, emp, cos: ['禾迅'] }) } });
  const form = (over: Partial<FormDocInput> = {}) => ({
    categoryId: repo.cats[0]!.id,
    name: '請假單',
    description: null,
    fileId: UUID.toUpperCase(),
    fileName: '請假單.docx',
    sort: 10,
    active: true,
    ...over,
  });

  before(async () => {
    t = await testApp({ forms: new FormService(repo) });
  });
  after(() => t.close());
  beforeEach(() => {
    repo.cats = [];
    repo.docs = [];
    repo.by = [];
  });

  it('維護表單分類', async () => {
    const r = await call('POST', '/v1/forms/categories', { name: ' 人事 ', sort: 10 });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().name, '人事', '名稱去頭尾空白');
    assert.equal((await call('POST', '/v1/forms/categories', { name: '人事', sort: 20 })).json().code, 'PORTAL_FORM_CATEGORY_DUPLICATE');
    assert.equal((await call('POST', '/v1/forms/categories', { name: '<b>', sort: 20 })).statusCode, 400);
    const id = r.json().id;
    assert.equal((await call('PUT', `/v1/forms/categories/${id}`, { name: '人事', sort: 5 })).statusCode, 200, '改自己不算重名');
    assert.equal((await call('PUT', '/v1/forms/categories/999', { name: '總務', sort: 5 })).json().code, 'PORTAL_FORM_CATEGORY_NOT_FOUND');
    assert.deepEqual(repo.by, ['S112009'], '操作者取自 Token');
  });

  it('上傳表單', async () => {
    await call('POST', '/v1/forms/categories', { name: '人事', sort: 10 });
    const r = await call('POST', '/v1/forms', form());
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().fileId, UUID, '檔案編號轉小寫');
    for (const [bad, field] of [
      [{ fileId: 'x' }, 'fileId'],
      [{ fileName: 'run.exe' }, 'fileName'],
      [{ fileName: '..\\a.pdf' }, 'fileName'],
      [{ name: '<script>' }, 'name'],
      [{ name: '請假‮xcod.exe' }, 'name'],
      [{ fileName: 'a‮fdp.exe.pdf' }, 'fileName'],
      [{ description: 'x​' }, 'description'],
    ] as const) {
      const e = await call('POST', '/v1/forms', form(bad));
      assert.equal(e.statusCode, 400, field);
      assert.equal(e.json().details[0].field, field);
    }
    assert.equal((await call('POST', '/v1/forms', form({ categoryId: 999 }))).json().code, 'PORTAL_FORM_CATEGORY_NOT_FOUND');
    const extra = await call('POST', '/v1/forms', { ...form(), id: 77, updatedBy: 'X' });
    assert.notEqual(extra.json().id, 77, '額外欄位(id、updatedBy)不寫入');
    assert.equal(repo.by.at(-1), 'S112009');
  });

  it('依分類下載表單', async () => {
    await call('POST', '/v1/forms/categories', { name: '人事', sort: 10 });
    await call('POST', '/v1/forms', form());
    await call('POST', '/v1/forms', form({ name: '加班單', fileName: '加班單.pdf' }));
    const off = (await call('POST', '/v1/forms', form({ name: '舊表', active: false }))).json();
    const j = (await call('GET', '/v1/forms')).json();
    assert.deepEqual(
      j.categories.map((c: FormCategory) => c.name),
      ['人事'],
    );
    assert.deepEqual(
      j.items.map((f: FormDoc) => f.name),
      ['請假單', '加班單'],
      '員工只看啟用中',
    );
    const all = (await call('GET', '/v1/forms/admin')).json();
    assert.ok(
      all.items.some((f: FormDoc) => f.id === off.id),
      '維護清單含停用',
    );
  });

  it('停用與刪除表單', async () => {
    await call('POST', '/v1/forms/categories', { name: '人事', sort: 10 });
    const f = (await call('POST', '/v1/forms', form())).json();
    assert.equal((await call('PUT', `/v1/forms/${f.id}`, form({ active: false }))).json().active, false);
    assert.equal((await call('GET', '/v1/forms')).json().items.length, 0);
    assert.equal((await call('PUT', '/v1/forms/999', form())).json().code, 'PORTAL_FORM_NOT_FOUND');
    assert.equal((await call('DELETE', `/v1/forms/${f.id}`)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/forms/${f.id}`)).statusCode, 404);
  });

  it('有表單的分類不能刪', async () => {
    const c = (await call('POST', '/v1/forms/categories', { name: '人事', sort: 10 })).json();
    await call('POST', '/v1/forms', form({ active: false }));
    const r = await call('DELETE', `/v1/forms/categories/${c.id}`);
    assert.equal(r.statusCode, 409);
    assert.equal(r.json().code, 'PORTAL_FORM_CATEGORY_IN_USE');
    repo.docs = [];
    assert.equal((await call('DELETE', `/v1/forms/categories/${c.id}`)).statusCode, 204);
    assert.equal((await call('DELETE', `/v1/forms/categories/${c.id}`)).json().code, 'PORTAL_FORM_CATEGORY_NOT_FOUND');
  });

  it('表單 API 權限', async () => {
    const doc = (await t.app.inject({ url: '/openapi.json' })).json();
    const perms = Object.entries(doc.paths as Record<string, Record<string, { 'x-permission': string }>>)
      .filter(([p]) => p.startsWith('/v1/forms'))
      .flatMap(([p, ops]) => Object.entries(ops).map(([m, op]) => `${m.toUpperCase()} ${p} ${op['x-permission']}`));
    for (const line of perms) {
      if (line.startsWith('GET /v1/forms ')) assert.match(line, /portal\.api\.form\.read$/);
      else assert.match(line, /portal\.api\.form\.edit$/, line);
    }
    const sys = await t.app.inject({ url: '/v1/forms', headers: { 'x-internal-token': await t.token({ sub: 'client:x', amr: 'api_key' }) } });
    assert.equal(sys.statusCode, 403, '系統呼叫沒有員工身分');
  });

  it('允許的表單副檔名', () => {
    assert.ok(isAllowedFormFile('a.PDF'));
    assert.ok(isAllowedFormFile('年度表.xlsx'));
    assert.ok(!isAllowedFormFile('a.pdf.exe'));
    assert.ok(!isAllowedFormFile('noext'));
    assert.ok(!isAllowedFormFile('a.html'));
  });
});
