// lib/i18n.ts
export const defaultI18n = {
  // Top Toolbar
  loadMedia: "載入媒體",
  clearMedia: "關閉媒體",
  loadLyrics: "載入歌詞",
  loadFileLyrics: "載入外部 .lrc 歌詞檔案",
  clearLyrics: "關閉歌詞",
  loadEmbeddedLyrics: "載入音檔內嵌的歌詞標籤",
  exportStandard: "標準LRC (逐行同步)",
  exportEnhanced: "增強型LRC (ESLYRIC - 逐字同步)",
  exportSimple: "簡易歌詞 (無時間戳)",
  exportLrc: "匯出 .LRC",
  saveLyric: "儲存歌詞檔案",
  saveAss: "儲存 ASS 字幕檔案",
  savedTo: "已儲存至 ",
  shiftTime: "平移時間轴",
  audio: "音檔",
  lyrics: "歌詞",
  noAudio: "無音檔",
  noLyrics: "無歌詞",
  embeddedTag: "內嵌標籤",
  export: "匯出",

  // Dialogs
  confirmDiscardMedia: "確定要捨棄目前的媒體檔案嗎？",
  confirmDiscardLyrics: "確定要捨棄目前的歌詞嗎？",
  confirmEmbeddedLyrics: "載入內嵌歌詞將會捨棄目前的歌詞。是否繼續？",
  promptShiftTime: "將接下來的時間軸平移 X 秒 (例如 0.5 或 -1.2)：",

  // Editor View
  tabText: "編輯原始文字",
  tabSync: "動態歌詞編輯",
  tabDualSync: "雙行動態歌詞編輯",
  tabRaw: "預覽",

  // Left Panel
  tabMetadata: "音樂資訊",
  tabInstructions: "操作說明",
  titleInfo: "標題",
  artistInfo: "演出者",
  albumInfo: "專輯",
  yearInfo: "年份",
  trackInfo: "音軌",
  commentInfo: "註解",
  otherTagsInfo: "其他標籤",
  howToSyncTitle: "同步教學",
  keyboardShortcutsTitle: "快捷鍵",
  step1: "步驟 1：",
  step1Text: "載入您的音訊/視訊檔案。",
  step2: "步驟 2：",
  step2Text: "手動載入您的 `.txt` 或 `.lrc` 檔案，或點擊「文字編輯器」分頁以貼上它們。",
  step3: "步驟 3：",
  step3Text: "切換到",
  step3SyncEditor: "同步編輯器",
  step3Text2: "。等待格式化完成。",
  step4: "步驟 4：",
  step4Text1: "播放音訊。按下",
  step4Space: "空白鍵",
  step4Text2: "來為作用中的單字或句子打點標記時間戳。",
  step5: "步驟 5：",
  step5Text: "檢查雙行預覽。完成後即可匯出！",
  undoLabel: "復原",
  redoLabel: "重做",
  playPauseLabel: "播放 / 暫停音訊",
  seekBackwardLabel: "快退 5 秒",
  seekForwardLabel: "快轉 5 秒",
  skipToLabel: "跳到 0%~90%",
  stampLabel: "打點標記 字/句",
  advanceLineLabel: "提前換行",
  advanceLineSub: "(逐字模式)",
  noMetadata: "尚未載入資訊。請載入音檔以讀取 ID3 標籤。",

  // Sync Editor
  syncModeLine: "行同步",
  syncModeWord: "逐字同步",
  timeMode: "時間",
  actionMode: "操作",
  autoScroll: "自動捲動",
  autoJump: "自動跳轉",
  timestampWords: "打點",
  nextLine: "換行",
  leftTrack: "左軌",
  rightTrack: "右軌",
  offsetSubsequent: "平移後續時間",
  lineByLine: "行同步",
  wordByWord: "逐字同步",
  gapToggledAt: "間距閾值：",
  sec: "秒",
  lineTrigger: "行觸發",
  wordTrigger: "字觸發",
  lineAdvance: "換行",
  time: "時間",
  lyricsContentEnhanced: "歌詞內容 (加強模式)",
  action: "操作",
  editText: "編輯文字",
  clearTimestamps: "清除時間戳",
  deleteLine: "刪除行",
};

export type I18nDict = typeof defaultI18n;

let currentI18n: I18nDict = { ...defaultI18n };

export const AppI18n = {
  get: () => currentI18n,
  set: (newI18n: Partial<I18nDict>) => {
    currentI18n = { ...currentI18n, ...newI18n };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-i18n-update"));
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).AppI18n = AppI18n;
}
