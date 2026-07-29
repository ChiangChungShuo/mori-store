# Email 驗證碼正式上線設定

本機 `MORI_E2E_FIXTURES=1` 使用固定驗證碼 `123456`，不會寄出 Email。以下設定只用於正式環境。

## 1. 準備寄信網域

1. 在 Resend 或其他支援 SMTP 的寄信服務建立帳號。
2. 新增商城寄信網域，例如 `mori.tw`。
3. 依服務商指示，在 DNS 新增 SPF、DKIM 等驗證記錄。
4. 等待網域狀態顯示已驗證，再設定寄件人，例如 `no-reply@mori.tw`。

## 2. 設定 Supabase SMTP

進入 Supabase Dashboard：

1. 開啟 `Authentication > Emails > SMTP Settings`。
2. 啟用自訂 SMTP。
3. 填入服務商提供的 SMTP host、port、username、password。
4. Sender Email 填已驗證網域的寄件地址。
5. Sender Name 可填 `MORIMUR BABY`。

SMTP 密碼只存放在 Supabase Dashboard，不要寫入程式碼、`.env.example` 或 Git。

## 3. 設定驗證碼信件

在 `Authentication > Emails > Templates` 編輯 Magic Link／OTP 使用的 Email 範本：

- 主旨：`你的 MORIMUR BABY 註冊驗證碼`
- 內容清楚顯示六位數代碼 `{{ .Token }}`
- 不要只留下 Magic Link 按鈕
- 提醒客戶若未申請註冊，可以忽略信件

## 4. 套用資料庫 migration

正式啟用新註冊頁前，先套用：

```text
supabase/migrations/202607280001_profile_contact_consent.sql
supabase/migrations/202607280002_unique_profile_phone.sql
```

套用後確認 `profiles` 已有：

- `phone`
- `terms_accepted_at`

## 5. 安全與寄送限制

- 保留同一 Email 60 秒才能重寄一次。
- 在 Supabase `Authentication > Rate Limits` 設定可接受的每小時寄信上限。
- 公開上線前啟用 CAPTCHA，避免機器人大量消耗寄信額度。
- 不要在正式環境設定固定 OTP。
- 不要記錄驗證碼、密碼、SMTP 密碼或 Supabase Secret Key。

## 6. 上線前驗收

1. 分別用 Gmail 與另一家 Email 服務測試收信。
2. 確認信件內容可清楚看到六位數驗證碼。
3. 測試錯誤碼、過期碼及 60 秒重寄限制。
4. 檢查垃圾郵件匣與寄件人名稱。
5. 驗證完成後，用剛設定的 Email 與密碼重新登入。
6. 從老闆後台會員管理確認手機號碼正確保存。
7. 登出後，再用註冊手機號碼與相同密碼登入。

手機登入由伺服器使用 `SUPABASE_SECRET_KEY` 查找會員 Email，再交給 Supabase Auth 驗證密碼；Secret Key 不會傳到瀏覽器。手機號碼設為唯一，避免登入時對應到多個帳號。
