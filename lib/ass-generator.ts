import { LyricLine, LrcMetadata, parseSeconds } from "./lyric-utils";
import {
  parseSvgToAssVector,
  scaleAssVectorPath,
} from "./svg-to-ass-vector";

export interface AssOptions {
  primaryColor: string; // hex
  color2: string; // hex
  color3: string; // hex
  chorusColor: string; // hex
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
  songDuration?: number; // duration of the song in seconds
  logoMaxWidth?: number; // maximum logo width in pixels
  logoMaxHeight?: number; // maximum logo height in pixels
  logoMinInterludeGap?: number; // minimum gap in seconds between paragraphs to display logo
  klgno?: string; // semicolons separated durations of not displaying logo
}

// 內部控制參數
const DEFAULT_INFO_STAY_TIME = 6.0;
const INTRO_DELAY_BUFFER_TIME = 1;

// 間奏 Logo 預設尺寸與間奏門檻常數
const DEFAULT_LOGO_MAX_WIDTH = 450;
const DEFAULT_LOGO_MAX_HEIGHT = 300;
const LOGO_MIN_INTERLUDE_GAP = 9.0;

// =========================================================================
// 【核心設計與模式微調參數】
// =========================================================================
// 1. 歌詞邊框渲染模式 (LYRICS_OUTLINE_MODE)
//    - 'simulated-dual-layer': 雙層模擬追光白邊模式（未唱白色+黑色外框，起唱漸變為設定主體色+白色外框）。
//    - 'traditional': 傳統單層黑色邊框模式（外框永遠為完美實心黑色，歌詞本體由白字漸變為設定的主體色）。
const LYRICS_OUTLINE_MODE: "simulated-dual-layer" | "traditional" =
  "simulated-dual-layer";

// 2. 歌曲資訊 (前奏/間奏開始資訊) 外框構造模式 (INFO_OUTLINE_MODE)
//    - 'simulated-dual-layer': 雙層模擬白色粗外框模式（文字本體為紅色/藍色，背底微調多層純白外框，呈現粗白描邊效果）。
//    - 'traditional': 傳統單層黑色描邊模式（文字本體為紅色/藍色，邊框為實心黑色）。
const INFO_OUTLINE_MODE: "simulated-dual-layer" | "traditional" =
  "simulated-dual-layer";

// 3. 仿雙層邊框粗細設定 (SIMULATED_OUTLINE_WIDTH)
//    適用於 'simulated-dual-layer' 模式，單位為像素，預設為 3。數值越大外框越粗，反之越細。
const SIMULATED_OUTLINE_WIDTH = 3;

// 4. 卡拉OK歌詞追光時間上限與平滑微調參數 (KARAOKE_TIMING_SETTINGS)
//    - ALWAYS_STRETCH_KARAOKE:
//      若設為 true，單一字/單字的追光動畫（\kf / \ko）會總是拉滿到下一個字起點（無縫緊接下一字，不套用上限）。
//      若設為 false，則會受限於下方設定的時間上限，在達到上限後原地停留呈已唱完追光狀態，等候下一個字唱出。
const ALWAYS_STRETCH_KARAOKE = false;

//    - KARAOKE_LIMIT_CHINESE: 非英文字（如中/日/韓文等）的追光動畫上限制（單位為厘秒，1厘秒 = 0.01秒），預設為 50 厘秒 (0.5 秒)。
const KARAOKE_LIMIT_CHINESE = 50;

//    - KARAOKE_LIMIT_ENGLISH: 英文單字或字母（只要含英文字母 A-Z, a-z）的追光動畫上限制（單位為厘秒），預設為 100 厘秒 (1.0 秒)。
const KARAOKE_LIMIT_ENGLISH = 100;

