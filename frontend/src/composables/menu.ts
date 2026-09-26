/**
 * 兩層選單(PRD FR-3.1):選單的名稱、圖示、路徑定義在前端路由 meta,可見與否只依權限代碼(Gateway 為唯一來源)。
 * 只顯示有 menu 權限的功能;沒有任何可見功能的群組不顯示。
 */
export interface MenuGroupDef {
  key: string;
  title: string;
  subtitle?: string;
  icon: string;
}
export interface MenuPage {
  path: string;
  group: string;
  title: string;
  subtitle?: string;
  icon?: string;
  permission?: string;
}
export interface MenuGroup extends MenuGroupDef {
  children: MenuPage[];
}

export function buildMenu(groups: readonly MenuGroupDef[], pages: readonly MenuPage[], can: (code: string) => boolean): MenuGroup[] {
  return groups
    .map((g) => ({ ...g, children: pages.filter((p) => p.group === g.key && (!p.permission || can(p.permission))) }))
    .filter((g) => g.children.length > 0);
}

/** 目前路徑所在的選單項目(最長前綴相符) */
export function findActive(menu: readonly MenuGroup[], path: string): { group: MenuGroup; item: MenuPage } | null {
  let best: { group: MenuGroup; item: MenuPage } | null = null;
  for (const group of menu)
    for (const item of group.children) {
      const hit = item.path === '/' ? path === '/' : path === item.path || path.startsWith(`${item.path}/`);
      if (hit && (!best || item.path.length > best.item.path.length)) best = { group, item };
    }
  return best;
}
