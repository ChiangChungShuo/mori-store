# mori 童裝商城

面向 0–12 歲孩子的 Next.js 童裝商城。

## 開始使用

建議使用 Node.js 22 LTS；最低支援 Node.js 20.9。另需 pnpm 與一個專用的 Supabase 開發／測試專案。

```bash
pnpm install
cp .env.example .env.local
pnpm dlx supabase@latest link --project-ref YOUR_PROJECT_REF
pnpm dlx supabase@latest db push
pnpm dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

環境變數、第一位管理員、範例商品與 E2E 準備方式請見[本機設定指南](docs/local-setup.md)。測試付款只會模擬成功、失敗或取消，不會連到真實金流，也不會扣款。

## 驗證

```bash
pnpm vitest run && pnpm lint && pnpm build && pnpm playwright test
```

第一次執行 E2E 前先安裝瀏覽器：`pnpm exec playwright install chromium`。完整流程規格另需本機設定指南列出的測試帳號與 seed 資料；缺少時，對應規格會明確標示 skip。
