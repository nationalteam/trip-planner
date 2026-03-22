# 註冊登入與共享權限 v1 實作計畫

## 摘要

- 採用 Email + 密碼 + 顯示名稱 註冊。
- 採用 DB Session + HttpOnly Cookie 管理登入狀態。
- 全站（頁面與 API）改為需登入。
- Trip owner 可分享給其他使用者，v1 權限僅 Owner + Viewer。
- 舊的 /api/users 改為移除，改提供 /api/me。

## 介面與資料變更

- 資料模型（Prisma）

1. User

- 新增 email（unique, required）
- 新增 passwordHash（required）
- name 保留為顯示名稱

2. Session

- id, userId, tokenHash, expiresAt, createdAt
- tokenHash unique（DB 不存明文 session token）

3. TripMember

- tripId, userId, role（owner | viewer）
- unique (tripId, userId)

4. Trip

- 不新增抽象層；擁有者由 TripMember(role=owner) 定義

5. Preference

- 保留既有結構，但 API 改成「只能操作自己」或具 trip 讀取權限時讀取（v1 先鎖為自己）
- 認證 API

1. POST /api/auth/register

- 入參：{ email, password, name }
- 成功：201，建立 user + session，回傳基本 user
- 失敗：409（email 已存在）、400（格式錯誤）

2. POST /api/auth/login

- 入參：{ email, password }
- 成功：200，建立新 session（旋轉 token）
- 失敗：401（帳密錯誤）

3. POST /api/auth/logout

- 行為：刪除當前 session，清 cookie，回 204

4. GET /api/me

- 回傳當前登入者：{ id, email, name }
- 未登入：401
- 共享 API

1. POST /api/trips/[id]/share

- 僅 owner 可呼叫
- 入參：{ email }（被分享者需已註冊）
- 行為：建立 TripMember(role=viewer)，已存在則回 200（idempotent）
- 失敗：403（非 owner）、404（trip 或 user 不存在）
- 權限規則（套用到既有 trips/proposals/itinerary/users-preferences API）

1. 未登入一律 401
2. Trip 相關資源需 TripMember 存在才可讀
3. 只有 owner 可做：刪 trip、分享 trip
4. Viewer 可做：讀 trip、讀 proposals/itinerary/map（v1 不允許寫入）
5. /api/users、/api/users/[id]/preferences 舊路由移除或改為拒絕；改走 /api/me 與 /api/me/preferences

## 實作步驟（依 TDD）

1. 先寫失敗測試（red）

- auth 註冊/登入/登出/me
- 未登入存取受保護 API 回 401
- owner/viewer 權限矩陣
- share API 行為與錯誤碼

2. 最小實作（green）

- 密碼雜湊：Node crypto.scrypt + random salt（不新增依賴）
- session token：隨機值寫入 cookie，DB 存 hash
- 建立共用 requireAuth() 與 requireTripRole() server helper

3. 重構（refactor）
- API route 保持薄層、錯誤碼一致
4. 前端
- layout 顯示登入者與登出按鈕
- 首頁/行程頁未登入導向 /auth
- Trip 詳細頁新增「分享（email）」UI（僅 owner 顯示）
- 因有改程式碼與設定，執行 prek run -a（不可用則 pre-commit run -a）

## 測試案例與驗收

- 註冊成功會自動登入並可呼叫 /api/me
- 錯誤密碼登入回 401，且不設 cookie
- 登出後舊 cookie 無效（任何受保護 API 回 401）
- Owner 可分享 trip 給已註冊 user
- Viewer 可讀 trip，但不能刪 trip、不能分享
- 非成員存取該 trip/proposals/itinerary 回 403 或 404（統一採 403）
- 未登入打 GET /api/trips、POST /api/trips、POST /api/trips/[id]/proposals 皆回 401

## 假設與預設

- 依你決策，v1 不做：忘記密碼、Email 驗證、2FA。
- 共享採「只分享給已註冊帳號 email」，不串外部邀請服務。
- 舊資料採「開發環境重建 DB」策略（不做舊資料自動歸屬遷移）。
- 不新增第三方 auth 套件，遵守現有依賴約束。
