/**
 * 新人導覽(old_PortalSolar HRnewPep01.aspx(.cs)、HRnewPep05.aspx(.cs);FEATURE-PLAN §3.5、PORTAL-API-PLAN D-20;
 * docs/Gherkin/resources/onboarding.feature)。資料 PortalSolar.dbo.NewPepR、HRNewPtest(與舊系統共用,日期為字串)。
 *   - 小叮嚀「我已閱讀完畢」:寫 NewPepR(LgNo = 本人、LgTime = 今天 yyyy/MM/dd,同舊程式);同一天重複按不重複寫
 *     (舊版每按一次一筆,舊報表 HRNewPay 只取 MAX(LgTime),不影響相容)
 *   - 驗收測驗:20 題是非題,後端計分(正解只在 modules/onboarding/quiz.ts);滿分才在同一交易內先刪本人舊紀錄、
 *     再寫 HRNewPtest(t1~t20「是 / 否」、a01 意見、MakeTime = 今天 yyyy/M/d、PGrade = "100");不及格不寫入(D-20)
 *   - 完成狀態 GET /onboarding/status:{ readAt, passedAt }(YYYY-MM-DD),供首頁待辦使用
 *   - 不寄通知信(舊程式已註解);身分只取內部 Token 的工號
 */
import sql from 'mssql';
import type { FastifyInstance } from 'fastify';
import type { Sources } from '../db/sources.js';
import { AppError } from '../errors.js';
import { employeeOf } from '../identity.js';
import { gradeQuiz, legacyAnswer, PASS_SCORE, QUESTIONS, QUIZ_TOTAL } from '../modules/onboarding/quiz.js';

export interface OnboardingStatus {
  /** 最近一次「我已閱讀完畢」(YYYY-MM-DD) */
  readAt: string | null;
  /** 最近一次通過驗收測驗(YYYY-MM-DD;只認 PGrade = "100") */
  passedAt: string | null;
}

export interface PassRecord {
  /** t1~t20:「是」/「否」 */
  answers: string[];
  /** 我有話要說(a01) */
  comment: string;
  /** MakeTime:yyyy/M/d */
  makeTime: string;
}

export interface OnboardingRepo {
  status(empNo: string): Promise<OnboardingStatus>;
  /** 寫入閱讀紀錄(同一天已有則不寫) */
  markRead(empNo: string, lgTime: string): Promise<void>;
  /** 通過測驗:刪除本人舊紀錄後新增一筆(同一交易) */
  savePass(empNo: string, rec: PassRecord): Promise<void>;
}

