# language: zh-TW
@P6
功能: ESH 證照管理(儀表板、證照項目、證照需求、人員證照、證照管理員)
  為了掌握各公司法定證照是否足夠、持證人何時需要複訓
  身為 ESH 證照管理員(角色 portal-esh-admin,成員來源 LicenseManagerInfo)
  我要只看到並維護自己管理公司的證照資料

  # FEATURE-PLAN §8;PORTAL-API-PLAN §4 P6。舊程式 EHS/EHManagement、EHItemEdit、EHLicenseNeed、EHLicense、EHManagerSetup
  # (As-Is:old_PortalSolar/docs/behavior/esh/esh_license.feature)。舊表 PortalSolar License*、LOS RankInfo 與舊入口網共用(D-7)。
  # 新表(migration 20261023034541_p6_esh):portal.esh_license_logo、esh_license_doc(file-service UUID)。
  # 測試:backend/test/esh.test.ts、test/int/p6.int.test.ts;frontend/test/esh.test.ts。

  背景:
    假如 管理員 S100001 具角色 "portal-esh-admin",LicenseManagerInfo 只有公司 "碩禾"
    而且 "國碩" 由其他管理員管理

  @auto
  場景: 非管理員直接開證照頁
    當 不具 portal-esh-admin 的員工呼叫任何 /api/portal/esh 證照 API
    那麼 回應 403 PORTAL_DATA_ACCESS_DENIED(舊版後端不檢查)
    而且 具角色但不在 LicenseManagerInfo 者:儀表板公司清單為空,證照項目與所有寫入回 403

  @auto
  場景: 公司證照符合度
    當 開啟「證照管理」(GET /api/portal/esh/dashboard?company=碩禾)
    那麼 每個證照需求顯示應有張數、有效張數(在職、未刪除、下次複訓日 ≥ 今天)、符合度 = 有效 × 100 / 應有(整數除法,應有 0 時分母 1)
    而且 有效 < 應有 為「待改善」,可依「全部 / 待改善 / 符合規定」篩選
    而且 指定 "國碩" 回 403 PORTAL_DATA_ACCESS_DENIED

  @auto
  場景: 查看某證照的持證人
    當 按「查看有效持證人」
    那麼 列出該公司此證照的有效持證人與證照文件(新站 file-service 影本、舊站 EHS/License 檔名連結)

  @auto
  場景: 維護證照項目
    當 新增證照項目(名稱、有效期 1~600 個月或永久、描述 HTML)
    那麼 名稱去頭尾空白、不可空白、不可含 < >;啟用中同名回 409 PORTAL_ESH_ITEM_DUPLICATE
    而且 描述以白名單清洗後才寫入 LicenseInfo.Script;清洗後仍含單引號或 &lt; &gt; &quot; 等實體回 400(舊站 HtmlDecode 後原樣輸出)
    而且 永久寫入 ActiveYear = 9999999(同舊資料)

  @auto
  場景: 編輯時也檢查重名
    當 把項目改成另一個啟用中項目的名稱
    那麼 回應 409 PORTAL_ESH_ITEM_DUPLICATE(舊版編輯不檢查)
    當 刪除仍有公司需求或啟用中持證人的項目
    那麼 回應 409 PORTAL_ESH_ITEM_IN_USE;沒有使用時軟刪除(IsActive = 0)

  @auto
  場景: 上傳證照 Logo
    當 選擇圖片上傳到 file-service(refType portal-esh-logo)並登記
    那麼 項目顯示新 Logo(優先於舊站 LogoPath);非圖片副檔名或檔案編號格式錯誤回 400

  @auto
  場景: 維護公司證照需求
    當 新增公司 × 證照 × 需求張數(整數 ≥ 0)與備註
    那麼 同公司同證照已存在回 409 PORTAL_ESH_NEED_DUPLICATE;範圍外公司回 403;不存在的證照回 404

  @auto
  場景: 刪除需求不影響持證人員
    當 刪除某公司某證照的需求(同舊版硬刪)
    那麼 人員證照清單仍列出此證照的持證人(舊版以 INNER JOIN 需求表,持證人會消失)

  @auto
  場景: 人員證照清單
    當 開啟「人員證照登記」
    那麼 預設列出啟用中、在職、通知天數 ≠ 0 的持證資料;「含歷史」含已刪除與離職;「無需追蹤」只列通知天數 = 0
    而且 每列狀態:已離職 / 未設定複訓日 / 已失效(距下次複訓 < 0)/ 需通知(0 ≤ 距下次複訓 < 通知天數)/ 有效,並顯示距下次複訓天數

  @auto
  場景: 新增人員證照
    當 輸入工號、證照、公司、取得日 2026-10-02(有效期 36 個月)與通知天數
    那麼 下次複訓日由後端計算為 2029-10-01(初訓 / 取得 / 複訓日最晚者 + 有效期 − 1 天,月底對齊)
    而且 工號離職或查無 LOS 人事資料回 400 PORTAL_ESH_EMP_NOT_ACTIVE;同人同證照同公司已有啟用中紀錄回 409 PORTAL_ESH_HOLDER_DUPLICATE
    而且 只有已刪除的同一筆時復原該筆並更新日期

  @auto
  場景: 更新人員證照與下次複訓日
    當 修改日期或通知天數
    那麼 下次複訓日由後端重算(不採用前端送來的值);公司只能改到範圍內的公司
    而且 已刪除的紀錄不可更新(舊版一律寫 IsActive = 1 會復活)

  @auto
  場景: 證照影本經 file-service
    當 上傳證照影本(pdf / jpg / png,refType portal-esh-license,refNo = 人員證照 ID)
    那麼 登記於 portal.esh_license_doc,不會覆蓋其他人的同名檔案(舊版存同一目錄同名覆蓋)
    而且 舊站影本(LicenseFileC)以舊入口網網址唯讀顯示,刪除時須與該人員工號相符

  @auto
  場景: 維護證照管理員
    當 新增管理員(公司在範圍內、工號在職、不重複)或切換「收複訓通知」
    那麼 成功;重複回 409 PORTAL_ESH_MANAGER_DUPLICATE;新增到範圍外公司回 403
    而且 新管理員另需 IT 指派角色 portal-esh-admin 才看得到選單

  @auto
  場景: 不可刪除最後一位管理員
    假如 公司只剩一位管理員
    當 刪除該管理員
    那麼 回應 409 PORTAL_ESH_MANAGER_LAST

  @auto
  場景: API 權限代碼
    那麼 每支 /api/portal/esh API 的 x-permission 都已宣告;寫入 API 為 .edit / .send 權限,等於前端按鈕 includes
    而且 系統呼叫(API Key)沒有員工身分回 403

  @manual
  場景: 測試區畫面驗收
    當 以 portal-esh-admin 且在 LicenseManagerInfo 的帳號開啟 ESH 五頁
    那麼 公司下拉只有本人管理的公司;新增 / 修改後舊入口網 EHS 頁看得到同一筆資料(Logo / 新影本除外)
    而且 四種風格組合與 375px 寬度表格在卡片內捲動
