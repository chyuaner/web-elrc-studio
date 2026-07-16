import { createEffectiveLines } from "./compute-styles";
import { LrcMetadata, LyricLine, parseSeconds, trimASCII } from "./lyric-utils";
import { AssVectorItem, parseSvgToAssVector, scaleAssVectorPath } from "./svg-to-ass-vector";

export interface AssOptions {
  primaryColor: string; // hex
  blueColor?: string; // hex
  color2: string; // hex
  color3: string; // hex
  chorusColor: string; // hex
  orangeColor?: string; // hex
  grayColor?: string; // hex
  fontFamily: string;
  fontSize: number;
  fontSizeOffset?: number;
  songInfoTitle: string;
  songInfoArtist: string;
  songInfoAlbum: string;
  songInfoCustom: string;
  infoFontSize: number;
  infoTitleFontSize: number;
  customStartInfoTime: boolean;
  startInfoStartTime: number;
  startInfoEndTime: number;
  interludeThreshold: number; // in seconds
  fadeInOutTime: number; // in seconds
  dualRowSpacing: number; // in pixels
  dualRowMarginL: number; // in pixels
  dualRowMarginR: number; // in pixels
  dualRowMarginV: number; // in pixels
  nextTriggerIndex: number;
  word0ForceTriggerDelay?: number;
  row2FadeoutMode: "immediate" | "delayed";
  interludeBuffer: number;
  introDelayLimit: number;
  playResX?: number;
  playResY?: number;
  simulatedOutlineWidth?: number;
  dotOuterColor?: string; // hex
  dotInnerColor?: string; // hex
  dotOuterSize?: number; // ratio (0.1 ~ 0.5)
  dotInnerSize?: number; // ratio (0.05 ~ 0.4)
  dotSpacing?: number; // ratio (0.5 ~ 1.2)
  songInfoTitleColor?: string; // hex
  songInfoArtistColor?: string; // hex
  interludeLogoSvg?: string; // SVG 原始文字，匯出時轉為 ASS 向量圖
  logoMonochrome?: boolean; // 將 Logo 非透明區域統一為單色
  logoMonochromeColor?: string; // 單色 hex（預設 #FFFFFF）
  logoOutlineEnabled?: boolean; // 沿 Logo 形狀繪製外框
  logoOutlineWidth?: number; // 外框粗細（px，隨 Logo 等比縮放）
  logoOutlineColor?: string; // 外框 hex（預設 #FFFFFF）
  songDuration?: number; // duration of the song in seconds
  logoMaxWidth?: number; // maximum logo width in pixels
  logoMaxHeight?: number; // maximum logo height in pixels
  logoMinInterludeGap?: number; // minimum gap in seconds between paragraphs to display logo
  klgno?: string; // semicolons separated durations of not displaying logo
  copyrightAiText?: string;
  translationLrcText?: string;
  translationFontSize?: number;
  translationBorderWidth?: number;
  translationSpacing?: number;
  translationColor?: string;
  translationOutlineColor?: string;
  translationUnderline?: boolean;
}

// 內部控制參數
const DEFAULT_INFO_STAY_TIME = 6.0;
const INTRO_DELAY_BUFFER_TIME = 1;

// 間奏 Logo 預設尺寸與間奏門檻常數
const DEFAULT_LOGO_MAX_WIDTH = 450;
const DEFAULT_LOGO_MAX_HEIGHT = 300;
const LOGO_MIN_INTERLUDE_GAP = 12.0;

// =========================================================================
// 【核心設計與模式微調參數】
// =========================================================================
// 1. 歌詞邊框渲染模式 (LYRICS_OUTLINE_MODE)
//    - 'simulated-dual-layer': 雙層模擬追光白邊模式（未唱白色+黑色外框，起唱漸變為設定主體色+白色外框）。
//    - 'traditional': 傳統單層黑色邊框模式（外框永遠為完美實心黑色，歌詞本體由白字漸變為設定的主體色）。
const LYRICS_OUTLINE_MODE: "simulated-dual-layer" | "traditional" = "simulated-dual-layer";

// 2. 歌曲資訊 (前奏/間奏開始資訊) 外框構造模式 (INFO_OUTLINE_MODE)
//    - 'simulated-dual-layer': 雙層模擬白色粗外框模式（文字本體為紅色/藍色，背底微調多層純白外框，呈現粗白描邊效果）。
//    - 'traditional': 傳統單層黑色描邊模式（文字本體為紅色/藍色，邊框為實心黑色）。
const INFO_OUTLINE_MODE: "simulated-dual-layer" | "traditional" = "simulated-dual-layer";

// 3. 仿雙層邊框粗細設定 (SIMULATED_OUTLINE_WIDTH)
//    適用於 'simulated-dual-layer' 模式，單位為像素，預設為 3。數值越大外框越粗，反之越細。
const SIMULATED_OUTLINE_WIDTH = 3;

// 4. 卡拉OK歌詞追光時間上限與平滑微調參數 (KARAOKE_TIMING_SETTINGS)
//    - ALWAYS_STRETCH_KARAOKE:
//      若設為 true，單一字/單字的追光動畫（\kf / \ko）會總是拉滿到下一個字起點（無縫緊接下一字，不套用上限）。
//      若設為 false，則會受限於下方設定的時間上限，在達到上限後原地停留呈已唱完追光狀態，等候下一個字唱出。
const ALWAYS_STRETCH_KARAOKE = false;

//    - KARAOKE_LIMIT_CHINESE: 非英文字（如中/日/韓文等）的追光動畫上限制（單位為厘秒，1厘秒 = 0.01秒），預設為 50 厘秒 (0.5 秒)。
const KARAOKE_LIMIT_CHINESE = 75;

//    - KARAOKE_LIMIT_ENGLISH: 英文單字或字母（只要含英文字母 A-Z, a-z）的追光動畫上限制（單位為厘秒），預設為 100 厘秒 (1.0 秒)。
const KARAOKE_LIMIT_ENGLISH = 100;

function isEnglishWord(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

function estimateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0 && code <= 127) {
      width += fontSize * 0.45; // 半形字元（英文、數字、空格）通常約為字型高度的 45% 寬度
    } else {
      width += fontSize * 0.75; // 全形 CJK 中文字元通常約為字型高度的 85% 寬度
    }
  }
  return width;
}

function formatAssTime(timeInSeconds: number) {
  const h = Math.floor(timeInSeconds / 3600);
  const m = Math.floor((timeInSeconds % 3600) / 60);
  const s = Math.floor(timeInSeconds % 60);
  const cs = Math.floor((timeInSeconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function hexToAssColor(hex: string) {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (cleanHex.length === 6) {
    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);
    return `&H00${b}${g}${r}`;
  }
  return `&H00FFFFFF`;
}

function applyLogoMonochrome(items: AssVectorItem[], hexColor: string) {
  const monoAss = hexToAssColor(hexColor);
  return items.map((item) => ({
    ...item,
    ...(item.fillColor ? { fillColor: monoAss } : {}),
    ...(item.strokeColor ? { strokeColor: monoAss } : {}),
  }));
}

// 產生 SVG 風格的小白圓向量圖形 (ASS Vector)
function getDotsVector(count: number, r: number, spacing: number) {
  let path = "";
  for (let i = 0; i < count; i++) {
    const cx = i * spacing;
    // 貝茲曲線控制點用來畫圓 (圓半徑 * 0.55228)
    const c = Math.round(r * 0.55228);
    path += `m ${cx} ${-r} b ${cx + c} ${-r} ${cx + r} ${-c} ${cx + r} 0 b ${cx + r} ${c} ${cx + c} ${r} ${cx} ${r} b ${cx - c} ${r} ${cx - r} ${c} ${cx - r} 0 b ${cx - r} ${-c} ${cx - c} ${-r} ${cx} ${-r} `;
  }
  return path;
}

function getLineEndTime(line: LyricLine): number {
  if (line.end !== null) return line.end;
  if (line.words && line.words.length > 0) {
    const lastWord = line.words[line.words.length - 1];
    if (lastWord.start !== null) {
      if (lastWord.text.trim() === "") {
        return lastWord.start;
      }
      return lastWord.start + Math.max(0.5, lastWord.text.length * 0.2);
    }
  }
  return (line.start || 0) + 2;
}

function getStyleColor(styleId: string | undefined, options: AssOptions): string {
  if (styleId && /^#[0-9A-Fa-f]{6}$/.test(styleId)) {
    return hexToAssColor(styleId);
  }
  switch (styleId?.toUpperCase()) {
    case "R":
      return hexToAssColor(options.color2);
    case "P":
      return hexToAssColor(options.color3);
    case "G":
      return hexToAssColor(options.chorusColor);
    case "T":
      return hexToAssColor(options.grayColor || "#9ca3af");
    case "O":
      return hexToAssColor(options.orangeColor || "#ff7f00");
    case "B":
      return hexToAssColor(options.blueColor || "#2A04C8");
    case "N":
    default:
      return hexToAssColor(options.primaryColor);
  }
}

interface TranslationLine {
  start: number;
  text: string;
}

function parseTranslationLrc(lrcText: string): TranslationLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  const result: TranslationLine[] = [];
  const timeRegex = /\[(\d+):(\d+(?:\.\d+)?)]/g;

  for (const line of lines) {
    let match;
    timeRegex.lastIndex = 0;
    const matches: number[] = [];
    let lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const seconds = min * 60 + sec;
      matches.push(seconds);
      lastIndex = timeRegex.lastIndex;
    }
    if (matches.length > 0) {
      const text = line.substring(lastIndex).trim();
      for (const seconds of matches) {
        result.push({ start: seconds, text });
      }
    }
  }
  return result.sort((a, b) => a.start - b.start);
}

