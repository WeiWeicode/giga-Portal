/**
 * ESH 排程(P6;FEATURE-PLAN §8):程序內定時檢查(同 giga-file-service file-api 的 NAS 備份做法;Gateway 沒有集中排程服務,CONFIRM-NEEDED P6)。
 *   - 複訓通知:每週 weekday(預設 1 = 週一)台灣時間 hour 點後執行一次(esh_job_run.run_key = notify-weekly-<週一日期>)
 *   - 化學品同步:每天台灣時間 hour 點後執行一次(run_key = chemical-daily-<日期>)
 * run_key 唯一索引保證重啟、多個執行個體時同一期只執行一次;已執行過的鍵記在記憶體,避免每次檢查都寫資料庫。
 */
import { weekKey } from './notify.js';

export interface ScheduledTask {
  name: string;
  /** 回傳本期鍵;尚未到時間回 null */
  due(now: Date): string | null;
  run(): Promise<unknown>;
}

export interface ScheduleLogger {
  info(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

const tw = (now: Date) => new Date(now.getTime() + 8 * 3600_000);

export const weeklyAt = (weekday: number, hour: number) => (now: Date) => {
  const t = tw(now);
  return t.getUTCDay() === weekday && t.getUTCHours() >= hour ? weekKey(now) : null;
};

export const dailyAt = (hour: number) => (now: Date) => {
  const t = tw(now);
  return t.getUTCHours() >= hour ? t.toISOString().slice(0, 10) : null;
};

export class EshScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly done = new Map<string, string>();
  private readonly running = new Set<string>();

  constructor(
    private readonly tasks: ScheduledTask[],
    private readonly log: ScheduleLogger,
    private readonly intervalMs = 10 * 60_000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** 檢查一次(到期且本期未執行的工作);回傳本次有執行的工作名稱 */
  async tick(): Promise<string[]> {
    const ran: string[] = [];
    for (const t of this.tasks) {
      const key = t.due(this.now());
      if (!key || this.done.get(t.name) === key || this.running.has(t.name)) continue;
      this.running.add(t.name);
      try {
        const r = await t.run();
        this.done.set(t.name, key);
        ran.push(t.name);
        this.log.info({ task: t.name, key, result: r ?? 'already-ran' }, 'ESH 排程完成');
      } catch (err) {
        // 失敗不記為已執行,下次檢查重試(run_key 已寫入且為 failed 時,esh_job_run 改回執行中重跑)
        this.log.error({ task: t.name, key, err }, 'ESH 排程失敗');
      } finally {
        this.running.delete(t.name);
      }
    }
    return ran;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
