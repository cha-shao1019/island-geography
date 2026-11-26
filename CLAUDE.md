# island-geography

高中地理＋地球科學互動網站：一座程序生成的 3D 島嶼（本島＋火山離島），捲動導覽＋自由探索。

## 結構
- `lib/terrain/terrain.js`：地形產生演算法（純函式，建置腳本與瀏覽器共用）
- `scripts/build-terrain.mjs`：`prebuild`/`predev` 自動執行，輸出 `public/terrain/`（不進 git）
- `lib/world.js`：載入地形資料、計算地形特徵點（標記用字串鍵指向這裡）
- `lib/engine/`：three.js 引擎（命令式），React 只透過 `createEngine` 的 API 操作
- `content/zones.ts`：所有區域、標記、筆記文字。改內容只改這裡
- `store/island.ts`：zustand 狀態；`components/IslandApp.tsx` 負責把狀態同步給引擎
- `app/explore/[zone]`：每個區域有自己的網址

## 規則
- 介面文字一律繁體中文（臺灣用語）。
- 標記位置若依賴地形細節（河道、階崖等），在 `lib/world.js` 的 `features()` 計算，內容裡用字串鍵引用。
- 每次推送，GitHub Actions 會建置並用軟體 WebGL 逐區截圖（artifact: shots）。改 3D 後要看截圖與 `shots/console.txt`。
- 動畫函式放進 `ctx.live`，簽名 `(t, dt)`；曲線參數一律包成 0–1（`((u%1)+1)%1`）。