export function generateAss(
  rawLines: LyricLine[],
  metadata: LrcMetadata,
  options: AssOptions,
): string {
  const lines: LyricLine[] = createEffectiveLines(rawLines) as LyricLine[];
  const translationLines = options.translationLrcText
    ? parseTranslationLrc(options.translationLrcText)
    : [];
  const playResX = options.playResX || 1920;
  const playResY = options.playResY || 1080;
  const centerX = playResX / 2;
  const centerY = playResY / 2;

  // 畫面寬高比若大於 16:9，且當等效高度低於 900 門檻時，才開始以高度 900 為基準之比例進行等比例縮小。
  // 這可以避免在度過寬（如 3840x1636）時歌詞過大，同時也保證當等效高度高於 900 時，不會過度放大的問題。
  const scale = Math.min(playResX / 1920, playResY / 900);

  // 動態比例縮放參數
  const totalFontSize = options.fontSize + (options.fontSizeOffset || 0);
  const fontSize = Math.round(totalFontSize * scale);
  const dualRowSpacing = Math.round(
    (options.dualRowSpacing !== undefined ? options.dualRowSpacing : 30) * scale,
  );
  const dualRowMarginL = Math.round(
    (options.dualRowMarginL !== undefined ? options.dualRowMarginL : 150) * scale,
  );
  const dualRowMarginR = Math.round(
    (options.dualRowMarginR !== undefined ? options.dualRowMarginR : 150) * scale,
  );
  const dualRowMarginV = Math.round(
    (options.dualRowMarginV !== undefined ? options.dualRowMarginV : 50) * scale,
  );
  const baseTransFontSize = options.translationFontSize !== undefined ? options.translationFontSize : 8;
  const translationFontSize = Math.round(
    (baseTransFontSize + (options.fontSizeOffset || 0)) * scale,
  );
  const baseTransBorderWidth = options.translationBorderWidth !== undefined ? options.translationBorderWidth : 1.2;
  const translationBorderWidth = Math.max(1, Math.round(baseTransBorderWidth * scale));
  const baseTransSpacing = options.translationSpacing !== undefined ? options.translationSpacing : 15;
  const transMarginV = Math.round(dualRowMarginV + dualRowSpacing + fontSize + baseTransSpacing * scale);
  const translationColor = options.translationColor ? hexToAssColor(options.translationColor) : "&H00FFFFFF";
  const translationOutlineColor = options.translationOutlineColor ? hexToAssColor(options.translationOutlineColor) : "&H00000000";

  const infoTitleFontSize = Math.round(
    ((options.infoTitleFontSize || options.fontSize - 10) + (options.fontSizeOffset || 0)) * scale,
  );
  const infoFontSize = Math.round(
    ((options.infoFontSize || options.fontSize - 40) + (options.fontSizeOffset || 0)) * scale,
  );

  const margin48Scaled = Math.round(48 * scale);
  const copyrightFontSize = Math.round(
    (8 + (options.fontSizeOffset || 0)) * scale,
  );
  const outlineWidth = Math.max(
    1,
    Math.round(
      (options.simulatedOutlineWidth !== undefined ? options.simulatedOutlineWidth : 3) * scale,
    ),
  );
  const border4Scaled = Math.max(1, Math.round(4 * scale));
  const border3Scaled = Math.max(1, Math.round(3 * scale));

  const primaryAssColor = hexToAssColor(options.primaryColor);

  // Font Fallback 機制: ASS 格式的 Style 是使用逗號 (,) 分隔各個欄位的，不能在 Fontname 裡面包含逗號，否則會導致後面的 Fontsize 解析為 0，造成字體完全無法顯示！
  // Subtitle 渲染器 (如 VSFilter, libass) 底層本身就有作業系統層級的 glyph fallback 機制。
  // 我們這邊只能指定單一的首選字體名稱。
  const primaryFont = options.fontFamily ? options.fontFamily.trim() : "Noto Sans TC";
  const finalFontChain = primaryFont;

  // 樣式設定
  const styles = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${finalFontChain},${Math.round(20 * scale)},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
Style: TopLeft,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,1,${(1.5 * scale).toFixed(1)},0,7,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: TopCenter,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,1,${(1.5 * scale).toFixed(1)},0,8,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: TopRight,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,1,${(1.5 * scale).toFixed(1)},0,9,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: BottomLeft,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,1,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV + dualRowSpacing},0
Style: BottomCenter,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,2,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV},0
Style: BottomCenterRow1,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,2,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV + dualRowSpacing},0
Style: BottomRight,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,3,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV},0
Style: CenterInfo,${finalFontChain},${infoFontSize},${primaryAssColor},&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,5,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: CopyrightStyle,${finalFontChain},${copyrightFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${(1 * scale).toFixed(1)},0,2,10,10,10,1
`;

  let ass = `[Script Info]
; Script generated by Enhanced LRC Studio KTV Exporter
Title: KTV ASS
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: ${playResX}
PlayResY: ${playResY}

${styles}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // 過濾掉無效的歌詞行
  const validLines = lines.filter(
    (l) => l.start !== null && l.words.some((w) => trimASCII(w.text || "").length > 0),
  );

  // 依據「間奏閥值」(interludeThreshold) 以及是否有「強制單行 (isSingleLine)」將歌詞切分成段落
  const paragraphs: LyricLine[][] = [];
  let currentPara: LyricLine[] = [];

  for (let i = 0; i < validLines.length; i++) {
    const line = validLines[i];
    const prevEnd = i > 0 ? getLineEndTime(validLines[i - 1]) : 0;
    const prevIsSingle = i > 0 && !!validLines[i - 1].isSingleLine;

    const shouldCut =
      (currentPara.length > 0 && line.start! - prevEnd >= options.interludeThreshold) ||
      (currentPara.length > 0 && !!line.isSingleLine) ||
      (currentPara.length > 0 && line.ktvsp != null) ||
      prevIsSingle;

    if (shouldCut && currentPara.length > 0) {
      paragraphs.push(currentPara);
      currentPara = [];
    }
    currentPara.push(line);
  }
  if (currentPara.length > 0) paragraphs.push(currentPara);

  // 歌曲前奏資訊計算
  let infoStart = 0.5;
  let infoEnd = DEFAULT_INFO_STAY_TIME;
  if (!options.customStartInfoTime) {
    if (paragraphs.length > 0 && paragraphs[0][0].start! < DEFAULT_INFO_STAY_TIME) {
      const firstParaEnd = getLineEndTime(paragraphs[0][paragraphs[0].length - 1]);
      const delayedStart =
        firstParaEnd + options.interludeBuffer + options.fadeInOutTime + INTRO_DELAY_BUFFER_TIME;
      if (delayedStart > options.introDelayLimit) {
        infoStart = 0.5;
        infoEnd = DEFAULT_INFO_STAY_TIME;
      } else {
        infoStart = delayedStart;
        infoEnd = delayedStart + DEFAULT_INFO_STAY_TIME;
      }
    } else {
      infoStart = 0.5;
      infoEnd = Math.min(
        DEFAULT_INFO_STAY_TIME,
        paragraphs.length > 0 ? paragraphs[0][0].start! : DEFAULT_INFO_STAY_TIME,
      );
    }
  } else {
    infoStart = options.startInfoStartTime;
    infoEnd = options.startInfoEndTime;
  }

  const fadeMs = Math.round(options.fadeInOutTime * 1000); // fade duration tag

  // =========================================================================
  // 【請注意！手動微調 KTV 開始資訊位置與防重疊避讓邏輯】
  // =========================================================================
  const titleSize = infoTitleFontSize;
  const detailFontSize = infoFontSize;

  // 1. 檢測「歌曲開始資訊」的顯示區間 [infoStart, infoEnd] 是否與音軌中的任何段落（歌詞）顯示區間重疊
  let overlapsWithLyrics = false;
  const dotDuration = 1.0;
  paragraphs.forEach((p, idx) => {
    const prevEnd =
      idx > 0 ? getLineEndTime(paragraphs[idx - 1][paragraphs[idx - 1].length - 1]) : 0;
    const gap = p[0].start! - prevEnd;

    let maxAdvance = p[0].start!;
    if (idx > 0) maxAdvance = gap;
    if (p[0].ktvsp != null) maxAdvance = p[0].start! - p[0].ktvsp;

    const isRealInterlude =
      idx === 0 ? true : gap >= options.interludeThreshold || p[0].ktvsp != null;

    let dotCount = 0;
    if (isRealInterlude && maxAdvance > 1.0) {
      dotCount = Math.min(4, Math.floor(maxAdvance - 1.0));
      while (
        dotCount > 0 &&
        dotCount * dotDuration + 1.0 + options.fadeInOutTime > maxAdvance + 0.1
      ) {
        dotCount--;
      }
    }

    let actualAdvance = 0;
    if (p[0].ktvsp != null) {
      actualAdvance = maxAdvance;
    } else {
      if (dotCount > 0) {
        actualAdvance = dotCount * dotDuration + 1.0 + options.fadeInOutTime;
      } else {
        actualAdvance = Math.min(2.0 + options.fadeInOutTime, maxAdvance);
      }
    }

    const blockDisplayStart = Math.max(prevEnd, p[0].start! - actualAdvance);
    const blockDisplayEnd =
      getLineEndTime(p[p.length - 1]) + options.interludeBuffer + options.fadeInOutTime;
    const truncatedBlockEnd =
      idx < paragraphs.length - 1
        ? Math.min(blockDisplayEnd, paragraphs[idx + 1][0].start! - 0.1)
        : blockDisplayEnd;

    // 判斷兩者時間區間是否有交集 [infoStart, infoEnd] 與 [blockDisplayStart, truncatedBlockEnd]
    if (Math.max(infoStart, blockDisplayStart) < Math.min(infoEnd, truncatedBlockEnd)) {
      overlapsWithLyrics = true;
    }
  });

  // Calculate potential upward shift for Song Info if Copyright text is displayed
  let detailBottomShift = 0;
  if (options.copyrightAiText && options.copyrightAiText.trim()) {
    detailBottomShift = Math.round(30 * scale); // Shift upwards to make room for copyright text
  }

  // 2. 藍色歌曲資訊的排版：自底部往上排 (BottomCenter)
  // 若發生時間重疊，將 detailBottomY 拉到雙行歌詞之上
  let detailBottomY = playResY - Math.round(55 * scale) - detailBottomShift;
  if (overlapsWithLyrics) {
    // 雙行歌詞第一排(BottomLeft)的上緣：playResY - dualRowMarginV - dualRowSpacing - fontSize
    // 我們要把歌曲詳細資訊底邊放在這個上緣之上至少 60 像素
    const lyricsTopY = playResY - dualRowMarginV - dualRowSpacing - fontSize;
    detailBottomY = Math.round(lyricsTopY - 60 * scale) - detailBottomShift;
  }

  // 3. 紅色標題字的排版：
  // 若未重疊，則放畫面中央偏上 (centerY - 1.5 行)
  // 若發生重疊，將其置於歌曲詳細資訊最上方行的上面，確保文字學上完全不重疊，且維持 40px 的安全間距 (標題是 an5 置中-置中，需減去半個字高與 40px 間距)
  let titleY = centerY - Math.round(1.5 * titleSize) - detailBottomShift;

  // 建立歌曲資訊行陣列
  const artistAlbum = [];
  const titleColorHex = options.songInfoTitleColor || "#BC2600";
  const artistColorHex = options.songInfoArtistColor || "#2A04C8";
  const titleAssColor = hexToAssColor(titleColorHex);
  const artistAssColor = hexToAssColor(artistColorHex);

  if (options.songInfoArtist) {
    const lines = options.songInfoArtist.split("\n");
    let count = 0;
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        if (count === 0) {
          artistAlbum.push(`{\\c${artistAssColor}&}主唱：${trimmed}`);
        } else {
          artistAlbum.push(`{\\c${artistAssColor}&}${trimmed}`);
        }
        count++;
      }
    });
  }
  if (options.songInfoAlbum) {
    const lines = options.songInfoAlbum.split("\n");
    let count = 0;
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        if (count === 0) {
          artistAlbum.push(`{\\c${artistAssColor}&}專輯：${trimmed}`);
        } else {
          artistAlbum.push(`{\\c${artistAssColor}&}${trimmed}`);
        }
        count++;
      }
    });
  }
  if (options.songInfoCustom) {
    const customLines = options.songInfoCustom.split("\n");
    customLines.forEach((line) => {
      if (line.trim()) {
        artistAlbum.push(`{\\c${artistAssColor}&}${line.trim()}`);
      }
    });
  }

  // 當歌曲資訊低於三行字的時候，再多空一行，讓整體往上移一行以增加美觀
  if (artistAlbum.length > 0 && artistAlbum.length < 3) {
    artistAlbum.push("\\h");
  }

  if (overlapsWithLyrics && artistAlbum.length > 0) {
    // 固定紅字標題位置，不因下方實際歌曲資訊內容行數的關係往上擠，統一使用 4 行的高度來估算
    const assumedLines = artistAlbum.length>3? 3:artistAlbum.length;
    const detailHeight = Math.round(assumedLines * detailFontSize * 1.20);
    // 增加安全間距至 60 * scale 以留出足夠空間，避免與 an5 置中的標題字重疊
    titleY = Math.round(detailBottomY - detailHeight - Math.round(60 * scale) - titleSize / 2);
  }

  const offsets = [
    { dx: -outlineWidth, dy: -outlineWidth },
    { dx: outlineWidth, dy: -outlineWidth },
    { dx: -outlineWidth, dy: outlineWidth },
    { dx: outlineWidth, dy: outlineWidth },
  ];

  // 3. 產生紅色標題 Dialogue
  if (options.songInfoTitle) {
    const formattedTitle = options.songInfoTitle.replace(/\r?\n/g, "\\N");
    if (INFO_OUTLINE_MODE === "simulated-dual-layer") {
      // 外框層 (底層)：位移 4 個方向，顏色設為純白 &HFFFFFF&
      offsets.forEach(({ dx, dy }) => {
        const outlineTitleText = `{\\fad(${fadeMs},${fadeMs})\\an5\\pos(${centerX + dx},${titleY + dy})\\fs${titleSize}\\c&HFFFFFF&\\bord0\\shad0\\b1}${formattedTitle}{\\b0}`;
        ass += `Dialogue: 10,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${outlineTitleText}\n`;
      });

      // 核心層 (頂層)：疊在中央，層級設為 12，顏色維持為紅色 body
      const coreTitleText = `{\\fad(${fadeMs},${fadeMs})\\an5\\pos(${centerX},${titleY})\\fs${titleSize}\\c${titleAssColor}&\\bord0\\shad0\\b1}${formattedTitle}{\\b0}`;
      ass += `Dialogue: 12,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${coreTitleText}\n`;
    } else {
      // 傳統單層黑色邊框模式：使用組件內建 \bord3\3c&H000000&，本體為紅色 \c&H000000FF&
      const coreTitleText = `{\\fad(${fadeMs},${fadeMs})\\an5\\pos(${centerX},${titleY})\\fs${titleSize}\\c${titleAssColor}&\\bord${border3Scaled}\\shad0\\3c&H000000&\\b1}${formattedTitle}{\\b0}`;
      ass += `Dialogue: 10,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${coreTitleText}\n`;
    }
  }

  // 4. 產生歌曲資訊 Dialogue (底部往上排列，使用計算出的 detailBottomY)
  if (artistAlbum.length > 0) {
    if (INFO_OUTLINE_MODE === "simulated-dual-layer") {
      // 藉由 replace 把 line 裡面的顏色變更為白色
      const outlineArtistAlbum = artistAlbum.map((line) =>
        line.replace(/\\1?c&H[0-9A-Fa-f]+&/g, "\\c&HFFFFFF&"),
      );

      // 外框層 (底層)：位移 4 個方向，顏色變更為純白
      offsets.forEach(({ dx, dy }) => {
        const outlineText = `{\\fad(${fadeMs},${fadeMs})\\an2\\pos(${centerX + dx},${detailBottomY + dy})\\fs${detailFontSize}\\bord0\\shad0}${outlineArtistAlbum.join("\\N")}`;
        ass += `Dialogue: 10,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${outlineText}\n`;
      });

      // 核心層 (頂層)：疊在最中央，層級設為 12，維持原來的藍色/自訂主體顏色
      const detailText = `{\\fad(${fadeMs},${fadeMs})\\an2\\pos(${centerX},${detailBottomY})\\fs${detailFontSize}\\bord0\\shad0}${artistAlbum.join("\\N")}`;
      ass += `Dialogue: 12,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${detailText}\n`;
    } else {
      // 傳統單層黑色邊框模式：使用組件內建 \bord3\3c&H000000&
      const detailText = `{\\fad(${fadeMs},${fadeMs})\\an2\\pos(${centerX},${detailBottomY})\\fs${detailFontSize}\\bord${border3Scaled}\\shad0\\3c&H000000&}${artistAlbum.join("\\N")}`;
      ass += `Dialogue: 10,${formatAssTime(infoStart)},${formatAssTime(infoEnd)},CenterInfo,,0,0,0,,${detailText}\n`;
    }
  }
  // =========================================================================

  // 倒數小白圓的控制參數
  const outerRatio = options.dotOuterSize !== undefined ? options.dotOuterSize : 0.3;
  const innerRatio = options.dotInnerSize !== undefined ? options.dotInnerSize : 0.28;
  const dotSpacingRatio = options.dotSpacing !== undefined ? options.dotSpacing : 0.75;
  const dotRadius = Math.round(fontSize * outerRatio);
  const dotSpacing = Math.round(fontSize * dotSpacingRatio);

  // 第一階段 (Pass 1)：計算所有段落的 raw 資訊
  const pInfos = paragraphs.map((p, idx) => {
    const prevEnd =
      idx > 0 ? getLineEndTime(paragraphs[idx - 1][paragraphs[idx - 1].length - 1]) : 0;
    const gap = p[0].start! - prevEnd;

    const isRealInterlude =
      idx === 0 ? true : gap >= options.interludeThreshold || p[0].ktvsp != null;

    let maxAdvance = p[0].start!;
    if (idx > 0) maxAdvance = gap;

    // 如果有指定 ktvsp，強制重寫這段歌詞能提早進場的時間
    if (p[0].ktvsp != null) {
      maxAdvance = p[0].start! - p[0].ktvsp;
    }

    let dotCount = 0;
    if (isRealInterlude && maxAdvance > 1.0) {
      dotCount = Math.min(4, Math.floor(maxAdvance - 1.0));
      // 確保扣掉淡入淡出時間後，dot 不會過早出現而超出強制範圍太多
      while (
        dotCount > 0 &&
        dotCount * dotDuration + 1.0 + options.fadeInOutTime > maxAdvance + 0.1
      ) {
        dotCount--;
      }
    }

    let actualAdvance = 0;
    if (p[0].ktvsp != null) {
      actualAdvance = maxAdvance;
    } else {
      if (dotCount > 0) {
        actualAdvance = dotCount * dotDuration + 1.0 + options.fadeInOutTime;
      } else {
        actualAdvance = Math.min(2.0 + options.fadeInOutTime, maxAdvance);
      }
    }

    const blockDisplayStart = Math.max(prevEnd, p[0].start! - actualAdvance);
    const blockDisplayEnd =
      getLineEndTime(p[p.length - 1]) + options.interludeBuffer + options.fadeInOutTime;

    return {
      p,
      prevEnd,
      gap,
      isRealInterlude,
      dotCount,
      actualAdvance,
      blockDisplayStart,
      blockDisplayEnd,
      isStartRealInterlude: isRealInterlude,
      isEndRealInterlude: true, // 預設
    };
  });

  // Pass 1.5: 修正 start / end 是否為真實間奏的邊界
  for (let idx = 0; idx < pInfos.length; idx++) {
    if (idx < pInfos.length - 1) {
      pInfos[idx].isEndRealInterlude = pInfos[idx + 1].isRealInterlude;
    } else {
      pInfos[idx].isEndRealInterlude = true;
    }
  }

  // Pass 2: 計算精確的 truncatedBlockEnd
  const finalTruncatedBlockEnds = pInfos.map((info, idx) => {
    if (idx < pInfos.length - 1) {
      if (!info.isEndRealInterlude) {
        // 如果後面不是真實間奏，此段落必須在下一段落的「顯示開始時間點」消失，達到無縫不重疊切換
        return pInfos[idx + 1].blockDisplayStart;
      } else {
        // 否則，依照一般的 max 消失限制 (但多留時間不要重疊到下一個的 start)
        return Math.min(info.blockDisplayEnd, pInfos[idx + 1].p[0].start! - 0.1);
      }
    } else {
      return info.blockDisplayEnd;
    }
  });

  // Pass 2.5: 譯文擁有者段落索引計算輔助函數 (完全脫勾、非單純主歌詞行綁定，而是依顯示區間做最佳歸屬)
  const getOwnerParagraphIndex = (tlStart: number): number => {
    // 優先尋找哪個段落的顯示區間 [blockDisplayStart, truncatedBlockEnd] 完整涵蓋該譯文起點
    for (let i = 0; i < pInfos.length; i++) {
      const bStart = pInfos[i].blockDisplayStart;
      const bEnd = finalTruncatedBlockEnds[i];
      if (tlStart >= bStart && tlStart < bEnd) {
        return i;
      }
    }
    // 若落在任何段落顯示區間之外（例如長間奏/前奏/尾奏期間）：
    // 1. 若在第一個段落顯示之前，歸屬第一段
    if (tlStart < pInfos[0].blockDisplayStart) {
      return 0;
    }
    // 2. 若在最後一個段落顯示之後，歸屬最後一段
    if (tlStart >= finalTruncatedBlockEnds[pInfos.length - 1]) {
      return pInfos.length - 1;
    }
    // 3. 若落在段落 i 與 i+1 之間的間奏中：
    // 因已在段落 i 結束之後且在段落 i+1 開始之前，故應歸屬即將開始的段落 i+1
    for (let i = 0; i < pInfos.length - 1; i++) {
      if (tlStart >= finalTruncatedBlockEnds[i] && tlStart < pInfos[i + 1].blockDisplayStart) {
        return i + 1;
      }
    }
    // 備用：尋找主歌詞起點最接近的段落
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < pInfos.length; i++) {
      const diff = Math.abs(tlStart - pInfos[i].p[0].start!);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    return closestIdx;
  };

  paragraphs.forEach((p, idx) => {
    const pInfo = pInfos[idx];
    const { blockDisplayStart, dotCount, isStartRealInterlude, isEndRealInterlude } = pInfo;
    const truncatedBlockEnd = finalTruncatedBlockEnds[idx];

    // 產生倒數小白圓的 Events
    if (dotCount > 0) {
      const isSingleLine = p.length === 1;
      const isCenterLayout = isSingleLine || !!p[0]?.isCenter;

      let xPos = 0;
      let yPos = 0;
      const currentMarginV = dualRowMarginV;
      const currentMarginL = dualRowMarginL;
      const offset15 = Math.round(15 * scale);
      const offset20 = Math.round(20 * scale);
      // 計算第一行文字上方的適當座標位置
      if (isCenterLayout) {
        const totalW = (dotCount - 1) * dotSpacing + 2 * dotRadius;
        // 居中對齊座標
        xPos = centerX - totalW / 2 + dotRadius;
        if (isSingleLine) {
          yPos = playResY - currentMarginV - fontSize - dotRadius - offset20;
        } else {
          yPos = playResY - currentMarginV - fontSize - dotRadius - offset20 - dualRowSpacing;
        }
      } else {
        // BottomLeft 座標，小白圓發端對齊 BottomLeft 歌詞的起始位置（外外多出 15px 左右與第一行歌詞對齊）
        xPos = currentMarginL + offset15 + dotRadius;
        // 離第一排歌詞上緣 offset20
        yPos = playResY - currentMarginV - fontSize - dotRadius - offset20 - dualRowSpacing;
      }

      for (let d = 0; d < dotCount; d++) {
        const dDots = dotCount - d;
        // 第一個圓出現的時間
        let dotStart = p[0].start! - 1.0 - dDots;
        let dotEnd = dotStart + dotDuration;

        let dotFadeIn = 0;
        if (d === 0) {
          dotStart = blockDisplayStart;
          dotFadeIn = fadeMs;
        }

        const dotOuterColorAss = hexToAssColor(options.dotOuterColor || "#888888");
        const dotInnerColorAss = hexToAssColor(options.dotInnerColor || "#FFFFFF");
        const outerRadius = Math.round(fontSize * outerRatio);
        const innerRadius = Math.max(1, Math.round(fontSize * innerRatio));

        // 為了相容所有播放器對 ASS Vector Outlines 大小和淡入動畫透明度的處理，
        // 我們採用單層帶邊框繪製法 (Single-layer with Border)：
        // 通過繪製一個半徑為 (outer+inner)/2 的圓形，並加上寬度為 (outer-inner) 的邊框，
        // 可以實現完美的同心圓效果，且在淡入淡出時透明度表現一致，解決了雙層疊加導致的透明度異常問題。
        const midRadius = (outerRadius + innerRadius) / 2;
        const borderSize = outerRadius - innerRadius;
        const vecDots = getDotsVector(dDots, midRadius, dotSpacing);

        // 使用 Default 樣式 (BorderStyle=1) 並配合 \an7 進行定位，確保 \bord 能正確產生外邊框而非背景框
        ass += `Dialogue: 5,${formatAssTime(dotStart)},${formatAssTime(dotEnd)},Default,,0,0,0,,{\\an7\\fad(${dotFadeIn},0)\\pos(${xPos.toFixed(1)},${yPos.toFixed(1)})\\c${dotInnerColorAss}&\\3c${dotOuterColorAss}&\\bord${borderSize.toFixed(1)}\\shad0\\1a&H00&}{\\p1}${vecDots}{\\p0}\n`;
      }
    }

    // 針對段落內的每行歌詞進行處理
    const lineDisplayStarts: number[] = [];
    const lineDisplayEnds: number[] = [];

    for (let i = 0; i < p.length; i++) {
      const lastIsCentered = p.length % 2 !== 0 && p.length >= 3;
      const isLast = i === p.length - 1;
      const isCentered = isLast && lastIsCentered;

      let start = blockDisplayStart;
      if (isCentered) {
        start = getLineEndTime(p[i - 1]);
      } else if (i >= 2) {
        if (i % 2 === 0) {
          const prevLine = p[i - 1];
          const trigIdx = Math.min(options.nextTriggerIndex, prevLine.words.length - 1);
          const trigWord = prevLine.words[trigIdx];
          let baseStart = trigWord && trigWord.start !== null ? trigWord.start : getLineEndTime(prevLine);

          if (options.word0ForceTriggerDelay !== undefined && options.word0ForceTriggerDelay > 0) {
            const firstWord = prevLine.words[0];
            if (firstWord && firstWord.start !== null) {
              const forceTime = firstWord.start + options.word0ForceTriggerDelay;
              const wasCapped = options.nextTriggerIndex > prevLine.words.length - 1;
              if (wasCapped || baseStart > forceTime) {
                baseStart = Math.min(forceTime, getLineEndTime(prevLine));
              }
            }
          }
          start = baseStart;
        } else {
          const prevSameRowLine = p[i - 2];
          start = getLineEndTime(prevSameRowLine);
        }
      }
      lineDisplayStarts.push(start);
    }

    for (let i = 0; i < p.length; i++) {
      const lastIsCentered = p.length % 2 !== 0 && p.length >= 3;
      const isLast = i === p.length - 1;
      const isCentered = isLast && lastIsCentered;
      const isSingleLine = p.length === 1;
      const isClassicCentered = isCentered || isSingleLine;

      let end = truncatedBlockEnd;
      if (isClassicCentered) {
        end = truncatedBlockEnd;
      } else if (lastIsCentered && i >= p.length - 3 && i !== p.length - 1) {
        end = getLineEndTime(p[p.length - 2]);
      } else if (i < p.length - 2) {
        if (i % 2 === 0) {
          end = lineDisplayStarts[i + 2];
        } else {
          if (options.row2FadeoutMode === "immediate") {
            end = getLineEndTime(p[i]);
          } else {
            end = lineDisplayStarts[i + 2];
          }
        }
      }
      lineDisplayEnds.push(end);
    }

    const getRowForLine = (idxVal: number) => {
      const lastIsCentered = p.length % 2 !== 0 && p.length >= 3;
      const isLast = idxVal === p.length - 1;
      const isCentered = isLast && lastIsCentered;
      const isSingleLine = p.length === 1;
      if (isSingleLine || isCentered) {
        return 2;
      }
      return idxVal % 2 === 0 ? 1 : 2;
    };

    // Ensure duet/overlapping lines and standard lines stay on screen until they finish singing
    for (let i = 0; i < p.length; i++) {
      const physicalEnd = getLineEndTime(p[i]);
      if (lineDisplayEnds[i] < physicalEnd) {
        lineDisplayEnds[i] = physicalEnd;
      }
    }

    // Propagate constraints sequentially on the same row to avoid overlapped display intervals
    for (let i = 0; i < p.length; i++) {
      const rowI = getRowForLine(i);
      let nextSameRowIdx = -1;
      for (let j = i + 1; j < p.length; j++) {
        if (rowI === getRowForLine(j)) {
          nextSameRowIdx = j;
          break;
        }
      }
      if (nextSameRowIdx !== -1) {
        if (lineDisplayStarts[nextSameRowIdx] < lineDisplayEnds[i]) {
          lineDisplayStarts[nextSameRowIdx] = lineDisplayEnds[i];
        }
      }
    }

    // Guarantee that display starts do not exceed display ends
    for (let i = 0; i < p.length; i++) {
      if (lineDisplayStarts[i] > lineDisplayEnds[i]) {
        lineDisplayStarts[i] = lineDisplayEnds[i] - 0.1 > 0 ? lineDisplayEnds[i] - 0.1 : lineDisplayEnds[i];
      }
    }

    for (let i = 0; i < p.length; i++) {
      const line = p[i];
      const displayStart = lineDisplayStarts[i];
      const displayEnd = lineDisplayEnds[i];

      const lastIsCentered = p.length % 2 !== 0 && p.length >= 3;
      const isLast = i === p.length - 1;
      const isCentered = isLast && lastIsCentered;
      const isSingleLine = p.length === 1;
      const isReallyCentered = isCentered || isSingleLine || !!line.isCenter;

      const row = getRowForLine(i);
      const style = isReallyCentered
        ? (row === 1 ? "BottomCenterRow1" : "BottomCenter")
        : (row === 1 ? "BottomLeft" : "BottomRight");

      const fadeIn = displayStart === blockDisplayStart && isStartRealInterlude ? fadeMs : 0;
      const fadeOut = displayEnd === truncatedBlockEnd && isEndRealInterlude ? fadeMs : 0;

      let karaokeStrOutline = "";
      let karaokeStrCore = "";
      let karaokeStrTraditional = "";

      const primaryAssColor = hexToAssColor(options.primaryColor);
      const lineAssColor = getStyleColor(line.style, options);
      let lastCoreColor = lineAssColor;

      if (lineAssColor !== primaryAssColor) {
        karaokeStrCore += `{\\1c${lineAssColor}}`;
        karaokeStrTraditional += `{\\1c${lineAssColor}}`;
      }

      const validWords = line.words.filter((w, wIdx) => {
        if (!w.text) return false;
        if (w.text.trim() === "") {
          const isTrailing = line.words.slice(wIdx).every(subW => !subW.text || subW.text.trim() === "");
          return !isTrailing;
        }
        return true;
      });

      for (let wIdx = 0; wIdx < validWords.length; wIdx++) {
        const w = validWords[wIdx];
        const defaultLimitVal = isEnglishWord(w.text)
          ? KARAOKE_LIMIT_ENGLISH
          : KARAOKE_LIMIT_CHINESE;

        let durCs = 0;
        if (w.start !== null) {
          const nextW = validWords[wIdx + 1];
          if (nextW) {
            const nextStart = nextW.start;
            if (nextStart !== null && nextStart >= w.start) {
              durCs = Math.round((nextStart - w.start) * 100);
            } else {
              durCs = defaultLimitVal;
            }
          } else {
            // This is the last word in the line
            const hasTrailingTag =
              line.words &&
              line.words.length > 0 &&
              trimASCII(line.words[line.words.length - 1].text || "") === "";
            const preciseEnd =
              line.end !== null
                ? line.end
                : hasTrailingTag
                  ? line.words[line.words.length - 1].start
                  : null;

            if (preciseEnd !== null && preciseEnd >= w.start) {
              durCs = Math.round((preciseEnd - w.start) * 100);
            } else {
              // No precise user-defined end, default to 30 cs
              // BUT, if the next line starts in less than 30 cs, align to the next line's start
              const lineGlobalIdx = validLines.indexOf(line);
              const nextLineInSong =
                lineGlobalIdx !== -1 ? validLines[lineGlobalIdx + 1] : undefined;

              if (nextLineInSong && nextLineInSong.start !== null) {
                const gapToNextLine = nextLineInSong.start - w.start;
                const defaultLimitSec = defaultLimitVal / 100;
                if (gapToNextLine >= 0 && gapToNextLine < defaultLimitSec) {
                  durCs = Math.round(gapToNextLine * 100);
                } else {
                  durCs = defaultLimitVal;
                }
              } else {
                durCs = defaultLimitVal;
              }
            }
          }
        } else {
          durCs = defaultLimitVal;
        }

        let sweepCs = durCs;
        if (w.start !== null && w.end !== null && w.end >= w.start) {
          const computedSweep = Math.round((w.end - w.start) * 100);
          if (computedSweep > 0 && computedSweep <= durCs) {
            sweepCs = computedSweep;
          }
        }

        if (sweepCs === durCs && !ALWAYS_STRETCH_KARAOKE && durCs > defaultLimitVal) {
          sweepCs = defaultLimitVal;
        }

        const delayCs = durCs - sweepCs;

        const wAssColor = getStyleColor(w.style || line.style, options);
        let colorTagCore = "";
        let colorTagTraditional = "";

        if (wAssColor !== lastCoreColor) {
          colorTagCore = `{\\1c${wAssColor}}`;
          colorTagTraditional = `{\\1c${wAssColor}}`;
          lastCoreColor = wAssColor;
        }

        if (!trimASCII(w.text || "")) {
          karaokeStrOutline += `{\\k${durCs}}${w.text}`;
          karaokeStrCore += `${colorTagCore}{\\k${durCs}}${w.text}`;
          karaokeStrTraditional += `${colorTagTraditional}{\\k${durCs}}${w.text}`;
        } else {
          if (delayCs > 0) {
            karaokeStrOutline += `{\\kf${sweepCs}}${w.text}{\\k${delayCs}}`;
            karaokeStrCore += `${colorTagCore}{\\kf${sweepCs}}${w.text}{\\k${delayCs}}`;
            karaokeStrTraditional += `${colorTagTraditional}{\\kf${sweepCs}}${w.text}{\\k${delayCs}}`;
          } else {
            karaokeStrOutline += `{\\kf${durCs}}${w.text}`;
            karaokeStrCore += `${colorTagCore}{\\kf${durCs}}${w.text}`;
            karaokeStrTraditional += `${colorTagTraditional}{\\kf${durCs}}${w.text}`;
          }
        }
      }

      const startDelaySec = (line.start || displayStart) - displayStart;
      if (startDelaySec > 0) {
        const startDelayCs = Math.round(startDelaySec * 100);
        karaokeStrOutline = `{\\kf${startDelayCs}}${karaokeStrOutline}`;
        karaokeStrCore = `{\\kf${startDelayCs}}${karaokeStrCore}`;
        karaokeStrTraditional = `{\\kf${startDelayCs}}${karaokeStrTraditional}`;
      }

      // 核心定位座標計算：解析目前樣式對應的對齊與位置
      let alignment = 2; // Default BottomCenter / BottomCenterRow1
      let baseX = centerX;
      let baseY = playResY - dualRowMarginV; // MarginV is dualRowMarginV scaled

      if (style === "BottomCenterRow1") {
        alignment = 2;
        baseX = centerX;
        baseY = playResY - (dualRowMarginV + dualRowSpacing);
      } else if (style === "BottomLeft") {
        alignment = 1;
        baseX = dualRowMarginL;
        baseY = playResY - (dualRowMarginV + dualRowSpacing);
      } else if (style === "BottomRight") {
        alignment = 3;
        baseX = playResX - dualRowMarginR;
        baseY = playResY - dualRowMarginV;
      }

      if (LYRICS_OUTLINE_MODE === "simulated-dual-layer") {
        // 透過 4 個方向的微調偏移值來模擬完美勻稱的外框
        const karaokeOffsets = [
          { dx: -outlineWidth, dy: -outlineWidth },
          { dx: outlineWidth, dy: -outlineWidth },
          { dx: -outlineWidth, dy: outlineWidth },
          { dx: outlineWidth, dy: outlineWidth },
        ];

        karaokeOffsets.forEach(({ dx, dy }) => {
          // 外框層 (底層)：使用 \kf，未唱時為黑色 &H000000&，起唱漸變為白色外框 &HFFFFFF&
          ass += `Dialogue: ${row},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX + dx},${baseY + dy})\\bord0\\shad0\\fs${fontSize}\\1c&HFFFFFF&\\2c&H000000&\\fad(${fadeIn},${fadeOut})}${karaokeStrOutline}\n`;
        });

        // 核心唱詞本體層 (頂層)：疊在最中央，未唱時主體設為白色且不透明 \2c&HFFFFFF&\2a&H00&，起唱後漸變為設定的唱詞主體色
        ass += `Dialogue: ${row + 2},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX},${baseY})\\bord0\\shad0\\fs${fontSize}\\1c${lineAssColor}\\2c&HFFFFFF&\\2a&H00&\\fad(${fadeIn},${fadeOut})}${karaokeStrCore}\n`;
      } else {
        // traditional 傳統單層模式：外框永遠是實心黑色 &H000000&，文字主體由白 (&HFFFFFF&) 漸變為設定色 (primaryAssColor)
        // 直接使用 ASS 內建的 \bord4\3c&H000000& 確保描邊，將 \2c 設為白色 \1c 設為唱完的 primaryAssColor
        ass += `Dialogue: ${row},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX},${baseY})\\bord${border4Scaled}\\shad0\\fs${fontSize}\\1c${lineAssColor}\\2c&HFFFFFF&\\3c&H000000&\\fad(${fadeIn},${fadeOut})}${karaokeStrTraditional}\n`;
      }

    }

    // 輸出此段落專屬的譯文字幕，解決無結束時間戳與淡出同步問題，且不因智慧對齊產生重疊
    if (translationLines.length > 0) {
      let pTranslations = translationLines.filter((tl) => {
        return getOwnerParagraphIndex(tl.start) === idx;
      });

      // 當譯文下一句是空白時，若與主歌詞段落結束落差低於3秒，就直接略過該空白段落，使其和主歌詞一起淡出
      pTranslations = pTranslations.filter((tl) => {
        const isCloseEmpty = tl.text.trim() === "" && (truncatedBlockEnd - tl.start) < 3.0 && (truncatedBlockEnd - tl.start) >= 0;
        return !isCloseEmpty;
      });

      const firstRealIndex = pTranslations.findIndex((tl) => tl.text.trim() !== "");

      pTranslations.forEach((tl, k) => {
        let displayStart = tl.start;
        const isFirstReal = k === firstRealIndex;
        if (isFirstReal) {
          displayStart -= 0.5;
        }
        if (displayStart < blockDisplayStart) {
          displayStart = blockDisplayStart;
        }

        let displayEnd = truncatedBlockEnd;
        if (k < pTranslations.length - 1) {
          displayEnd = Math.min(truncatedBlockEnd, pTranslations[k + 1].start);
        }

        if (displayStart >= displayEnd) {
          displayStart = displayEnd - 0.1 > 0 ? displayEnd - 0.1 : displayEnd;
        }

        // 當譯文段落第一句出現時，請淡入演出
        const transFadeIn = isFirstReal ? fadeMs : 0;
        // 當雙行字幕淡出時，譯文歌詞也要跟著淡出
        const transFadeOut = (displayEnd === truncatedBlockEnd && isEndRealInterlude) ? fadeMs : 0;

        const tx = playResX - dualRowMarginR;
        const ty = playResY - transMarginV;

        if (options.translationUnderline && tl.text.trim() !== "") {
          const W_text = estimateTextWidth(tl.text, translationFontSize);
          // 漸層區域的延伸長度
          // 調整方式：其中的 2.0 代表往左多延伸 2.0 個中文字的寬度。若您覺得太長，可以將其改小，例如：
          // 改成 0.5 (延伸半個字寬)
          const W_grad = 2.0 * translationFontSize;
          const tx_left = tx - W_text;
          const u_left = tx_left - W_grad;
          // 底線與文字的間距
          // 調整方式：其中的 5 即為文字下邊緣到底線的間距（以像素點計），可依需求調大或調小。
          const underlineGap = Math.round(5 * scale);
          // 底線的粗細
          // 調整方式：其中的 1.5 為底線的基本像素高度，可依視覺喜好調整。
          const h = Math.max(1, Math.round(2 * scale));

          // 漸層細分線段數量 
          // 調整方式：將延伸區域細分為 10 段來模擬漸層。若您縮小了延伸長度，也可以適度降低線段數量（例如改為 5 或 8），以減少輸出的字幕行數。
          // Draw the gradient region (10 segments)
          const segmentsCount = 30;
          const segWidth = W_grad / segmentsCount;
          for (let i = 0; i < segmentsCount; i++) {
            const x_start = u_left + i * segWidth;
            const x_end = x_start + segWidth;
            const w = x_end - x_start;
            const alphaVal = Math.round(255 * (1 - i / segmentsCount));
            const hexAlpha = alphaVal.toString(16).toUpperCase().padStart(2, "0");

            ass += `Dialogue: 7,${formatAssTime(displayStart)},${formatAssTime(displayEnd)},Default,,0,0,0,,{\\an7\\pos(${x_start.toFixed(1)},${(ty + underlineGap).toFixed(1)})\\fad(${transFadeIn},${transFadeOut})\\p1\\c${translationColor}&\\bord0\\shad0\\1a&H${hexAlpha}&}m 0 0 l ${w.toFixed(1)} 0 l ${w.toFixed(1)} ${h} l 0 ${h}{\\p0}\n`;
          }

          // Draw the solid region
          const solidWidth = tx - tx_left;
          if (solidWidth > 0) {
            ass += `Dialogue: 7,${formatAssTime(displayStart)},${formatAssTime(displayEnd)},Default,,0,0,0,,{\\an7\\pos(${tx_left.toFixed(1)},${(ty + underlineGap).toFixed(1)})\\fad(${transFadeIn},${transFadeOut})\\p1\\c${translationColor}&\\bord0\\shad0\\1a&H00&}m 0 0 l ${solidWidth.toFixed(1)} 0 l ${solidWidth.toFixed(1)} ${h} l 0 ${h}{\\p0}\n`;
          }
        }

        ass += `Dialogue: 8,${formatAssTime(displayStart)},${formatAssTime(displayEnd)},Default,,0,0,0,,{\\an3\\pos(${tx},${ty})\\fad(${transFadeIn},${transFadeOut})\\fs${translationFontSize}\\c${translationColor}&\\3c${translationOutlineColor}&\\bord${translationBorderWidth}\\shad0}${tl.text}\n`;
      });
    }
  });

  // 自訂間奏 Logo（測試階段：一律顯示於左上角）
  if (options.interludeLogoSvg) {
    const graphic = parseSvgToAssVector(options.interludeLogoSvg);
    if (graphic) {
      const logoItems = options.logoMonochrome
        ? applyLogoMonochrome(graphic.items, options.logoMonochromeColor ?? "#FFFFFF")
        : graphic.items;
      const maxLogoW = Math.round((options.logoMaxWidth ?? DEFAULT_LOGO_MAX_WIDTH) * scale);
      const maxLogoH = Math.round((options.logoMaxHeight ?? DEFAULT_LOGO_MAX_HEIGHT) * scale);
      const fitScale = Math.min(maxLogoW / graphic.width, maxLogoH / graphic.height);
      const logoX = dualRowMarginL;
      const logoY = dualRowMarginV;

      // Render the multiple appearances of the Logo
      let logoAppearances: { start: number; end: number; fadeOutDuration: number }[] = [];

      // 1. Initial display alongside Song Info
      logoAppearances.push({ start: infoStart, end: infoEnd, fadeOutDuration: fadeMs });

      // 2. Interludes and Outro
      for (let idx = 0; idx < paragraphs.length; idx++) {
        const logoStart = finalTruncatedBlockEnds[idx] + INTRO_DELAY_BUFFER_TIME;

        if (idx < paragraphs.length - 1) {
          // It's an interlude between two paragraphs
          const pNextStart = pInfos[idx + 1].p[0].start!;
          const pPrevEnd = getLineEndTime(paragraphs[idx][paragraphs[idx].length - 1]);

          const minGap = options.logoMinInterludeGap ?? LOGO_MIN_INTERLUDE_GAP;
          if (pNextStart - pPrevEnd >= minGap) {
            const logoEnd = pInfos[idx + 1].blockDisplayStart - INTRO_DELAY_BUFFER_TIME;
            if (logoEnd > logoStart) {
              // 檢查此段落間奏與「歌曲開始資訊」的顯示區間是否重疊
              const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
              if (!overlapsWithSongInfo) {
                logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs });
              }
            }
          }
        } else {
          // Outro - after the last paragraph
          if (options.songDuration && options.songDuration > logoStart) {
            const logoEnd = options.songDuration;
            const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
            if (!overlapsWithSongInfo) {
              logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: 1000 }); // "最後1秒會再淡出"
            }
          } else if (!options.songDuration) {
            // Fallback if no songDuration available
            const logoEnd = logoStart + 10.0;
            const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
            if (!overlapsWithSongInfo) {
              logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs });
            }
          }
        }
      }

      // Apply klgno exclusions from metadata (exempting the first appearance which represents the Song Info block)
      if (metadata && metadata.klgno) {
        const exclusions = parseKlgnoMetadata(metadata.klgno);
        if (logoAppearances.length > 1) {
          const songInfoLogo = logoAppearances[0];
          const restAppearances = logoAppearances.slice(1);
          const excludedRest = applyExclusions(restAppearances, exclusions, fadeMs);
          logoAppearances = [songInfoLogo, ...excludedRest];
        }
      }

      const outlineEnabled =
        !!options.logoOutlineEnabled && (options.logoOutlineWidth ?? 0) > 0;
      const outlineAss = hexToAssColor(options.logoOutlineColor ?? "#FFFFFF");
      const outlineBord = Math.max(
        1,
        Math.round((options.logoOutlineWidth ?? 3) * fitScale),
      );

      const silhouettePaths = new Set<string>();
      for (const item of logoItems) {
        if (item.fillColor || item.strokeColor) {
          silhouettePaths.add(item.path);
        }
      }

      for (const appearance of logoAppearances) {
        if (appearance.start >= appearance.end) continue;

        const startStr = formatAssTime(appearance.start);
        const endStr = formatAssTime(appearance.end);
        const fadeText = `\\fad(${fadeMs},${appearance.fadeOutDuration})`;

        if (outlineEnabled) {
          for (const path of silhouettePaths) {
            const scaledPath = scaleAssVectorPath(path, fitScale);
            ass += `Dialogue: 3,${startStr},${endStr},TopLeft,,0,0,0,,{\\an7\\pos(${logoX},${logoY})${fadeText}\\1a&HFF&\\3c${outlineAss}&\\bord${outlineBord}\\shad0}{\\p1}${scaledPath}{\\p0}\n`;
          }
        }

        for (const item of logoItems) {
          const scaledPath = scaleAssVectorPath(item.path, fitScale);

          if (item.strokeOnly && item.strokeColor) {
            const bord = Math.max(1, Math.round((item.strokeWidth || 1) * fitScale));
            ass += `Dialogue: 3,${startStr},${endStr},TopLeft,,0,0,0,,{\\an7\\pos(${logoX},${logoY})${fadeText}\\1a&HFF&\\3c${item.strokeColor}&\\bord${bord}\\shad0}{\\p1}${scaledPath}{\\p0}\n`;
          } else if (item.fillColor) {
            ass += `Dialogue: 3,${startStr},${endStr},TopLeft,,0,0,0,,{\\an7\\pos(${logoX},${logoY})${fadeText}\\c${item.fillColor}&\\bord0\\shad0\\1a&H00&}{\\p1}${scaledPath}{\\p0}\n`;
          }
        }
      }
    }
  }

  // 自訂版權/AI提示文字演出
  if (options.copyrightAiText && options.copyrightAiText.trim()) {
    const copyrightText = options.copyrightAiText.trim();
    const copyrightAppearances: { start: number; end: number; fadeOutDuration: number; isIntro?: boolean }[] = [];

    // 1. 歌曲開場標題出現時必定顯示
    // 發生overlapsWithLyrics時，因為歌詞早就已經出現，所以會演出到跟著歌曲開場標題（infoEnd）一起消失
    // 如果沒有 overlapsWithLyrics，則一直顯示直到下一段歌詞出現前才消失（套用 INTRO_DELAY_BUFFER_TIME 緩衝時間）
    let firstEnd = infoEnd;
    if (!overlapsWithLyrics) {
      // 尋找在 infoStart 之後第一個會顯示的歌詞段落
      const nextPInfo = pInfos.find(p => p.blockDisplayStart > infoStart);
      if (nextPInfo) {
        firstEnd = nextPInfo.blockDisplayStart - INTRO_DELAY_BUFFER_TIME;
      }
    }
    if (firstEnd < infoEnd) {
      firstEnd = infoEnd;
    }
    copyrightAppearances.push({
      start: infoStart,
      end: firstEnd,
      fadeOutDuration: fadeMs,
      isIntro: true,
    });

    // 2. 之後比照出版商Logo的演出方式 (間奏與 Outro)
    for (let idx = 0; idx < paragraphs.length; idx++) {
      const logoStart = finalTruncatedBlockEnds[idx] + INTRO_DELAY_BUFFER_TIME;

      if (idx < paragraphs.length - 1) {
        // 間奏
        const pNextStart = pInfos[idx + 1].p[0].start!;
        const pPrevEnd = getLineEndTime(paragraphs[idx][paragraphs[idx].length - 1]);

        const minGap = options.logoMinInterludeGap ?? LOGO_MIN_INTERLUDE_GAP;
        if (pNextStart - pPrevEnd >= minGap) {
          const logoEnd = pInfos[idx + 1].blockDisplayStart - INTRO_DELAY_BUFFER_TIME;
          if (logoEnd > logoStart) {
            const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
            if (!overlapsWithSongInfo) {
              copyrightAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs, isIntro: false });
            }
          }
        }
      } else {
        // Outro
        if (options.songDuration && options.songDuration > logoStart) {
          const logoEnd = options.songDuration;
          const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
          if (!overlapsWithSongInfo) {
            copyrightAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: 1000, isIntro: false });
          }
        } else if (!options.songDuration) {
          const logoEnd = logoStart + 10.0;
          const overlapsWithSongInfo = Math.max(logoStart, infoStart) < Math.min(logoEnd, infoEnd);
          if (!overlapsWithSongInfo) {
            copyrightAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs, isIntro: false });
          }
        }
      }
    }

    // 3. 所有顯示時段若在「特殊指定不顯示Logo時段」內也要消失
    let finalCopyrightAppearances = [...copyrightAppearances];
    if (metadata && metadata.klgno) {
      const exclusions = parseKlgnoMetadata(metadata.klgno);
      finalCopyrightAppearances = applyExclusions(finalCopyrightAppearances, exclusions, fadeMs);
    }

    // 4. 輸出 Dialog 唱詞
    for (const appearance of finalCopyrightAppearances) {
      if (appearance.start >= appearance.end) continue;

      const startStr = formatAssTime(appearance.start);
      const endStr = formatAssTime(appearance.end);
      const fadeText = `\\fad(${fadeMs},${appearance.fadeOutDuration})`;
      
      let copyrightY = playResY - Math.round(15 * scale);
      if (appearance.isIntro && overlapsWithLyrics) {
        const lyricsTopY = playResY - dualRowMarginV - dualRowSpacing - fontSize;
        copyrightY = lyricsTopY - Math.round(15 * scale);
      }

      ass += `Dialogue: 1,${startStr},${endStr},CopyrightStyle,,0,0,0,,{\\an2\\pos(${centerX},${copyrightY})${fadeText}}${copyrightText}\n`;
    }
  }

  return ass;
}

