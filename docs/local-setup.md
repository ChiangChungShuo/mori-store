# mori 本機設定

本指南使用連到 Supabase hosted project 的開發流程。請只連專用的開發／測試 project，不要在 production project 執行 seed 或測試付款。

## 不需 Supabase 的本機展示模式

只想先在這台電腦查看完整商城、會員與老闆後台時，不需要建立 Supabase 專案：

```bash
pnpm install
MORI_E2E_FIXTURES=1 pnpm dev
```

1. 開啟 `http://127.0.0.1:3000/login?next=/admin`。
2. 使用 `admin@mori.tw` / `mori123456` 登入。
3. 在 `/admin/orders` 查看顧客完成測試付款後建立的訂單。

顧客可在 `/signup` 自行註冊並完成測試下單。本機帳號與新訂單只保存在記憶體，開發伺服器重新啟動後會重置；正式環境不會啟用展示資料，仍使用 Supabase。

## 需求

- Node.js 22 或更新版本。Repository 的 `engines.node` 與 `.nvmrc` 都以 Node 22 為最低 runtime。
- pnpm。
- 一個 Supabase 開發／測試 project，以及可 link 該 project 的帳號。

## 1. 安裝與啟動

在 repository 根目錄依序執行：

```bash
pnpm install
cp .env.example .env.local
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
pnpm dev
```

如果 CLI 尚未登入，先執行 `pnpm dlx supabase@latest login`。`YOUR_PROJECT_REF` 是 Supabase Dashboard project URL 中的 project ref；`link` 可能要求輸入該 project 的 database password。`db push` 會套用 `supabase/migrations/`，不會清空既有資料。

## 2. 設定 `.env.local`

在 Supabase Dashboard 開啟 project：

1. 從右上角 **Connect** 對話框複製 **Project URL**，填入 `NEXT_PUBLIC_SUPABASE_URL`。
2. 到 **Settings → API Keys**，複製 **Publishable key**（`sb_publishable_...`），填入 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
3. 在同一頁建立或複製 **Secret key**（`sb_secret_...`），填入 `SUPABASE_SECRET_KEY`。

完成後的檔案格式：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
```

Publishable key 會送到瀏覽器，資料存取仍由 RLS 保護。Secret key 會繞過 RLS，只能放在 server-side `.env.local`；不要提交、貼到 issue，或使用 `NEXT_PUBLIC_` 前綴。詳見 [Supabase API key 文件](https://supabase.com/docs/guides/getting-started/api-keys)。修改環境變數後要重新啟動 `pnpm dev`。

## 3. Seed 範例商品

`supabase/seed.sql` 會建立已上架的「有機棉小樹 T 恤」、兩個尺寸與運費設定。對全新的開發／測試 project 執行：

```bash
pnpm dlx supabase@latest db push --include-seed
```

這個 seed 可重複執行，不會重複建立相同 slug 或 SKU。`--include-seed` 只用於開發／測試，不能對 production 執行；相關 CLI 行為見 [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)。啟動網站後到 `http://localhost:3000/products/mori-organic-cotton-tee` 確認商品可見。

## 4. 建立第一位管理員

1. 啟動 `pnpm dev`，到 `http://localhost:3000/signup` 註冊第一個帳號；若 project 啟用了 email confirmation，先完成驗證。
2. 在 Supabase Dashboard 開啟 **SQL Editor**。
3. 只有在全新的開發／測試 project，執行以下 SQL，把建立時間最早的 profile 設為管理員：

```sql
with first_profile as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
)
update public.profiles
set role = 'admin'
where id = (select id from first_profile)
returning id, display_name, role;
```

確認結果正好一列且 `role` 是 `admin`，重新登入後開啟 `http://localhost:3000/admin`。若 project 已有其他使用者，不要用「第一筆」SQL；改以 `auth.users` 中確認過的 email 找到 UUID，再只更新對應的 `public.profiles.id`。

## 5. 測試付款

結帳頁的「前往測試付款」只會進入應用程式內建的付款模擬頁，提供成功、失敗與取消結果。它沒有連接第三方 payment provider、信用卡或銀行，因此不會產生任何真實扣款。只在開發／測試 project 使用。

## 6. 自動驗證

第一次先安裝 Playwright Chromium：

```bash
pnpm exec playwright install chromium
```

完整驗證可用一個 shell command 執行：

```bash
pnpm vitest run && pnpm lint && pnpm build && pnpm playwright test
```

未設定 `E2E_BASE_URL` 時，Playwright 會自動啟動 `http://127.0.0.1:3000`，並只對該 development web server 設定 `MORI_E2E_FIXTURES=1`。Fixtures 是 server-only catalog、運費與 cart snapshots；production runtime 即使收到同名環境變數也不會啟用。這個預設模式不需要 Supabase，會用 populated data 執行 1440×900 desktop 與 375×812 mobile 的首頁、商品、購物袋及結帳驗收。

要改測已部署或已自行啟動的 live target，在 `.env.local` 填入下列值；Playwright config 會用 Node 22 原生載入該檔，因此之後仍只需執行同一個驗證 command。設定 `E2E_BASE_URL` 後 Playwright 不會另開 web server。請只使用開發／測試 project 與測試帳號，不要使用 production 密碼：

```dotenv
E2E_BASE_URL=https://YOUR_TEST_DEPLOYMENT.example.com
HAS_LIVE_DATA=1
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_REPLACE_ME
E2E_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
E2E_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
E2E_CUSTOMER_EMAIL=YOUR_CUSTOMER_EMAIL
E2E_CUSTOMER_PASSWORD=YOUR_CUSTOMER_PASSWORD
E2E_GUEST_VARIANT_ID=YOUR_SEEDED_VARIANT_UUID
E2E_MEMBER_VARIANT_ID=YOUR_SEEDED_VARIANT_UUID
```

`HAS_LIVE_DATA=1` 是明確的 live-data opt-in；只有 URL 不會讓 data-dependent specs 誤判為可執行。`SUPABASE_SECRET_KEY` 只由 Playwright 的 Node.js test process 用來建立 fulfillment fixture，不會傳進 `page.evaluate`、browser storage 或 client bundle。

在 Dashboard **SQL Editor** 查 seed variant UUID：

```sql
select id, sku, stock
from public.product_variants
where sku = 'MORI-TEE-SAGE-100';
```

Fulfillment spec 每次會用 server-side secret 建立唯一的 paid guest order、order item 與 payment attempt，再透過管理後台完成狀態流程，不需要手動準備或重複消耗既有訂單。因 `order_items` 有 immutable trigger，測試不強制刪除 fixture；開發／測試 project 會保留 `e2e-fulfillment-...@example.com` 與 `e2e-fulfillment-...` provider reference，方便定期辨識與重建 project。未提供某組 live E2E 變數時，對應規格會顯示 skip，不代表該完整流程已通過。

## 7. 人工驗收清單

連上已 migration、seed 且完成帳號設定的 Supabase 開發／測試 project，執行 `pnpm dev` 後逐項記錄結果：

1. 管理員建立並上架一個多規格商品。
2. 訪客使用 7-ELEVEN 門市完成結帳。
3. 會員使用全家門市完成結帳，並在訂單紀錄看到該訂單。
4. 對同一次成功付款重送結果，訂單不重複建立，庫存不重複扣減。
5. 管理員依序把訂單更新為備貨中、已出貨、已取貨。
6. 1440 px desktop 與 375 px mobile 都完成相同主要流程。

沒有可連線的 Supabase project、三組環境變數、seed、測試帳號與瀏覽器時，不能把上述人工或 live E2E 項目記為通過。
