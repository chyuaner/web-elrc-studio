# Enhanced LRC Studio - Tauri Integration Guide

此指南提供了將「Enhanced LRC Studio」前端整合到 Tauri 應用程式時所需的重要參考資訊。我們已經針對 Tauri 桌面版環境做好了相關的準備與抽象化。

## 1. 色彩變數 (CSS Variables)

應用程式的色彩主題皆已抽取為 CSS Variables，定義在 `app/globals.css` 中。你可以透過動態修改根節點 (`:root`) 的變數值來實現深淺色主題或自訂主題的切換。

```css
:root {
  --app-bg-base: #0f1115; /* 應用程式主背景 */
  --app-bg-panel: #1a1d23; /* 頂部/面板背景 */
  --app-bg-panel-alt: #16191e; /* 側邊欄/預覽區背景 */
  --app-bg-input: #08090c; /* 輸入框背景 */
  --app-bg-hover: #3d444d; /* hover 狀態背景 */
  --app-border-base: #2d333b; /* 邊框基底色 */
  --app-border-light: #444c56; /* 亮部邊框色 */
  --app-text-primary: #ffffff; /* 主要文字色 */
  --app-text-secondary: #e0e0e0; /* 次要文字色 */
  --app-text-muted: #7d8590; /* 靜音/輔助文字色 */
  --app-accent: #f27d26; /* 強調色 (橘) */
  --app-accent-hover: #e26d16; /* 強調色 hover */

  /* 作業系統原生視窗控制按鈕預留空間 */
  --titlebar-left-padding: 0px;
  --titlebar-right-padding: 0px;
}
```

## 2. OS 視窗控制按鈕預留空間

為了讓 Tauri 的無邊框視窗 (Frameless Window) 原生視窗控制按鈕 (如 macOS 的紅綠燈或 Windows 的關閉按鈕) 不會遮擋到頂部工具列 UI，已經在 `TopToolbar` 的最左側與最右側加入了預留空間。

你只需在 Tauri 啟動時或前端載入時，根據作業系統設定 CSS 變數即可自動推開 UI：

```javascript
// 在 Tauri 中，如果是 macOS，為左側設定預留空間；若是 Windows，為右側設定。
document.documentElement.style.setProperty("--titlebar-left-padding", "70px"); // 例如 macOS
// document.documentElement.style.setProperty('--titlebar-right-padding', '120px'); // 例如 Windows
```

此外，頂部工具列已經使用了可以被拖曳的 `app-region-drag` class，你可以在你的 global CSS 內進一步加上 Tauri 特定的拖曳宣告 (如果版本需要的話):

```css
/* Tauri drag region 範例 */
.app-region-drag {
  -webkit-app-region: drag; /* 讓特定區域可以被原生系統拖動 */
}
```

## 3. Tauri 呼叫的核心動作 (AppCommands)

為了讓從 Tauri 後端或原生選單 (原生 OS Menu) 能夠輕易觸發 Web 前端的核心動作，我們已經將動作提取到 `lib/app-commands.ts`，並在前端 React 初始渲染時將其實作綁定於全域物件 `window.AppCommands`。

在此模式下，Tauri 可以直接透過執行 JavaScript `window.AppCommands.xxx()` 來呼叫核心功能：

### 可用的指令清單 (`window.AppCommands`)：

- **媒體與檔案操作：**
  - `loadMedia()`: 開啟讀取音樂檔案的對話框。
  - `loadLyrics()`: 開啟讀取歌詞檔案的對話框。
  - `clearMedia()`: 清除目前載入的媒體檔案。
  - `clearLyrics()`: 清除目前載入的歌詞。
  - `loadEmbeddedLyrics()`: 載入音檔中內嵌的歌詞。

- **復原與重做 (Undo / Redo)：**
  - `undo()`: 執行單步復原。
  - `redo()`: 執行單步重做。
  - `getUndoList()`: 取得目前的復原歷史清單，回傳 `{id: string, name: string}[]`。可以用來同步更新狀態給 Tauri 渲染原生 Menu 內的歷史紀錄。
  - `getRedoList()`: 取得目前的重做歷史清單。
  - `undoToSequence(steps: number)`: 復原 `steps` 次。
  - `redoToSequence(steps: number)`: 重做 `steps` 次。

- **匯出及其他工具：**
  - `exportStandard()`: 觸發標準 LRC (.lrc) 匯出動作。
  - `exportEnhanced()`: 觸發加強版 (字級時間軸) LRC (.lrc) 匯出動作。
  - `shiftTime()`: 開啟全域時間平移調整對話框。

### Tauri 呼叫範例 (Rust 呼叫 Web)：

```rust
// 觸發前端載入音檔對話框
window.eval("if (window.AppCommands && window.AppCommands.loadMedia) window.AppCommands.loadMedia();");

// 執行復原
window.eval("if (window.AppCommands && window.AppCommands.undo) window.AppCommands.undo();");
```

---

此設計將視圖邏輯、狀態管理與外部控制邏輯拆分，為未來跨平台與桌面端封裝提供最高彈性！
