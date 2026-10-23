# language: zh-TW
@P6
功能: ESH 複訓通知(排程 + 手動立即通知)
  為了讓持證人與主管在證照失效前安排複訓
  身為 ESH 證照管理員
  我要系統每週自動通知,必要時手動立即通知,並查得到寄送紀錄

  # FEATURE-PLAN §8「複訓通知」;舊程式 EHLicense.aspx.cs:482-612(手動按鈕、不分公司、無紀錄,已失效每按一次重寄)。
  # 寄送:Gateway 通知中心 POST /api/notify/send(BACKEND-GUIDE §7.7,API Key + notify.message.send),以工號逐人寄;
  # 範本 ESH_LICENSE_RETRAIN / ESH_LICENSE_RETRAIN_BOSS / ESH_LICENSE_ADMIN_DIGEST 由 Gateway 負責人建立(CONFIRM-NEEDED P6)。
  # 寄送方式 ESH_NOTIFY_MODE:dry-run(預設,只寫紀錄不寄送)/ gateway。紀錄:portal.esh_job_run、esh_notify_log。

  @auto
  場景: 手動立即通知
    假如 碩禾 S300002 的證照 38 天後到期(通知天數 90),S300003 的證照已失效
    當 具按鈕 portal.esh.notify.send 的管理員按「立即通知」(POST /api/portal/esh/notify)
    那麼 只處理本人管理的公司(舊版不分公司)
    而且 寄本人 S300002(ESH_LICENSE_RETRAIN)、其主管(RankInfo.BossID,ESH_LICENSE_RETRAIN_BOSS)
    而且 碩禾 SendMail = 1 且在職的管理員收彙整(即將複訓、已失效、證照短缺)
    而且 已失效的 S300003 不再寄本人
    而且 每封寫一筆寄送紀錄(queued / skipped / dry-run / duplicate / failed)
    而且 同一組公司 10 分鐘內再按回 409 PORTAL_ESH_NOTIFY_TOO_SOON
    而且 通知紀錄只列與本人管理公司有交集的執行,公司範圍只顯示本人管理的公司,別人發起或排程的執行不顯示執行者與彙總

  @auto
  場景: 排程每週一執行一次
    當 台灣時間週一 08:00 後排程檢查(ESH_NOTIFY_WEEKDAY / ESH_NOTIFY_HOUR 可改)
    那麼 對全部公司執行一次通知,run_key = notify-weekly-<週一日期>
    而且 同一週再檢查不重複執行(重啟或多個執行個體也一樣);上次失敗可重跑

  @auto
  場景: 需求為 0 或未設定的證照不通知
    假如 持證人的證照在該公司沒有需求或需求為 0(同舊版 INNER JOIN LicenseBInfo AND LicenseCount <> 0)
    那麼 不通知;主管就是本人時不重複寄

  @auto
  場景: Gateway 通知中心介面
    當 ESH_NOTIFY_MODE=gateway
    那麼 以 X-Api-Key 呼叫 POST /api/notify/send,to.users = [工號](不寫死信箱網域、不寄群組信箱)
    而且 202 queued > 0 記 queued、queued = 0 記 skipped(查無 Email)、200 DUPLICATE_REQUEST 記 duplicate、其他回應記 failed

  @auto
  場景: 單封失敗不中斷其他收件人
    當 其中一封寄送失敗
    那麼 其他收件人照常寄送,失敗的紀錄寫入錯誤訊息

  @auto
  場景: 排程器
    當 未到設定時間
    那麼 不執行;到時間後同一期只執行一次

  @auto
  場景: 寄送方式與排程設定
    那麼 預設 dry-run、dev 不排程;gateway 模式缺 GW_BASE_URL 或 API Key 時啟動失敗;設定值超出範圍啟動失敗

  @manual
  場景: 測試區實際寄送驗收
    假如 Gateway 已建立三個範本、portal-api 的 API Key 具 notify.message.send,且 portal.env 設 ESH_NOTIFY_MODE=gateway
    當 以測試帳號按「立即通知」
    那麼 Gateway 測試區把 Email 改寄測試信箱(harryjiang@gigasolar.com.tw),通知紀錄顯示 queued
