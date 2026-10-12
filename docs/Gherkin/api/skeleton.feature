# language: zh-TW
@P0
功能: portal-api 骨架
  為了讓入口網各頁能經 BFF 取得自己的資料
  身為 入口網開發人員
  我要一個只接受 BFF 內部 Token、會自動註冊到 Gateway、測試區與正式區用同一份程式切換資料來源的後端

  # PORTAL-API-PLAN §3(P0-3、P0-4);Gateway BACKEND-GUIDE §4.2、§5.3、§6.1、§7.5。

  @auto
  場景: 健康檢查不需內部 Token
    當 呼叫 GET /healthz
    那麼 回應 200

  @auto @security
  場景: 缺少或對象不符的內部 Token 回 401
    當 不帶 X-Internal-Token 呼叫 GET /v1/me
    那麼 回應 401,code 為 "PORTAL_INTERNAL_TOKEN_INVALID"
    當 帶 aud 為其他服務的 Token 呼叫 GET /v1/me
    那麼 回應 401

  @auto
  場景: 取得目前登入者的身分
    假如 內部 Token 的工號 "S112009"、姓名 "測試員"、部門 "S1800"、公司 ["GSMC"]
    當 呼叫 GET /v1/me
    那麼 回應 200,內容為工號、姓名、部門、公司
    而且 不含 Token 原文

  @auto
  場景: 系統對系統的呼叫不能當成員工身分
    假如 內部 Token 的 sub 為 "client:abc"
    當 呼叫 GET /v1/me
    那麼 回應 403,code 為 "PORTAL_DATA_ACCESS_DENIED"

  @auto
  場景: 每個 API 都列在 OpenAPI 並有說明與 Gherkin
    當 讀取 /openapi.json
    那麼 根層 x-gateway 為 upstream "portal-api"、system "portal"、project "giga-Portal"
    而且 每個 operation 都有 operationId、summary、description、x-permission、x-gherkin

  @auto @security
  場景: DEV_SKIP_TOKEN 只能監聽本機
    假如 GW_ENV 為 "dev"、DEV_SKIP_TOKEN 為 "1"
    當 HOST 為 "0.0.0.0"
    那麼 啟動失敗
    而且 GW_ENV 不是 "dev" 時設定 DEV_SKIP_TOKEN 也啟動失敗

  Rule: 舊庫來源前綴(PORTAL-API-PLAN §3.1)

    @auto
    場景大綱: 測試區讀複本、正式區讀原庫
      假如 PORTAL_SRC_MODE 為 "<模式>"、連線庫為 "giganexus_gw_test"
      當 組出 "<來源>" 的資料表 "<表>"
      那麼 名稱為 "<結果>"

      例子:
        | 模式   | 來源          | 表             | 結果                                             |
        | copy   | PortalSolar   | CpfExInfo      | [giganexus_gw_test].[src_portalsolar].[CpfExInfo] |
        | copy   | LearnDB.learn | TB_COURSE_FORM | [giganexus_gw_test].[src_learndb_learn].[TB_COURSE_FORM] |
        | legacy | PortalSolar   | CpfExInfo      | [PortalSolar].[dbo].[CpfExInfo]                   |
        | legacy | LearnDB.learn | TB_COURSE_FORM | [LearnDB].[learn].[TB_COURSE_FORM]                |

    @auto
    場景: 個別來源可覆寫前綴
      假如 PORTAL_SRC_MODE 為 "copy",而且 PORTAL_SRC_SAFETY 為 "Safety.dbo"
      那麼 Safety 的資料表名稱為 "[Safety].[dbo].[...]",其他來源仍讀複本

    @auto @security
    場景: 不合法的前綴或表名讓啟動 / 查詢失敗
      當 PORTAL_SRC_PORTALSOLAR 為 "PortalSolar.dbo;DROP TABLE x"
      那麼 啟動失敗並指出設定名稱
      當 以表名 "x]; DROP TABLE y--" 組名稱
      那麼 拋出錯誤,不產生 SQL

    @auto
    場景: dev / test 預設讀複本
      假如 GW_ENV 為 "dev",未設定 PORTAL_SRC_MODE
      那麼 使用 copy 模式

    @auto
    場景: 正式區不可使用複本模式
      假如 GW_ENV 為 "prod"、PORTAL_SRC_MODE 為 "copy"
      那麼 啟動失敗

    @manual
    場景: 就緒檢查回報每個來源是否可讀
      假如 portal-api 部署到測試區
      當 呼叫 GET /readyz
      那麼 checks 含 sql 與每個來源(例 "src:PortalSolar")的狀態
