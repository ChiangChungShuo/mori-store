# mori 本機設定

本指南使用連到 Supabase hosted project 的開發流程。請只連專用的開發／測試 project，不要在 production project 執行 seed 或測試付款。

## 需求

- 建議 Node.js 22 LTS，最低 Node.js 20.9。專案目前仍可在 Node 20 build，但 `@supabase/supabase-js` 會顯示 Node 20 deprecation warning，因此日常開發使用 Node 22 可避免即將到來的相容性問題。
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

Playwright 會自動啟動 `http://127.0.0.1:3000`，並執行 1440×900 desktop 與 375×812 mobile projects。首頁、商品、購物袋與結帳的響應式驗收需要已完成 migration 與 seed。

既有完整購物流程規格還需要把下列值 export 到執行 Playwright 的同一個 shell；請使用測試帳號，不要使用 production 密碼：

```bash
export E2E_BASE_URL=http://127.0.0.1:3000
export E2E_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
export E2E_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
export E2E_CUSTOMER_EMAIL=YOUR_CUSTOMER_EMAIL
export E2E_CUSTOMER_PASSWORD=YOUR_CUSTOMER_PASSWORD
export E2E_GUEST_VARIANT_ID=YOUR_SEEDED_VARIANT_UUID
export E2E_MEMBER_VARIANT_ID=YOUR_SEEDED_VARIANT_UUID
export E2E_PAID_ORDER_NUMBER=YOUR_EXISTING_PAID_ORDER_NUMBER
```

在 Dashboard **SQL Editor** 查 seed variant UUID：

```sql
select id, sku, stock
from public.product_variants
where sku = 'MORI-TEE-SAGE-100';
```

`E2E_PAID_ORDER_NUMBER` 必須是測試付款成功後、狀態仍為 `paid` 的測試訂單；可從完成頁 URL 或管理後台取得。未提供某組 E2E 變數時，對應的 credential-dependent 規格會顯示 skip，不代表該完整流程已通過。

## 7. 人工驗收清單

連上已 migration、seed 且完成帳號設定的 Supabase 開發／測試 project，執行 `pnpm dev` 後逐項記錄結果：

1. 管理員建立並上架一個多規格商品。
2. 訪客使用 7-ELEVEN 門市完成結帳。
3. 會員使用全家門市完成結帳，並在訂單紀錄看到該訂單。
4. 對同一次成功付款重送結果，訂單不重複建立，庫存不重複扣減。
5. 管理員依序把訂單更新為備貨中、已出貨、已取貨。
6. 1440 px desktop 與 375 px mobile 都完成相同主要流程。

沒有可連線的 Supabase project、三組環境變數、seed、測試帳號與瀏覽器時，不能把上述人工或 live E2E 項目記為通過。