function isEnglishWord(text: string): boolean {
  return /[a-zA-Z]/.test(text);
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
  if (cleanHex.length === 6) {
    const r = cleanHex.slice(0, 2);
    const g = cleanHex.slice(2, 4);
    const b = cleanHex.slice(4, 6);
    return `&H00${b}${g}${r}`;
  }
  return `&H00FFFFFF`;
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

export function generateAss(
  lines: LyricLine[],
  metadata: LrcMetadata,
  options: AssOptions,
): string {
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
    (options.dualRowSpacing !== undefined ? options.dualRowSpacing : 30) *
      scale,
  );
  const dualRowMarginL = Math.round(
    (options.dualRowMarginL !== undefined ? options.dualRowMarginL : 150) *
      scale,
  );
  const dualRowMarginR = Math.round(
    (options.dualRowMarginR !== undefined ? options.dualRowMarginR : 150) *
      scale,
  );
  const dualRowMarginV = Math.round(
    (options.dualRowMarginV !== undefined ? options.dualRowMarginV : 50) *
      scale,
  );

  const infoTitleFontSize = Math.round(
    ((options.infoTitleFontSize || options.fontSize - 10) +
      (options.fontSizeOffset || 0)) *
      scale,
  );
  const infoFontSize = Math.round(
    ((options.infoFontSize || options.fontSize - 40) +
      (options.fontSizeOffset || 0)) *
      scale,
  );

  const margin48Scaled = Math.round(48 * scale);
  const outlineWidth = Math.max(
    1,
    Math.round(
      (options.simulatedOutlineWidth !== undefined
        ? options.simulatedOutlineWidth
        : 3) * scale,
    ),
  );
  const border4Scaled = Math.max(1, Math.round(4 * scale));
  const border3Scaled = Math.max(1, Math.round(3 * scale));

  const primaryAssColor = hexToAssColor(options.primaryColor);

  // Font Fallback 機制: ASS 格式的 Style 是使用逗號 (,) 分隔各個欄位的，不能在 Fontname 裡面包含逗號，否則會導致後面的 Fontsize 解析為 0，造成字體完全無法顯示！
  // Subtitle 渲染器 (如 VSFilter, libass) 底層本身就有作業系統層級的 glyph fallback 機制。
  // 我們這邊只能指定單一的首選字體名稱。
  const primaryFont = options.fontFamily
    ? options.fontFamily.trim()
    : "Noto Sans TC";
  const finalFontChain = primaryFont;

  // 樣式設定
  const styles = `[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${finalFontChain},${Math.round(20 * scale)},&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
Style: TopLeft,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,${(1.5 * scale).toFixed(1)},0,7,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: TopCenter,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,${(1.5 * scale).toFixed(1)},0,8,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: TopRight,${finalFontChain},${Math.round(72 * scale)},&H00FFFFFF,&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,${(1.5 * scale).toFixed(1)},0,9,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
Style: BottomLeft,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,1,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV + dualRowSpacing},0
Style: BottomCenter,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,2,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV},0
Style: BottomRight,${finalFontChain},${fontSize},${primaryAssColor},&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,3,${dualRowMarginL},${dualRowMarginR},${dualRowMarginV},0
Style: CenterInfo,${finalFontChain},${infoFontSize},${primaryAssColor},&H00FFFFFF,&H99000000,&H99000000,0,0,0,0,100,100,0,0,1,${border4Scaled},0,5,${margin48Scaled},${margin48Scaled},${margin48Scaled},0
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
    (l) => l.start !== null && l.words.some((w) => w.text.trim().length > 0),
  );

  // 依據「間奏閥值」(interludeThreshold) 以及是否有「強制單行 (isSingleLine)」將歌詞切分成段落
  const paragraphs: LyricLine[][] = [];
  let currentPara: LyricLine[] = [];

  for (let i = 0; i < validLines.length; i++) {
    const line = validLines[i];
    const prevEnd = i > 0 ? getLineEndTime(validLines[i - 1]) : 0;
    const prevIsSingle = i > 0 && !!validLines[i - 1].isSingleLine;

    const shouldCut =
      (currentPara.length > 0 &&
        line.start! - prevEnd >= options.interludeThreshold) ||
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
    if (
      paragraphs.length > 0 &&
      paragraphs[0][0].start! < DEFAULT_INFO_STAY_TIME
    ) {
      const firstParaEnd = getLineEndTime(
        paragraphs[0][paragraphs[0].length - 1],
      );
      const delayedStart = firstParaEnd + options.interludeBuffer + options.fadeInOutTime + INTRO_DELAY_BUFFER_TIME;
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
        paragraphs.length > 0
          ? paragraphs[0][0].start!
          : DEFAULT_INFO_STAY_TIME,
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
      idx > 0
        ? getLineEndTime(paragraphs[idx - 1][paragraphs[idx - 1].length - 1])
        : 0;
    const gap = p[0].start! - prevEnd;

    let maxAdvance = p[0].start!;
    if (idx > 0) maxAdvance = gap;
    if (p[0].ktvsp != null) maxAdvance = p[0].start! - p[0].ktvsp;

    const isRealInterlude = idx === 0 ? true : (gap >= options.interludeThreshold || p[0].ktvsp != null);

    let dotCount = 0;
    if (isRealInterlude && maxAdvance > 1.0) {
      dotCount = Math.min(4, Math.floor(maxAdvance - 1.0));
      while (dotCount > 0 && dotCount * dotDuration + 1.0 + options.fadeInOutTime > maxAdvance + 0.1) {
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
    const blockDisplayEnd = getLineEndTime(p[p.length - 1]) + options.interludeBuffer + options.fadeInOutTime;
    const truncatedBlockEnd =
      idx < paragraphs.length - 1
        ? Math.min(blockDisplayEnd, paragraphs[idx + 1][0].start! - 0.1)
        : blockDisplayEnd;

    // 判斷兩者時間區間是否有交集 [infoStart, infoEnd] 與 [blockDisplayStart, truncatedBlockEnd]
    if (
      Math.max(infoStart, blockDisplayStart) <
      Math.min(infoEnd, truncatedBlockEnd)
    ) {
      overlapsWithLyrics = true;
    }
  });

  // 2. 藍色歌曲資訊的排版：自底部往上排 (BottomCenter)
  // 若發生時間重疊，將 detailBottomY 拉到雙行歌詞之上
  let detailBottomY = playResY - Math.round(55 * scale);
  if (overlapsWithLyrics) {
    // 雙行歌詞第一排(BottomLeft)的上緣：playResY - dualRowMarginV - dualRowSpacing - fontSize
    // 我們要把歌曲詳細資訊底邊放在這個上緣之上至少 60 像素
    const lyricsTopY = playResY - dualRowMarginV - dualRowSpacing - fontSize;
    detailBottomY = Math.round(lyricsTopY - 60 * scale);
  }

  // 3. 紅色標題字的排版：
  // 若未重疊，則放畫面中央偏上 (centerY - 1.5 行)
  // 若發生重疊，將其置於歌曲詳細資訊最上方行的上面，確保文字學上完全不重疊，且維持 40px 的安全間距 (標題是 an5 置中-置中，需減去半個字高與 40px 間距)
  let titleY = centerY - Math.round(1.5 * titleSize);

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
    // 計算歌曲詳細資訊的實際總高度 (包括新加 of 空行)
    const detailHeight = artistAlbum.length * detailFontSize;
    titleY = Math.round(
      detailBottomY - detailHeight - Math.round(40 * scale) - titleSize / 2,
    );
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
      idx > 0
        ? getLineEndTime(paragraphs[idx - 1][paragraphs[idx - 1].length - 1])
        : 0;
    const gap = p[0].start! - prevEnd;

    const isRealInterlude =
      idx === 0
        ? true
        : (gap >= options.interludeThreshold || p[0].ktvsp != null);

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
      while (dotCount > 0 && dotCount * dotDuration + 1.0 + options.fadeInOutTime > maxAdvance + 0.1) {
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
        return Math.min(
          info.blockDisplayEnd,
          pInfos[idx + 1].p[0].start! - 0.1,
        );
      }
    } else {
      return info.blockDisplayEnd;
    }
  });

  paragraphs.forEach((p, idx) => {
    const pInfo = pInfos[idx];
    const {
      blockDisplayStart,
      dotCount,
      isStartRealInterlude,
      isEndRealInterlude,
    } = pInfo;
    const truncatedBlockEnd = finalTruncatedBlockEnds[idx];

    // 產生倒數小白圓的 Events
    if (dotCount > 0) {
      const isSingleLine = p.length === 1;

      let xPos = 0;
      let yPos = 0;
      const currentMarginV = dualRowMarginV;
      const currentMarginL = dualRowMarginL;
      const offset15 = Math.round(15 * scale);
      const offset20 = Math.round(20 * scale);
      // 計算第一行文字上方的適當座標位置
      if (isSingleLine) {
        const totalW = (dotCount - 1) * dotSpacing + 2 * dotRadius;
        // BottomCenter 座標
        xPos = centerX - totalW / 2 + dotRadius;
        yPos = playResY - currentMarginV - fontSize - dotRadius - offset20;
      } else {
        // BottomLeft 座標，小白圓發端對齊 BottomLeft 歌詞的起始位置（外外多出 15px 左右與第一行歌詞對齊）
        xPos = currentMarginL + offset15 + dotRadius;
        // 離第一排歌詞上緣 offset20
        yPos =
          playResY -
          currentMarginV -
          fontSize -
          dotRadius -
          offset20 -
          dualRowSpacing;
      }

      for (let d = 0; d < dotCount; d++) {
        const dDots = dotCount - d;
        // 第一個圓出現的時間
        let dotStart = p[0].start! - 1.0 - dDots;
        let dotEnd = dotStart + dotDuration;

        let dotFadeIn = 0;
        if (d === 0) {
          dotStart -= options.fadeInOutTime;
          dotFadeIn = fadeMs;
        }

        // 為了相容所有播放器對 ASS Vector Outlines 大小和 Opaque Border Style 3 的處理，
        // 我們採用最穩定且效果最好的雙層同心圓繪製法 (Double-layer Concentric Circles)：
        const dotOuterColorAss = hexToAssColor(options.dotOuterColor || "#888888");
        const dotInnerColorAss = hexToAssColor(options.dotInnerColor || "#FFFFFF");
        const outerRadius = Math.round(fontSize * outerRatio);
        const innerRadius = Math.max(1, Math.round(fontSize * innerRatio));

        // 1. 底層繪製稍微大一點、顏色可由用戶定義的圓形外框 (預設暗灰色)
        const vecOuter = getDotsVector(dDots, outerRadius, dotSpacing);
        ass += `Dialogue: 5,${formatAssTime(dotStart)},${formatAssTime(dotEnd)},TopLeft,,0,0,0,,{\\fad(${dotFadeIn},0)\\pos(${xPos},${yPos})\\c${dotOuterColorAss}&\\bord0\\shad0\\1a&H00&}{\\p1}${vecOuter}{\\p0}\n`;

        // 2. 頂層繪製稍微小一點、顏色可由用戶定義的圓形本體 (預設純白色)，疊加在相同位置，形成極為完美的圓形外邊框效果
        const vecInner = getDotsVector(dDots, innerRadius, dotSpacing);
        ass += `Dialogue: 6,${formatAssTime(dotStart)},${formatAssTime(dotEnd)},TopLeft,,0,0,0,,{\\fad(${dotFadeIn},0)\\pos(${xPos},${yPos})\\c${dotInnerColorAss}&\\bord0\\shad0\\1a&H00&}{\\p1}${vecInner}{\\p0}\n`;
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
          const trigIdx = Math.min(
            options.nextTriggerIndex,
            prevLine.words.length - 1,
          );
          const trigWord = prevLine.words[trigIdx];
          start =
            trigWord && trigWord.start !== null
              ? trigWord.start
              : getLineEndTime(prevLine);
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
      const isReallyCentered = isCentered || isSingleLine;

      let end = truncatedBlockEnd;
      if (isReallyCentered) {
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

    for (let i = 0; i < p.length; i++) {
      const line = p[i];
      const displayStart = lineDisplayStarts[i];
      const displayEnd = lineDisplayEnds[i];

      const lastIsCentered = p.length % 2 !== 0 && p.length >= 3;
      const isLast = i === p.length - 1;
      const isCentered = isLast && lastIsCentered;
      const isSingleLine = p.length === 1;
      const isReallyCentered = isCentered || isSingleLine;

      const row = isReallyCentered ? 2 : i % 2 === 0 ? 1 : 2;
      const style = isReallyCentered
        ? "BottomCenter"
        : row === 1
          ? "BottomLeft"
          : "BottomRight";

      const fadeIn =
        displayStart === blockDisplayStart && isStartRealInterlude ? fadeMs : 0;
      const fadeOut =
        displayEnd === truncatedBlockEnd && isEndRealInterlude ? fadeMs : 0;

      let karaokeStr = "";
      let karaokeKoStr = "";
      const validWords = line.words.filter(
        (w) => w.text.trim().length > 0 || w.text === " ",
      );

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
              line.words[line.words.length - 1].text.trim() === "";
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
                lineGlobalIdx !== -1
                  ? validLines[lineGlobalIdx + 1]
                  : undefined;

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

        if (!w.text.trim()) {
          karaokeStr += `{\\k${durCs}}${w.text}`;
          karaokeKoStr += `{\\k${durCs}}${w.text}`;
        } else {
          if (!ALWAYS_STRETCH_KARAOKE && durCs > defaultLimitVal) {
            const fillCs = defaultLimitVal;
            const delayCs = durCs - defaultLimitVal;
            karaokeStr += `{\\kf${fillCs}}${w.text}{\\k${delayCs}}`;
            karaokeKoStr += `{\\ko${fillCs}}${w.text}{\\k${delayCs}}`;
          } else {
            karaokeStr += `{\\kf${durCs}}${w.text}`;
            karaokeKoStr += `{\\ko${durCs}}${w.text}`;
          }
        }
      }

      const startDelaySec = (line.start || displayStart) - displayStart;
      if (startDelaySec > 0) {
        const startDelayCs = Math.round(startDelaySec * 100);
        karaokeStr = `{\\kf${startDelayCs}}${karaokeStr}`;
        karaokeKoStr = `{\\ko${startDelayCs}}${karaokeKoStr}`;
      }

      // 核心定位座標計算：解析目前樣式對應的對齊與位置
      let alignment = 2; // Default BottomCenter
      let baseX = centerX;
      let baseY = playResY - dualRowMarginV; // MarginV is dualRowMarginV scaled

      if (style === "BottomLeft") {
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
          ass += `Dialogue: ${row},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX + dx},${baseY + dy})\\bord0\\shad0\\fs${fontSize}\\1c&HFFFFFF&\\2c&H000000&\\fad(${fadeIn},${fadeOut})}${karaokeStr}\n`;
        });

        // 核心唱詞本體層 (頂層)：疊在最中央，未唱時主體設為白色且不透明 \2c&HFFFFFF&\2a&H00&，起唱後漸變為設定的唱詞主體色
        ass += `Dialogue: ${row + 2},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX},${baseY})\\bord0\\shad0\\fs${fontSize}\\1c${primaryAssColor}\\2c&HFFFFFF&\\2a&H00&\\fad(${fadeIn},${fadeOut})}${karaokeStr}\n`;
      } else {
        // traditional 傳統單層模式：外框永遠是實心黑色 &H000000&，文字主體由白 (&HFFFFFF&) 漸變為設定色 (primaryAssColor)
        // 直接使用 ASS 內建的 \bord4\3c&H000000& 確保描邊，將 \2c 設為白色 \1c 設為唱完的 primaryAssColor
        ass += `Dialogue: ${row},${formatAssTime(displayStart)},${formatAssTime(displayEnd)},${style},,0,0,0,,{\\an${alignment}\\pos(${baseX},${baseY})\\bord${border4Scaled}\\shad0\\fs${fontSize}\\1c${primaryAssColor}\\2c&HFFFFFF&\\3c&H000000&\\fad(${fadeIn},${fadeOut})}${karaokeStr}\n`;
      }
    }
  });

  // 自訂間奏 Logo（測試階段：一律顯示於左上角）
  if (options.interludeLogoSvg) {
    const graphic = parseSvgToAssVector(options.interludeLogoSvg);
    if (graphic) {
      const maxLogoW = Math.round((options.logoMaxWidth ?? DEFAULT_LOGO_MAX_WIDTH) * scale);
      const maxLogoH = Math.round((options.logoMaxHeight ?? DEFAULT_LOGO_MAX_HEIGHT) * scale);
      const fitScale = Math.min(
        maxLogoW / graphic.width,
        maxLogoH / graphic.height,
      );
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
              logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs });
            }
          }
        } else {
          // Outro - after the last paragraph
          if (options.songDuration && options.songDuration > logoStart) {
            const logoEnd = options.songDuration;
            logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: 1000 }); // "最後1秒會再淡出"
          } else if (!options.songDuration) {
             // Fallback if no songDuration available
             const logoEnd = logoStart + 10.0;
             logoAppearances.push({ start: logoStart, end: logoEnd, fadeOutDuration: fadeMs });
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

      for (const item of graphic.items) {
        const scaledPath = scaleAssVectorPath(item.path, fitScale);
        for (const appearance of logoAppearances) {
          if (appearance.start >= appearance.end) continue;
          
          const startStr = formatAssTime(appearance.start);
          const endStr = formatAssTime(appearance.end);
          const fadeText = `\\fad(${fadeMs},${appearance.fadeOutDuration})`;
          
          if (item.strokeOnly && item.strokeColor) {
            const bord = Math.max(
              1,
              Math.round((item.strokeWidth || 1) * fitScale),
            );
            ass += `Dialogue: 3,${startStr},${endStr},TopLeft,,0,0,0,,{\\an7\\pos(${logoX},${logoY})${fadeText}\\1a&HFF&\\3c${item.strokeColor}&\\bord${bord}\\shad0}{\\p1}${scaledPath}{\\p0}\n`;
          } else if (item.fillColor) {
            ass += `Dialogue: 3,${startStr},${endStr},TopLeft,,0,0,0,,{\\an7\\pos(${logoX},${logoY})${fadeText}\\c${item.fillColor}&\\bord0\\shad0\\1a&H00&}{\\p1}${scaledPath}{\\p0}\n`;
          }
        }
      }
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

function applyExclusions(
  intervals: { start: number; end: number; fadeOutDuration: number }[],
  exclusions: LogoExcludeInterval[],
  defaultFadeMs: number,
): { start: number; end: number; fadeOutDuration: number }[] {
  let result = [...intervals];

  for (const excl of exclusions) {
    const nextResult: { start: number; end: number; fadeOutDuration: number }[] = [];
    for (const item of result) {
      // 若完全無交集，保留
      if (excl.end <= item.start || excl.start >= item.end) {
        nextResult.push(item);
      } else {
        // 有交集
        // 1. 左半邊剩餘
        if (excl.start > item.start) {
          nextResult.push({
            start: item.start,
            end: excl.start,
            fadeOutDuration: defaultFadeMs,
          });
        }
        // 2. 右半邊剩餘
        if (excl.end < item.end) {
          nextResult.push({
            start: excl.end,
            end: item.end,
            fadeOutDuration: item.fadeOutDuration,
          });
        }
      }
    }
    result = nextResult;
  }

  return result.filter(item => item.end - item.start > 0.1);
}

