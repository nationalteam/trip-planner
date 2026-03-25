# trip-planner

AI 驅動的協作行程規劃工具，支援提案投票、自動行程排程與地圖視覺化。

## 功能特色

- 根據旅行者偏好，由 AI 自動生成地點與餐廳提案
- 協作式審核流程：可核准或拒絕每則提案
- 從核准的提案自動建立每日行程
- 以 OpenStreetMap 顯示核准地點的地圖視圖
- 支援每位旅行者設定個人偏好（喜好、不喜好、預算）

## 技術架構

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 15（App Router、TypeScript） |
| 樣式 | Tailwind CSS |
| 資料庫 | SQLite（透過 Prisma ORM + `better-sqlite3` 驅動） |
| LLM | OpenAI `gpt-5-mini`（預設），可選用 Azure OpenAI / Bifrost |
| 地圖 | Leaflet / react-leaflet / OpenStreetMap |
| 測試 | Jest + Testing Library |

## 快速開始

### 1. 安裝相依套件

```bash
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
# 填入 OPENAI_API_KEY=...
```

選用：覆寫非 Azure OpenAI 的模型。

```env
OPENAI_MODEL=gpt-5-mini
```

選用：改用 Azure OpenAI。

```env
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2025-01-01-preview
```

選用：改用 Bifrost OpenAI 相容 API。

```env
LLM_PROVIDER=bifrost
BIFROST_BASE_URL=http://127.0.0.1:8080
# BIFROST_API_KEY=optional-api-key
```

行為說明：

- 若設定了 `LLM_PROVIDER`（`openai`、`azure`、`bifrost`），則使用指定的提供者。
- 未設定 `LLM_PROVIDER` 時，會依以下順序自動偵測：OpenAI（`OPENAI_API_KEY`）→ Azure（`AZURE_OPENAI_API_KEY`）→ Bifrost（`BIFROST_BASE_URL` 或 `BIFROST_API_KEY`）。
- Bifrost 使用 OpenAI 相容 API，透過 `BIFROST_BASE_URL` 存取。
- `BIFROST_BASE_URL` 接受純主機值（例如 `http://192.168.1.200:8080`），並會自動補全為 `/openai/v1`。
- 未設定 `BIFROST_BASE_URL` 時，預設為 `http://127.0.0.1:8080/openai/v1`。
- `BIFROST_API_KEY` 為選填，未設定時預設為空字串。
- Bifrost 模型選擇使用 `OPENAI_MODEL`（預設 `gpt-5-mini`）。

各提供者的錯誤處理：

- Bifrost 認證錯誤（`401/403`）：回傳清楚的 `BIFROST_API_KEY` 提示訊息。
- Bifrost 端點錯誤（`404`、連線失敗）：回傳清楚的 `BIFROST_BASE_URL`/網路相關提示訊息。
- Bifrost 速率限制與伺服器錯誤（`429`、`5xx`）：回傳建議重試的提示訊息。

### 3. 建立資料庫

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:9527](http://localhost:9527)。

## 腳本指令

```bash
npm run dev      # 啟動開發伺服器
npm run build    # 正式環境建置
npm run start    # 啟動正式伺服器
npm run lint     # ESLint 檢查
npm run test     # Jest 測試
npm run test:ci  # Jest（CI 模式 + 覆蓋率報告）
```

## 持續整合（CI）

GitHub Actions 工作流程（`.github/workflows/ci.yml`）執行以下步驟：

1. `npm ci`
2. `npx prisma generate`
3. `npm run lint`
4. `npm run test:ci`
5. `npm run build`（使用佔位用的 `OPENAI_API_KEY`）

本地執行相同的 CI 檢查：

```bash
just ci
```

## 專案結構

```
src/
  app/
    page.tsx                      # 首頁 – 列表與建立行程
    trips/[id]/page.tsx           # 行程詳情（活動 / 行程 / 地圖 分頁）
    trips/[id]/preferences/       # 每位旅行者的偏好管理
    api/                          # REST API 路由
      trips/                      # 行程 CRUD
      activities/[id]/approve|reject
      users/                      # 使用者與偏好 CRUD
  components/
    ActivityCard.tsx              # 活動卡片（含核准/拒絕按鈕）
    ItineraryView.tsx             # 依時段分組的每日行程視圖
    MapView.tsx                   # Leaflet 地圖（純客戶端）
    TripCard.tsx                  # 行程摘要卡片
  lib/
    prisma.ts                     # Prisma 客戶端單例
    llm.ts                        # OpenAI/Azure OpenAI 活動生成
prisma/
  schema.prisma                   # 資料模型定義
```

## 資料模型

| 實體 | 主要欄位 |
|---|---|
| `Trip` | `name`、`cities`（JSON 陣列） |
| `User` | `name` |
| `Preference` | `userId`、`likes`、`dislikes`、`budget` |
| `Activity` | `tripId`、`type`、`title`、`description`、`reason`、`lat/lng`、`city`、`suggestedTime`、`durationMinutes`、`status` |
| `ItineraryItem` | `tripId`、`activityId`、`day`、`timeBlock`（`morning`／`afternoon`／`dinner`） |

## 示範網站（GitHub Pages）

每次推送至 `main` 分支時，會透過 `.github/workflows/deploy-pages.yml` 自動部署示範預覽頁面至 GitHub Pages。

- 預覽網址：<https://nationalteam.github.io/trip-planner/>
- 手動部署：在 GitHub Actions 執行 **Deploy demo site to GitHub Pages**

## 使用 Docker 執行

```bash
cp .env.example .env
# 填入 OPENAI_API_KEY 或 AZURE_OPENAI_* 變數

docker compose up --build
```

開啟 [http://localhost:9527](http://localhost:9527)。
