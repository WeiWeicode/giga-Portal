/**
 * 電視看板(P7 臨時服務;FEATURE-PLAN §9;docs/Gherkin/services/tv.feature)。
 * 舊程式 TVDemo.aspx(看板,未登入可開)、TVDemoSetting.aspx(設定頁**不需登入**、可上傳任意檔到網站 Document 目錄、UPDATE 沒有 WHERE)。
 *   - 看板 GET /tv/board 為 public(需 IT 在 Gateway 核准):只回跑馬燈文字、字級與顯示中的圖片,不含任何人員資料
 *   - 設定頁需登入 + 權限(portal.api.svc.tv.read / .edit);圖片經 file-service(只收圖片副檔名),登記在 portal.tv_image,不寫網站目錄
 *   - 舊圖(TVImgInfo.ImgPath = 舊站 Document 目錄檔名)唯讀顯示,可切換顯示 / 順序(同舊版以 ImgPath 定位)
 *   - 跑馬燈:同舊版更新 TVShowInfo 全部列(舊表只有 1 列);沒有資料時新增 1 列
 */
import { AppError } from '../../errors.js';
import { UUID_RE } from '../home/content.js';
import { IMAGE_EXT, invalid, plainText } from './common.js';

export interface TvMessage {
  message: string;
  fontSize: number;
}

export interface LegacyTvImage {
  path: string;
  index: number | null;
  active: boolean;
}

export interface NewTvImage {
  id: number;
  fileId: string;
  fileName: string;
  sort: number;
  active: boolean;
}

export interface TvRepo {
  message(): Promise<TvMessage | null>;
  setMessage(m: TvMessage): Promise<void>;
  legacyImages(): Promise<LegacyTvImage[]>;
  newImages(): Promise<NewTvImage[]>;
  addImage(fileId: string, fileName: string, sort: number, byEmp: string): Promise<NewTvImage>;
  /** 舊圖以 ImgPath 更新(TVImgInfo 沒有主鍵);回傳更新筆數 */
  updateLegacy(path: string, index: number, active: boolean): Promise<number>;
  updateNew(id: number, sort: number, active: boolean, byEmp: string): Promise<boolean>;
  deleteNew(id: number): Promise<boolean>;
}

export type BoardImage = { source: 'legacy'; key: string; url: string | null; name: string } | { source: 'file'; key: string; fileId: string; name: string };

export interface TvBoard {
  message: string;
  fontSize: number;
  images: BoardImage[];
}

export interface TvSettings extends TvBoard {
  legacy: (LegacyTvImage & { url: string | null })[];
  uploaded: NewTvImage[];
}

export type TvImageUpdate = { source: 'legacy'; path: string; sort: number; active: boolean } | { source: 'file'; id: number; sort: number; active: boolean };

export const TV_DEFAULT_FONT = 24;
/** 舊檔名:不得含路徑分隔、..、控制字元(避免組出其他網址) */
const SAFE_NAME = /^(?!.*\.\.)[^\\/\u0000-\u001f<>"'?#%]{1,200}$/;

export class TvService {
  constructor(
    private readonly repo: TvRepo,
    /** 舊入口網根網址(舊圖 = <根>/Document/<檔名>);null = 舊圖不帶連結 */
    private readonly legacyBase: string | null,
  ) {}

  legacyUrl(path: string): string | null {
    if (!this.legacyBase || !SAFE_NAME.test(path) || !IMAGE_EXT.test(path)) return null;
    return `${this.legacyBase}/Document/${encodeURIComponent(path)}`;
  }

  async board(): Promise<TvBoard> {
    const [m, legacy, uploaded] = await Promise.all([this.repo.message(), this.repo.legacyImages(), this.repo.newImages()]);
    const images: (BoardImage & { sort: number })[] = [
      ...legacy
        .filter((x) => x.active)
        .map((x) => ({ source: 'legacy' as const, key: `legacy:${x.path}`, url: this.legacyUrl(x.path), name: x.path, sort: x.index ?? 99 })),
      ...uploaded.filter((x) => x.active).map((x) => ({ source: 'file' as const, key: `file:${x.id}`, fileId: x.fileId, name: x.fileName, sort: x.sort })),
    ];
    images.sort((a, b) => a.sort - b.sort);
    return {
      message: m?.message ?? '',
      fontSize: m?.fontSize ?? TV_DEFAULT_FONT,
      // 舊圖沒有可用網址(未設定舊站或檔名不合格)就不放進輪播
      images: images.filter((i) => i.source === 'file' || i.url).map(({ sort: _s, ...i }) => i),
    };
  }

  async settings(): Promise<TvSettings> {
    const [b, legacy, uploaded] = await Promise.all([this.board(), this.repo.legacyImages(), this.repo.newImages()]);
    return { ...b, legacy: legacy.map((x) => ({ ...x, url: this.legacyUrl(x.path) })), uploaded };
  }

  async setMessage(input: TvMessage): Promise<void> {
    const message = plainText('message', '跑馬燈文字', input.message, 500, { optional: true });
    if (!Number.isInteger(input.fontSize) || input.fontSize < 8 || input.fontSize > 200) throw invalid('fontSize', '字級須為 8~200');
    await this.repo.setMessage({ message, fontSize: input.fontSize });
  }

  async addImage(fileId: string, fileName: string, byEmp: string): Promise<NewTvImage> {
    const name = fileName.trim();
    if (!UUID_RE.test(fileId)) throw invalid('fileId', '檔案編號格式錯誤');
    if (!SAFE_NAME.test(name) || !IMAGE_EXT.test(name)) throw invalid('fileName', '只接受 jpg / png / gif / webp 圖片');
    const sorts = [...(await this.repo.newImages()).map((x) => x.sort), ...(await this.repo.legacyImages()).map((x) => x.index ?? 0)];
    return this.repo.addImage(fileId.toLowerCase(), name, Math.min(255, (sorts.length ? Math.max(...sorts) : 0) + 1), byEmp);
  }

  async updateImages(items: TvImageUpdate[], byEmp: string): Promise<void> {
    for (const i of items) {
      if (!Number.isInteger(i.sort) || i.sort < 0 || i.sort > 255) throw invalid('sort', '順序須為 0~255');
      if (i.source === 'legacy') {
        if (!(await this.repo.updateLegacy(i.path, i.sort, i.active))) throw new AppError(404, 'PORTAL_TV_IMAGE_NOT_FOUND', `找不到舊圖 ${i.path}`);
      } else if (!(await this.repo.updateNew(i.id, i.sort, i.active, byEmp))) throw new AppError(404, 'PORTAL_TV_IMAGE_NOT_FOUND', '找不到此圖片');
    }
  }

  async deleteImage(id: number): Promise<void> {
    if (!(await this.repo.deleteNew(id))) throw new AppError(404, 'PORTAL_TV_IMAGE_NOT_FOUND', '找不到此圖片');
  }
}
