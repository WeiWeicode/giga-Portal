/**
 * 員工持股會滿 3 年領回確認(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/stock.feature)。
 * 舊程式 EmployeeStockOwnershipCheck.aspx(.cs):EmployeeStockInfo(人資匯入,唯讀)、EmployeeStockLog(回覆,寫入)。
 *   - 只列本人(Token 工號);集保帳號只回末 4 碼
 *   - 開放 = EmployeeStockInfo 有本人「今年」的資料(同舊首頁 MainFormX.aspx.cs:592 以 Annual = 今年判斷);否則回 410 服務已結束
 *   - 可領回才可送出(自提、CanBack = Y,後端檢查;舊版只隱藏按鈕);每年度一筆(交易內 UPDLOCK + HOLDLOCK)
 *   - 領回:BackStockNo = 自提可領股數、DoBack = Y、BankAccount = 11 碼數字;不領回:股數 0、DoBack = N、BankAccount NULL(同舊版)
 *   - Q-F11:UserName 舊版寫工號(測試區複本 293 筆全部 = UserID,repo 與舊程式都沒有讀此欄的報表);新站預設照舊寫工號,
 *     STOCK_LOG_USERNAME=name 時改寫姓名(CONFIRM-NEEDED P7)
 */
import { AppError } from '../../errors.js';
import type { Employee } from '../../identity.js';
import { depositoryAccount, last4, serviceEnded } from './common.js';

export interface StockRow {
  annual: number;
  userId: string;
  userName: string | null;
  stockType: string | null;
  backStockNo: number | null;
  totalStockNo: number | null;
  joinDate: string | null;
  backDate: string | null;
  canBack: boolean;
}

export interface StockLog {
  annual: number;
  doBack: 'Y' | 'N' | string;
  backStockNo: number | null;
  confirmTime: string | null;
  bankAccount: string | null;
}

export interface StockRepo {
  rows(empNo: string): Promise<StockRow[]>;
  logs(empNo: string): Promise<StockLog[]>;
  /** 交易內:已有該年度回覆回 false;否則寫入 */
  decide(input: { annual: number; empNo: string; userName: string; backStockNo: number; doBack: 'Y' | 'N'; bankAccount: string | null }): Promise<boolean>;
}

export interface StockView {
  year: number;
  open: boolean;
  /** 本人今年的持股(各類別) */
  current: (StockRow & { selfProvided: boolean })[];
  /** 今年是否可送出(有自提可領回、尚未回覆) */
  canDecide: boolean;
  decision: (Omit<StockLog, 'bankAccount'> & { accountLast4: string | null }) | null;
  /** 歷年持股與回覆 */
  history: (StockRow & { decision: (Omit<StockLog, 'bankAccount'> & { accountLast4: string | null }) | null })[];
}

export const SELF_PROVIDED = '自提';

const maskLog = (l: StockLog | undefined) =>
  l ? { annual: l.annual, doBack: l.doBack, backStockNo: l.backStockNo, confirmTime: l.confirmTime, accountLast4: last4(l.bankAccount) } : null;

export class StockService {
  constructor(
    private readonly repo: StockRepo,
    private readonly userNameMode: 'empNo' | 'name' = 'empNo',
  ) {}

  async view(me: Employee, year: number): Promise<StockView> {
    const empNo = me.empNo.toUpperCase();
    const [rows, logs] = await Promise.all([this.repo.rows(empNo), this.repo.logs(empNo)]);
    const logOf = (annual: number) => logs.find((l) => l.annual === annual);
    const current = rows.filter((r) => r.annual === year).map((r) => ({ ...r, selfProvided: r.stockType === SELF_PROVIDED }));
    const decision = maskLog(logOf(year));
    return {
      year,
      open: current.length > 0,
      current,
      canDecide: !decision && current.some((r) => r.selfProvided && r.canBack),
      decision,
      history: rows.map((r) => ({ ...r, decision: r.stockType === SELF_PROVIDED ? maskLog(logOf(r.annual)) : null })),
    };
  }

  async decide(me: Employee, year: number, input: { doBack: boolean; account?: string | null }): Promise<StockView> {
    const empNo = me.empNo.toUpperCase();
    const rows = (await this.repo.rows(empNo)).filter((r) => r.annual === year);
    if (!rows.length) throw serviceEnded();
    const self = rows.find((r) => r.stockType === SELF_PROVIDED && r.canBack);
    if (!self) throw new AppError(409, 'PORTAL_STOCK_NOT_ELIGIBLE', '今年度沒有可領回的自提持股');
    const bankAccount = input.doBack ? depositoryAccount('account', input.account ?? '') : null;
    const ok = await this.repo.decide({
      annual: year,
      empNo,
      userName: this.userNameMode === 'name' ? (self.userName ?? me.name ?? empNo) : empNo,
      backStockNo: input.doBack ? (self.backStockNo ?? 0) : 0,
      doBack: input.doBack ? 'Y' : 'N',
      bankAccount,
    });
    if (!ok) throw new AppError(409, 'PORTAL_STOCK_DECIDED', `${year} 年度已有回覆紀錄`);
    return this.view(me, year);
  }
}
