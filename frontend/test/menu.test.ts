import { describe, expect, it } from 'vitest';
import { buildMenu, findActive, type MenuGroupDef, type MenuPage } from '../src/composables/menu';

const GROUPS: MenuGroupDef[] = [
  { key: 'home', title: '首頁', icon: 'home' },
  { key: 'personal', title: '個人服務', icon: 'user' },
  { key: 'approval', title: '表單與簽核', icon: 'file-check' },
];
const PAGES: MenuPage[] = [
  { path: '/', group: 'home', title: '首頁', permission: 'portal.home.read' },
  { path: '/personal/leave', group: 'personal', title: '我的假期', permission: 'portal.leave.read' },
  { path: '/personal/attendance', group: 'personal', title: '出勤紀錄', permission: 'portal.attendance.read' },
  { path: '/approval', group: 'approval', title: '待我簽核', permission: 'bpm.approval.read' },
  { path: '/forms', group: 'approval', title: '表單下載', permission: 'portal.form.read' },
];
const canOf = (perms: string[]) => (c: string) => perms.includes(c);

// rbac/button.feature、ui/navigation.feature
describe('選單依權限過濾', () => {
  it('沒有任何可見功能的選單群組不顯示', () => {
    const menu = buildMenu(GROUPS, PAGES, canOf(['portal.home.read', 'portal.leave.read']));
    expect(menu.map((g) => g.key)).toEqual(['home', 'personal']);
    expect(menu[1]!.children.map((p) => p.path)).toEqual(['/personal/leave']);
  });

  it('群組順序依 MENU_GROUPS', () => {
    const menu = buildMenu(GROUPS, PAGES, () => true);
    expect(menu.map((g) => g.key)).toEqual(['home', 'personal', 'approval']);
  });

  it('兩層選單與 Tab 對應網址', () => {
    const menu = buildMenu(GROUPS, PAGES, () => true);
    const hit = findActive(menu, '/personal/leave/history');
    expect(hit?.group.title).toBe('個人服務');
    expect(hit?.item.title).toBe('我的假期');
    expect(findActive(menu, '/')?.item.title).toBe('首頁');
    expect(findActive(menu, '/personal')).toBeNull();
    expect(findActive(menu, '/approvalx')).toBeNull();
  });
});
