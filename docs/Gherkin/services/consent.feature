# language: zh-TW
@P7
功能: 同意書(臨時服務)
  為了讓人資以連結請同仁簽署各種同意書
  身為 員工
  我要從連結開啟同意書、勾選同意、線上簽名後送出,且同一份只能簽一次

  # FEATURE-PLAN §9、PORTAL-API-PLAN D-8 / P7;舊程式 GSMCConsentX / GSCConsentX(GUID 通用)、GSMCConsent20260814(集保帳號調查)、
  # Consent8、GSCConsent1 / 2、GSMCConsent20220701(As-Is:old_PortalSolar/docs/behavior/unlisted/consents_and_misc.feature)。
  # 資料:PortalSolar ConsentX / ConsentXB(GUID 版)、ConsentCInfo / ConsentBInfo(編號版,指派名單);
  #       portal.consent_def(編號版的期間與型式,migration p7_services)、portal.consent_sign(簽名檔 file-service UUID)。
  # 網址 /services/consent/<GUID 或編號>,不在選單(D-8);讀取 portal.api.svc.consent.read,送出按鈕 portal.svc.consent.sign。

  @auto
  場景: 依 GUID 開啟通用同意書
    假如 ConsentX 有一筆 GUID 同意書,對象為 Kdept = all,期間包含今天
    當 開啟 /services/consent/<GUID>(GET /api/portal/services/consents/<GUID>)
    那麼 顯示標題與內文,內文中的 UserID、UserName、CompFullName 以本人資料取代(HTML 白名單清洗)
    而且 狀態為 open,需勾選「我已閱讀完畢，充分了解並同意簽名。」並線上簽名

  @auto
  場景: 對象以部門完整比對
    假如 同意書 Kdept = "S1800,S1900",Kpep 不含本人
    當 部門 S1810 的同仁開啟
    那麼 回應 403 PORTAL_DATA_ACCESS_DENIED(舊版只比部門代碼第一碼,會誤判)
    當 部門 S1800 的同仁開啟
    那麼 可以簽署

  @auto
  場景: 過期的同意書顯示服務已結束
    假如 同意書 EndDate 早於今天
    當 開啟或送出
    那麼 開啟回應狀態 ended;送出回應 410 PORTAL_SERVICE_ENDED

  @auto
  場景: 勾選與簽名驗證完才寫入
    當 未勾選同意或缺少簽名檔編號就送出
    那麼 回應 400,不寫 ConsentXB
    當 勾選並附上簽名(file-service UUID,sourceApp portal-consent)送出
    那麼 寫入 ConsentXB(GUID、LgNo = 本人工號、ConfirmDate = 今天),舊站看得到已簽
    而且 portal.consent_sign 記錄簽名檔編號;前端以 refType portal-consent 綁定檔案

  @auto
  場景: 後端擋重簽
    假如 本人已簽過此同意書
    當 再次送出(含同時送出兩次)
    那麼 回應 409 PORTAL_CONSENT_SIGNED,ConsentXB 仍只有一筆

  @auto
  場景: 指派名單的集保帳號調查
    假如 ConsentCInfo 指派本人填 20260814 調查,portal.consent_def 期間包含今天
    當 開啟 /services/consent/20260814
    那麼 顯示工號、姓名、身分證字號只顯示末 4 碼(LOS EmployeeInfo)、出生日期
    當 填電話、戶籍地址、通訊地址、集保帳號(去除 - 後須 11 碼數字)送出
    那麼 寫入 ConsentBInfo(ConsentID、LgNo、ConfirmDate、ItemData = "電話;戶籍;通訊;集保帳號",同舊格式)
    而且 回應中集保帳號只顯示末 4 碼
    當 未被指派的同仁開啟
    那麼 回應 403

  @auto
  場景: 首頁待辦列出待簽同意書
    假如 本人有 1 份開放中、未簽的同意書
    當 開啟首頁(GET /api/portal/dashboard)
    那麼 待辦出現「同意書:<標題>」,連結 /services/consent/<編號>