/** 台灣時間的今天 */
const twToday = () => {
  const d = new Date(Date.now() + 8 * 3600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const pad = (n: number) => String(n).padStart(2, '0');
/** NewPepR.LgTime 格式(HRnewPep01.aspx.cs:29 ToString("yyyy/MM/dd")) */
export const readTimeToday = () => {
  const t = twToday();
  return `${t.y}/${pad(t.m)}/${pad(t.d)}`;
};
/** HRNewPtest.MakeTime 格式(HRnewPep05.aspx.cs:118 ToShortDateString,舊伺服器地區設定的實際資料為 yyyy/M/d) */
export const makeTimeToday = () => {
  const t = twToday();
  return `${t.y}/${t.m}/${t.d}`;
};
/** 舊字串日期 → YYYY-MM-DD(與資料庫 CONVERT style 111 一致,供記憶體實作與測試使用) */
export const isoFromLegacy = (s: string) => {
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s.trim());
  return m ? `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}` : null;
};

/** 舊表欄位長度:LgNo nvarchar(50) */
const EMP_MAX = 50;

export class MssqlOnboardingRepo implements OnboardingRepo {
  constructor(
    private readonly pool: sql.ConnectionPool,
    private readonly src: Sources,
  ) {}

  private get readTable() {
    return this.src.table('PortalSolar', 'NewPepR');
  }
  private get testTable() {
    return this.src.table('PortalSolar', 'HRNewPtest');
  }

  async status(empNo: string): Promise<OnboardingStatus> {
    // 日期為字串:以 style 111(yyyy/MM/dd,接受個位數月日)轉換,無法轉換的舊資料略過
    const r = await this.pool
      .request()
      .input('emp', sql.NVarChar(EMP_MAX), empNo)
      .query<OnboardingStatus>(
        `SELECT
           (SELECT CONVERT(char(10), MAX(TRY_CONVERT(date, LgTime, 111)), 23) FROM ${this.readTable} WHERE LgNo = @emp) AS readAt,
           (SELECT CONVERT(char(10), MAX(TRY_CONVERT(date, MakeTime, 111)), 23) FROM ${this.testTable} WHERE LgNo = @emp AND PGrade = N'100') AS passedAt`,
      );
    const row = r.recordset[0];
    return { readAt: row?.readAt ?? null, passedAt: row?.passedAt ?? null };
  }

  async markRead(empNo: string, lgTime: string): Promise<void> {
    await this.pool
      .request()
      .input('emp', sql.NVarChar(EMP_MAX), empNo)
      .input('t', sql.NVarChar(50), lgTime)
      .query(
        `INSERT INTO ${this.readTable} (LgNo, LgTime)
         SELECT @emp, @t WHERE NOT EXISTS (SELECT 1 FROM ${this.readTable} WHERE LgNo = @emp AND LgTime = @t)`,
      );
  }

  async savePass(empNo: string, rec: PassRecord): Promise<void> {
    if (rec.answers.length !== QUIZ_TOTAL) throw new Error('作答數量錯誤');
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const req = tx
        .request()
        .input('emp', sql.NVarChar(EMP_MAX), empNo)
        .input('a01', sql.NVarChar(sql.MAX), rec.comment)
        .input('mt', sql.NVarChar(50), rec.makeTime)
        .input('pg', sql.NVarChar(50), String(PASS_SCORE));
      rec.answers.forEach((a, i) => req.input(`t${i + 1}`, sql.NVarChar(5), a));
      const cols = rec.answers.map((_, i) => `t${i + 1}`);
      await req.query(
        `DELETE FROM ${this.testTable} WHERE LgNo = @emp;
         INSERT INTO ${this.testTable} (LgNo, ${cols.join(', ')}, a01, MakeTime, PGrade)
         VALUES (@emp, ${cols.map((c) => `@${c}`).join(', ')}, @a01, @mt, @pg);`,
      );
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}

const dateOrNull = { type: ['string', 'null'] } as const;
const statusSchema = {
  type: 'object',
  required: ['readAt', 'passedAt'],
  properties: { readAt: dateOrNull, passedAt: dateOrNull },
} as const;

export function onboardingRoutes(repo: OnboardingRepo | null) {
  const need = () => {
    if (!repo) throw new AppError(503, 'PORTAL_SOURCE_UNAVAILABLE', '資料來源未設定');
    return repo;
  };
  const self = (req: Parameters<typeof employeeOf>[0]) => {
    const { empNo } = employeeOf(req);
    if (empNo.length > EMP_MAX) throw new AppError(400, 'VALIDATION_FAILED', '工號長度超過舊表欄位');
    return empNo;
  };
  return async (app: FastifyInstance): Promise<void> => {
    app.get(
      '/v1/onboarding/status',
      {
        schema: {
          operationId: 'portal.onboarding.status',
          summary: '新人導覽:本人完成狀態',
          description: '本人最近一次閱讀小叮嚀(NewPepR)與通過驗收測驗(HRNewPtest,PGrade = 100)的日期 YYYY-MM-DD;沒有紀錄為 null。',
          'x-permission': 'portal.api.onboarding.read',
          'x-gherkin': '場景: 查詢本人完成狀態\n  當 呼叫 GET /api/portal/onboarding/status\n  那麼 回應 readAt 與 passedAt(沒有紀錄為 null)',
          response: { 200: statusSchema },
        },
      },
      async (req) => need().status(self(req)),
    );

    app.post(
      '/v1/onboarding/read',
      {
        schema: {
          operationId: 'portal.onboarding.mark-read',
          summary: '新人導覽:我已閱讀完畢',
          description: '寫入本人小叮嚀閱讀紀錄(PortalSolar NewPepR,LgTime = 今天 yyyy/MM/dd,與舊入口網共用);同一天重複送出不重複寫入。',
          'x-permission': 'portal.api.onboarding.write',
          'x-audit-level': 'meta',
          'x-gherkin': '場景: 記錄已閱讀\n  當 呼叫 POST /api/portal/onboarding/read\n  那麼 回應 200 與今天的 readAt;同一天再送出不會多一筆',
          response: { 200: statusSchema },
        },
      },
      async (req) => {
        const empNo = self(req);
        const r = need();
        await r.markRead(empNo, readTimeToday());
        return r.status(empNo);
      },
    );

    app.get(
      '/v1/onboarding/quiz',
      {
        schema: {
          operationId: 'portal.onboarding.quiz',
          summary: '新人導覽:驗收測驗題目',
          description: '20 題是非題的題號與題目(不含答案);每題 5 分,滿分 100 才算通過。',
          'x-permission': 'portal.api.onboarding.read',
          'x-gherkin': '場景: 取得驗收測驗題目\n  當 呼叫 GET /api/portal/onboarding/quiz\n  那麼 回應 20 題題目,不含標準答案',
          response: {
            200: {
              type: 'object',
              required: ['questions', 'passScore'],
              properties: {
                questions: {
                  type: 'array',
                  items: { type: 'object', required: ['no', 'text'], properties: { no: { type: 'integer' }, text: { type: 'string' } } },
                },
                passScore: { type: 'integer' },
              },
            },
          },
        },
      },
      async (req) => {
        self(req);
        return { questions: QUESTIONS.map((text, i) => ({ no: i + 1, text })), passScore: PASS_SCORE };
      },
    );

    app.post<{ Body: { answers: boolean[]; comment?: string } }>(
      '/v1/onboarding/quiz',
      {
        schema: {
          operationId: 'portal.onboarding.quiz-submit',
          summary: '新人導覽:送出驗收測驗',
          description:
            '送出 20 題作答(true = 是、false = 否)與意見,由後端計分。全對才通過:同一交易內先刪除本人舊紀錄再寫入 HRNewPtest(與舊入口網共用);不及格只回答對題數、不寫入。',
          'x-permission': 'portal.api.onboarding.write',
          'x-audit-level': 'meta',
          'x-gherkin':
            '場景: 全對通過\n  當 呼叫 POST /api/portal/onboarding/quiz,20 題全對\n  那麼 回應 passed=true、correct=20,並寫入 HRNewPtest(PGrade 100)\n場景: 未全對\n  當 答對少於 20 題\n  那麼 回應 passed=false 與答對題數,不寫入任何紀錄',
          body: {
            type: 'object',
            required: ['answers'],
            additionalProperties: false,
            properties: {
              answers: { type: 'array', minItems: QUIZ_TOTAL, maxItems: QUIZ_TOTAL, items: { type: 'boolean' } },
              comment: { type: 'string', maxLength: 500 },
            },
          },
          response: {
            200: {
              type: 'object',
              required: ['correct', 'total', 'score', 'passed', 'passedAt'],
              properties: {
                correct: { type: 'integer' },
                total: { type: 'integer' },
                score: { type: 'integer' },
                passed: { type: 'boolean' },
                passedAt: dateOrNull,
              },
            },
          },
        },
      },
      async (req) => {
        const empNo = self(req);
        const r = need();
        const result = gradeQuiz(req.body.answers);
        let passedAt: string | null = null;
        if (result.passed) {
          await r.savePass(empNo, { answers: req.body.answers.map(legacyAnswer), comment: (req.body.comment ?? '').trim(), makeTime: makeTimeToday() });
          passedAt = (await r.status(empNo)).passedAt;
        }
        return { correct: result.correct, total: QUIZ_TOTAL, score: result.score, passed: result.passed, passedAt };
      },
    );
  };
}
