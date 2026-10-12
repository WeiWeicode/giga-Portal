-- 一次性:測試區 Gateway 刪除已退場的「郵件審核資訊」權限代碼(giga-Portal PORTAL-API-PLAN Q-D9,2026-10-12)
-- 原因:主管確認郵件審核已不實施;前端路由與 deploy/gateway-rbac.yaml 已移除,但 Gateway CLI apply 不會刪除既有權限。
-- 內容:① 刪除 portal.release-mail.read / portal.release-mail.list(先移除角色 / 部門 / 個人 / API Key / 隨附綁定;仍被路由、聚合、應用或其他下層使用時整批中止)
--       ② 所有使用者權限版本 +1(同 apply)、寫入 gw.audit_log
-- 前提:GigaItApp deploy/gateway-rbac.yaml 的 it-admin 已不引用這兩個代碼並已套用(否則下次 GigaItApp apply 會因代碼不存在而整批失敗)。
-- 可重複執行(代碼不存在時不做任何事)。
-- 執行:以 Gateway 測試區 DB 帳號(giganexus_gw_test)在 SSMS 或 sqlcmd 執行;正式區(2026-12)為全新登記,不需要。
SET XACT_ABORT ON;
SET NOCOUNT ON;
IF DB_NAME() <> N'giganexus_gw_test' THROW 50001, N'只能在測試區 giganexus_gw_test 執行', 1;
BEGIN TRANSACTION;

DECLARE @d TABLE (code varchar(100) PRIMARY KEY);
INSERT INTO @d (code) VALUES ('portal.release-mail.read'), ('portal.release-mail.list');

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
SELECT N'sql:giga-Portal-2026-10-12-release-mail', 'permission.delete', 'permission', p.code, N'{"name":"' + REPLACE(p.name, '"', '') + N'","kind":"' + p.kind + N'"}'
FROM gw.permission p WHERE p.permission_id IN (SELECT permission_id FROM @ids);
DELETE FROM gw.permission WHERE permission_id IN (SELECT permission_id FROM @ids);
PRINT CONCAT(N'① 已刪除 ', (SELECT COUNT(*) FROM @ids), N' 個權限');

-- ② 權限版本 +1(已登入者下一次呼叫 API 時由 web-kit 自動換發;BFF 的 pv 快取最多 15 分鐘)
IF EXISTS (SELECT 1 FROM @ids)
  UPDATE gw.[user] SET perm_version = perm_version + 1, updated_by = N'sql:giga-Portal-2026-10-12-release-mail';

COMMIT TRANSACTION;
PRINT N'完成';
