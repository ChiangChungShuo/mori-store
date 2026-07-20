# mori 童裝商城

面向 0–12 歲孩子的 Next.js 童裝商城。

## 開始使用

需要 Node.js 22 或更新版本與 pnpm。Live 資料流程另需一個專用的 Supabase 開發／測試專案。

```bash
pnpm install
cp .env.example .env.local
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
pnpm dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

若目前沒有 Supabase，可直接用 `MORI_E2E_FIXTURES=1 pnpm dev` 開啟完整本機展示流程。環境變數、本機老闆帳號、第一位正式管理員、範例商品與 E2E 準備方式請見[本機設定指南](docs/local-setup.md)。測試付款只會模擬成功、失敗或取消，不會連到真實金流，也不會扣款。

## 驗證

```bash
pnpm vitest run && pnpm lint && pnpm build && pnpm playwright test
```

第一次執行 E2E 前先安裝瀏覽器：`pnpm exec playwright install chromium`。預設 E2E 使用只限本機 Playwright server 的 deterministic fixtures；完整 live 流程另需本機設定指南列出的 Supabase 測試帳號與 seed 資料，缺少時對應規格會明確標示 skip。
