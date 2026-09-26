import { describe, expect, it } from 'vitest';
import { deniedMessage, hasApp, resolveApps } from '../src/composables/apps';

const portal = { code: 'portal', name: '員工入口網', basePath: '/', icon: 'home' };
const it_ = { code: 'it', name: 'IT 管理系統', basePath: '/it/', icon: 'monitor' };

// auth/app-switch.feature、auth/app-guard.feature
describe('應用切換', () => {
  it('只有入口網權限時不顯示應用切換', () => {
    const r = resolveApps({ apps: [portal], permissions: [] });
    expect(r.apps).toHaveLength(1); // GAppSwitcher 在一個以下時不顯示
  });

  it('有兩個應用時可切換', () => {
    const r = resolveApps({ apps: [portal, it_], permissions: [] });
    expect(r.apps.map((a) => a.basePath)).toEqual(['/', '/it/']);
    expect(r.derived).toBe(false);
  });

  it('me 尚無 apps 時暫以 app 權限推導並標示', () => {
    const r = resolveApps({ permissions: ['portal.app.access', 'it.app.access', 'portal.home.read'] });
    expect(r.derived).toBe(true);
    expect(r.apps.map((a) => a.code)).toEqual(['portal', 'it']);
    expect(r.apps[0]).not.toHaveProperty('permission');
  });

  it('me 有 apps 時以 apps 為準,不看權限', () => {
    const r = resolveApps({ apps: [portal], permissions: ['it.app.access'] });
    expect(hasApp(r, 'it')).toBe(false);
  });
});

describe('應用層守衛', () => {
  it('沒有入口網權限時顯示無權限頁,不導回自己', () => {
    expect(hasApp(resolveApps({ apps: [it_], permissions: [] }), 'portal')).toBe(false);
    expect(hasApp(resolveApps({ permissions: ['portal.home.read'] }), 'portal')).toBe(false);
    expect(hasApp(resolveApps(null), 'portal')).toBe(false);
  });

  it('沒有 IT 應用權限時導回員工入口網的提示', () => {
    expect(deniedMessage('it')).toBe('您沒有IT 管理系統的使用權限');
    expect(deniedMessage('mes')).toBe('您沒有該應用的使用權限');
    expect(deniedMessage('portal')).toBeNull();
    expect(deniedMessage(undefined)).toBeNull();
  });
});
