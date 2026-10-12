-- 一次性:測試區 Gateway 的入口網舊權限代碼對齊 deploy/gateway-rbac.yaml(giga-Portal FRAMEWORK-PLAN §3.2,2026-10-12)
-- 原因:Gateway CLI apply 只做首次登記,已存在的權限不會改名稱 / 上層 / 排序;舊選單仍掛在 portal.app.access 下,
--       名稱也還是多頁共用時期的舊名(例「薪資獎金 / 年度所得 / 薪資異動」)。
-- 內容:① 2026-10-12 前登記的 37 個代碼:名稱、上層(移到 portal.group.*)、排序改為 yaml 的值
--       ② 刪除已移除的 10 個代碼(隱藏的 M1 頁、舊 bpm.approval.* 畫面權限):先移除角色 / 部門 / 個人 / API 綁定,仍被路由、聚合、應用或下層使用時整批中止
--       ③ 所有使用者權限版本 +1(同 apply)、寫入 gw.audit_log
-- 前提:Portal 的 yaml 已套用(portal.group.* 已存在;2026-10-12 CI rbac-test 已完成)。可重複執行。
-- 執行:以 Gateway 測試區 DB 帳號(giganexus_gw_test)在 SSMS 或 sqlcmd 執行;正式區(2026-12)為全新登記,不需要。
SET XACT_ABORT ON;
SET NOCOUNT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM gw.permission WHERE code = 'portal.group.personal' AND kind = 'group')
  THROW 50001, N'portal.group.* 不存在:請先套用 giga-Portal/deploy/gateway-rbac.yaml', 1;

-- ① 名稱 / 上層 / 排序
DECLARE @u TABLE (code varchar(100) PRIMARY KEY, name nvarchar(100), parent_code varchar(100), sort smallint);
INSERT INTO @u (code, name, parent_code, sort) VALUES
  ('portal.home.read', N'首頁', 'portal.group.home', 10),
  ('portal.profile.read', N'個人基本資料', 'portal.group.personal', 20),
  ('portal.profile.edit', N'編輯緊急聯絡人', 'portal.profile.basic', 10),
  ('portal.form.read', N'表單下載', 'portal.group.approval', 60),
  ('portal.onboarding.read', N'新人導覽', 'portal.group.resources', 80),
  ('portal.onboarding.edit', N'維護新人導覽', 'portal.onboarding.tips', 10),
  ('portal.directory.read', N'分機表、聯絡窗口', 'portal.group.resources', 90),
  ('portal.gui-number.read', N'集團統編資訊', 'portal.group.resources', 100),
  ('portal.news.read', N'最新公告', 'portal.group.news', 110),
  ('portal.news.publish', N'發布公告', 'portal.news.all', 10),
  ('portal.calendar.read', N'行事曆', 'portal.group.news', 120),
  ('portal.links.read', N'集團系統', 'portal.group.news', 130),
  ('portal.talk.read', N'3691 全民開講', 'portal.group.news', 140),
  ('portal.salary.read', N'薪資獎金', 'portal.group.personal', 21),
  ('portal.attendance-abnormal.read', N'出勤異常', 'portal.group.personal', 41),
  ('portal.release-mail.read', N'郵件審核資訊', 'portal.group.personal', 42),
  ('portal.asset.read', N'個人資產明細', 'portal.group.personal', 43),
  ('portal.course.read', N'年度必上課程', 'portal.group.personal', 44),
  ('portal.note.read', N'個人提醒', 'portal.group.personal', 45),
  ('portal.survey.read', N'問卷調查', 'portal.group.resources', 75),
  ('portal.mgr.rights.read', N'主管權限說明', 'portal.group.manager', 200),
  ('portal.mgr.shift.read', N'部門班表匯入', 'portal.group.manager', 201),
  ('portal.mgr.boss-trace.read', N'主管工時追蹤', 'portal.group.manager', 202),
  ('portal.mgr.attendance.read', N'部屬出勤分析', 'portal.group.manager', 203),
  ('portal.mgr.leave-balance.read', N'休假餘額控管', 'portal.group.manager', 204),
  ('portal.mgr.promotion.read', N'職等晉升地圖', 'portal.group.manager', 205),
  ('portal.mgr.training.read', N'部門訓練計畫', 'portal.group.manager', 206),
  ('portal.mgr.safety-course.read', N'工安課程達成率', 'portal.group.manager', 207),
  ('portal.mgr.property.read', N'部門財產清冊', 'portal.group.manager', 208),
  ('portal.mgr.budget.read', N'部門預算執行', 'portal.group.manager', 209),
  ('portal.mgr.budget-apply.read', N'新年度預算編列', 'portal.group.manager', 210),
  ('portal.esh.license.read', N'證照管理', 'portal.group.esh', 300),
  ('portal.esh.item.read', N'證照項目設定', 'portal.group.esh', 301),
  ('portal.esh.need.read', N'工作站法定需求', 'portal.group.esh', 302),
  ('portal.esh.personal.read', N'人員證照登記', 'portal.group.esh', 303),
  ('portal.esh.manager.read', N'環安窗口設定', 'portal.group.esh', 304),
  ('portal.esh.chemical.read', N'危害性化學品資訊', 'portal.group.esh', 305);