interface LogoExcludeInterval {
  start: number;
  end: number;
}

function parseKlgnoMetadata(klgnoStr?: string): LogoExcludeInterval[] {
  if (!klgnoStr) return [];
  const intervals: LogoExcludeInterval[] = [];
  const parts = klgnoStr.split(";");
  for (const part of parts) {
    if (!part.trim()) continue;
    const times = part.split("-");
    if (times.length === 2) {
      const start = parseSeconds(times[0].trim());
      const end = parseSeconds(times[1].trim());
      if (!isNaN(start) && !isNaN(end) && start < end) {
        intervals.push({ start, end });
      }
    }
  }
  return intervals;
}

function applyExclusions<T extends { start: number; end: number; fadeOutDuration: number }>(
  intervals: T[],
  exclusions: LogoExcludeInterval[],
  defaultFadeMs: number,
): T[] {
  let result = [...intervals];

  for (const excl of exclusions) {
    const nextResult: T[] = [];
    for (const item of result) {
      // 若完全無交集，保留
      if (excl.end <= item.start || excl.start >= item.end) {
        nextResult.push(item);
      } else {
        // 有交集
        // 1. 左半邊剩餘
        if (excl.start > item.start) {
          nextResult.push({
            ...item,
            start: item.start,
            end: excl.start,
            fadeOutDuration: defaultFadeMs,
          });
        }
        // 2. 右半邊剩餘
        if (excl.end < item.end) {
          nextResult.push({
            ...item,
            start: excl.end,
            end: item.end,
            fadeOutDuration: item.fadeOutDuration,
          });
        }
      }
    }
    result = nextResult;
  }

  return result.filter((item) => item.end - item.start > 0.1);
}