INSERT INTO gw.audit_log (actor_name, action, entity_type, entity_id, before_json, after_json)
SELECT N'sql:giga-Portal-2026-10-12', 'permission.update', 'permission', p.code,
       N'{"name":"' + REPLACE(p.name, '"', '') + N'","parent":"' + ISNULL(p.parent_code, '') + N'","sort":' + ISNULL(CAST(p.sort AS nvarchar(10)), 'null') + N'}',
       N'{"name":"' + REPLACE(u.name, '"', '') + N'","parent":"' + u.parent_code + N'","sort":' + CAST(u.sort AS nvarchar(10)) + N'}'
FROM gw.permission p JOIN @u u ON u.code = p.code
WHERE p.name <> u.name OR ISNULL(p.parent_code, '') <> u.parent_code OR ISNULL(p.sort, -1) <> u.sort;

UPDATE p SET p.name = u.name, p.parent_code = u.parent_code, p.sort = u.sort,
       p.updated_at = SYSUTCDATETIME(), p.updated_by = N'sql:giga-Portal-2026-10-12'
FROM gw.permission p JOIN @u u ON u.code = p.code
WHERE p.name <> u.name OR ISNULL(p.parent_code, '') <> u.parent_code OR ISNULL(p.sort, -1) <> u.sort;
PRINT CONCAT(N'① 已更新 ', @@ROWCOUNT, N' 個權限');

-- ② 刪除已移除的代碼
DECLARE @d TABLE (code varchar(100) PRIMARY KEY);
INSERT INTO @d (code) VALUES ('portal.leave.read'), ('portal.leave-history.read'), ('portal.leave.apply'), ('portal.attendance.read'), ('portal.attendance.punch'), ('portal.resource.read'), ('portal.resource.edit'), ('bpm.approval.read'), ('bpm.approval.approve'), ('bpm.approval.reject');

IF EXISTS (SELECT 1 FROM gw.api_route r JOIN @d d ON d.code = r.permission_code)
   OR EXISTS (SELECT 1 FROM gw.aggregate_step s JOIN @d d ON d.code = s.permission_code)
   OR EXISTS (SELECT 1 FROM gw.app a JOIN @d d ON d.code = a.permission_code)
   OR EXISTS (SELECT 1 FROM gw.permission c JOIN @d d ON d.code = c.parent_code WHERE c.code NOT IN (SELECT code FROM @d))
  THROW 50002, N'要刪除的權限仍被路由、聚合步驟、應用或其他下層權限使用,已中止(未做任何變更)', 1;

DECLARE @ids TABLE (permission_id int PRIMARY KEY);
INSERT INTO @ids SELECT p.permission_id FROM gw.permission p JOIN @d d ON d.code = p.code;
DELETE FROM gw.role_permission WHERE permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.dept_permission WHERE permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.user_permission WHERE permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.api_client_permission WHERE permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.permission_include WHERE permission_id IN (SELECT permission_id FROM @ids) OR included_permission_id IN (SELECT permission_id FROM @ids);
INSERT INTO gw.audit_log (actor_name, action, entity_type, entity_id, before_json)
SELECT N'sql:giga-Portal-2026-10-12', 'permission.delete', 'permission', p.code, N'{"name":"' + REPLACE(p.name, '"', '') + N'","kind":"' + p.kind + N'"}'
FROM gw.permission p WHERE p.permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.permission WHERE permission_id IN (SELECT permission_id FROM @ids);
PRINT CONCAT(N'② 已刪除 ', @@ROWCOUNT, N' 個權限');

-- ③ 權限版本 +1(已登入者下一次呼叫 API 時由 web-kit 自動換發;BFF 的 pv 快取最多 15 分鐘)
UPDATE gw.[user] SET perm_version = perm_version + 1, updated_by = N'sql:giga-Portal-2026-10-12';

COMMIT TRANSACTION;
PRINT N'完成';
