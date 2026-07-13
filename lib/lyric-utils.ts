export interface LyricWord {
  text: string;
  start: number | null;
  end: number | null;
  style?: "B" | "R" | "P" | "G" | string;
}

export interface LyricLine {
  id: string;
  start: number | null;
  end: number | null;
  words: LyricWord[];
  raw?: string;
  isSingleLine?: boolean;
  isCenter?: boolean;
  ktvsp?: number | null;
  style?: "B" | "R" | "P" | "G" | string;
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function trimASCII(str: string): string {
  if (!str) return "";
  return str.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}

export function formatTime(seconds: number | null, useThreeDigitsMs = false): string {
  if (seconds === null) return useThreeDigitsMs ? "00:00.000" : "00:00.00";
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  if (useThreeDigitsMs) {
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  } else {
    const cs = Math.floor(ms / 10);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  }
}

export function parseSeconds(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return 0;
}

export function splitWordsAegisub(text: string): LyricWord[] {
  // Matches CJK characters, English words, punctuation keeping spaces attached
  const regex = /([\u4e00-\u9fa5]|\S+\s*|\s+)/g;
  const matches = text.match(regex) || [];
  const words = matches
    .filter((m) => m.length > 0)
    .map((m) => ({
      text: m,
      start: null,
      end: null,
    }));
  words.push({ text: "", start: null, end: null }); // Append trailing tag placeholder
  return words;
}

export interface LrcMetadata {
  ti?: string;
  ar?: string;
  al?: string;
  au?: string;
  by?: string;
  offset?: string;
  re?: string;
  ve?: string;
  [key: string]: string | undefined;
}

export function parseRawLyrics(text: string): { lines: LyricLine[]; metadata: LrcMetadata } {
  const metadata: LrcMetadata = {};

  // First, parse and extract all data tags from the entire string (allowing multi-line values and escaped brackets)
  const cleanLyricsText = text.replace(
    /\[([^:：\]]+)[:：]((?:\\.|[^\]])*)\]/g,
    (match, rawKey, value) => {
      const trimmedKey = rawKey.trim();
      // If the key is purely digits, it's a timestamp (e.g. [01:23.45]), so we keep it as is
      if (/^\d+$/.test(trimmedKey)) {
        return match;
      }

      // Skip KTV/kstyle tags from being treated as standard metadata
      if (
        trimmedKey.toLowerCase() === "ktv" ||
        trimmedKey.toLowerCase() === "ktvsp" ||
        trimmedKey.toLowerCase() === "kstyle"
      ) {
        return match;
      }

      const predefined = ["ti", "ar", "al", "au", "by", "offset", "re", "ve"];
      const lowerKey = trimmedKey.toLowerCase();
      const finalKey = predefined.includes(lowerKey)
        ? lowerKey
        : lowerKey === "klgno"
          ? "klgno"
          : trimmedKey;

      let val = value.trim();
      val = val.replace(/\\n/g, "\n");
      val = val.replace(/\\\[/g, "[").replace(/\\\]/g, "]");

      if (finalKey === "klgno") {
        if (metadata.klgno) {
          metadata.klgno += ";" + val;
        } else {
          metadata.klgno = val;
        }
      } else if (finalKey.toLowerCase() === "kstyledef") {
        const separatorIdx = val.indexOf(":") > -1 ? val.indexOf(":") : val.indexOf("：");
        if (separatorIdx > -1) {
          const styleId = val.substring(0, separatorIdx).trim();
          const prefix = val.substring(separatorIdx + 1).trim();
          if (styleId && prefix) {
            metadata[`kstyledef_${styleId}`] = prefix;
          }
        }
      } else {
        metadata[finalKey] = val;
      }

      if (finalKey.toLowerCase() === "kstyledef") {
        return ""; // remove kstyledef definition line completely
      }

      return ""; // Remove the data block from the text
    },
  );

  const lines = cleanLyricsText.split(/\r?\n/);
  const result: LyricLine[] = [];

  const lineTimeRegex = /^\[(\d+:\d+(?:\.\d+)?)\]/;
  const wordTimeRegex = /<([^>]+)>([^<]*)/g;

  let pendingSingleLine = false;
  let pendingCenter = false;
  let pendingKtvsp: number | null = null;
  let currentStyle: string | undefined = undefined;
  let blockStyleEncountered: string | undefined = undefined;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Check if this line is [ktv:singleline]
    if (/^\[ktv\s*:\s*singleline\]$/i.test(line.trim())) {
      pendingSingleLine = true;
      continue;
    }

    // Check if this line is [ktv:center]
    if (/^\[ktv\s*:\s*center\]$/i.test(line.trim())) {
      pendingCenter = true;
      continue;
    }

    // Check if this line is a global style block e.g [kstyle:B]
    const styleBlockMatch = /^\[kstyle\s*[:：]\s*([^\]]+)\]$/i.exec(line.trim());
    if (styleBlockMatch) {
      currentStyle = styleBlockMatch[1].trim();
      blockStyleEncountered = currentStyle;
      continue;
    }

    const spMatch = /^\[ktvsp\s*:\s*(\d+:\d+(?:\.\d+)?)\]$/i.exec(line.trim());
    if (spMatch) {
      pendingKtvsp = parseSeconds(spMatch[1]);
      continue;
    }

    let start: number | null = null;
    let cleanText = line;
    let isEnhanced = false;

    const match = lineTimeRegex.exec(line);
    if (match) {
      start = parseSeconds(match[1]);
      cleanText = line.substring(match[0].length);
    }

    let inlineStyleJustDeclared: string | undefined = undefined;
    let inlineStyleMatch;
    while ((inlineStyleMatch = /^\[kstyle\s*[:：]\s*([^\]]+)\]/i.exec(cleanText)) !== null) {
      inlineStyleJustDeclared = inlineStyleMatch[1].trim();
      currentStyle = inlineStyleJustDeclared;
      cleanText = cleanText.substring(inlineStyleMatch[0].length);
    }

    let matchedDefStyle: string | undefined = undefined;
    const cleanTextWithoutWordTags = cleanText.replace(/<[^>]+>/g, "").trim();
    for (const key of Object.keys(metadata)) {
      if (key.startsWith("kstyledef_")) {
        const prefix = metadata[key];
        if (prefix && cleanTextWithoutWordTags.startsWith(prefix)) {
          matchedDefStyle = key.substring("kstyledef_".length);
          break;
        }
      }
    }

    let explicitLineStyle: string | undefined = undefined;
    if (inlineStyleJustDeclared) {
      explicitLineStyle = inlineStyleJustDeclared;
      blockStyleEncountered = undefined;
    } else if (matchedDefStyle) {
      explicitLineStyle = matchedDefStyle;
      blockStyleEncountered = undefined;
    } else if (blockStyleEncountered) {
      explicitLineStyle = blockStyleEncountered;
      blockStyleEncountered = undefined;
    }

    const effectiveLineStyle = explicitLineStyle || currentStyle;

    if (cleanText.includes("<") && cleanText.includes(">")) {
      isEnhanced = true;
    }

    if (isEnhanced) {
      const words: LyricWord[] = [];
      let m;

      const firstTagIndex = cleanText.indexOf("<");
      if (firstTagIndex > 0) {
        words.push({
          text: cleanText.substring(0, firstTagIndex),
          start,
          end: null,
          style: undefined,
        });
      }

      let currentWordStyle: string | undefined = undefined;

      while ((m = wordTimeRegex.exec(cleanText)) !== null) {
        const tagContent = m[1].trim();
        const wText = m[2];

        if (
          tagContent.toLowerCase().startsWith("kstyle:") ||
          tagContent.toLowerCase().startsWith("kstyle：")
        ) {
          currentWordStyle = tagContent.substring(7).trim();
          if (wText) {
            words.push({ text: wText, start: null, end: null, style: currentWordStyle });
            currentWordStyle = undefined;
          }
          continue;
        }

        const wStart = parseSeconds(tagContent);
        words.push({ text: wText, start: wStart, end: null, style: currentWordStyle });
        currentWordStyle = undefined;
      }

      result.push({
        id: generateId(),
        start,
        end: null,
        words:
          words.length > 0
            ? words
            : splitWordsAegisub(cleanText.replace(/<[^>]+>/g, "")).map((w) => ({
                ...w,
                style: undefined,
              })),
        raw: cleanText.replace(/<[^>]+>/g, ""),
        isSingleLine: pendingSingleLine ? true : undefined,
        isCenter: pendingCenter ? true : undefined,
        ktvsp: pendingKtvsp ? pendingKtvsp : undefined,
        style: explicitLineStyle,
      });
      pendingSingleLine = false;
      pendingCenter = false;
      pendingKtvsp = null;
    } else {
      result.push({
        id: generateId(),
        start,
        end: null,
        words: splitWordsAegisub(cleanText).map((w) => ({ ...w, style: undefined })),
        raw: cleanText,
        isSingleLine: pendingSingleLine ? true : undefined,
        isCenter: pendingCenter ? true : undefined,
        ktvsp: pendingKtvsp ? pendingKtvsp : undefined,
        style: explicitLineStyle,
      });
      pendingSingleLine = false;
      pendingCenter = false;
      pendingKtvsp = null;
    }
  }

  return { lines: computeWordEndTimesForLines(result), metadata };
}

export function computeWordEndTimesForLines(lines: LyricLine[]): LyricLine[] {
  return lines.map((line, i) => {
    const nextLine = lines[i + 1];
    let lineEnd = line.end;
    if (lineEnd === null && nextLine && nextLine.start !== null) {
      lineEnd = nextLine.start;
    }
    const nextLineStart = nextLine ? nextLine.start : null;

    const newWords = line.words.map((w) => ({ ...w }));

    if (newWords.length > 0) {
      for (let j = 0; j < newWords.length; j++) {
        const w = newWords[j];
        if (w.start === null) continue;

        let nextStart: number | null = null;
        let foundNextNonEmpty = false;
        let lastEmptyStart: number | null = null;

        for (let k = j + 1; k < newWords.length; k++) {
          const nw = newWords[k];
          if (nw.start !== null) {
            // nw.text is considered non-empty if it contains any character (even spaces)
            // But if it is purely empty (""), it is ignored when determining boundaries.
            if (nw.text !== "") {
              nextStart = nw.start;
              foundNextNonEmpty = true;
              break;
            } else {
              lastEmptyStart = nw.start;
            }
          }
        }

        if (foundNextNonEmpty) {
          w.end = nextStart;
        } else if (lastEmptyStart !== null) {
          w.end = lastEmptyStart;
        } else {
          w.end = lineEnd ?? nextLineStart ?? null;
        }
      }
    }

    return {
      ...line,
      words: newWords,
    };
  });
}

export function exportLrc(
  lines: LyricLine[],
  metadata?: LrcMetadata,
  isEnhanced = false,
  isSimple = false,
  simpleIncludeInstrumental = false,
  paragraphStarts?: boolean[],
): string {
  let lrc = "";

  let exportMetadata = metadata;
  if (!isSimple && metadata) {
    if (metadata.klgno) {
      exportMetadata = { ...metadata };
      delete exportMetadata.klgno;

      const intervals = metadata.klgno.split(";");
      for (const interval of intervals) {
        if (interval.trim()) {
          let encVal = interval.trim().replace(/\r?\n/g, "\\n");
          encVal = encVal.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
          lrc += `[klgno:${encVal}]\n`;
        }
      }
    }
  }

  if (!isSimple && exportMetadata) {
    for (const [key, value] of Object.entries(exportMetadata)) {
      if (value) {
        if (key.startsWith("kstyledef_")) {
          const styleId = key.substring("kstyledef_".length);
          let encodedValue = value.replace(/\r?\n/g, "\\n");
          encodedValue = encodedValue.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
          lrc += `[kstyledef:${styleId}:${encodedValue}]\n`;
        } else {
          let encodedValue = value.replace(/\r?\n/g, "\\n");
          encodedValue = encodedValue.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
          lrc += `[${key}:${encodedValue}]\n`;
        }
      }
    }
  }

  let currentExportStyle: string | undefined = undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isSimple && simpleIncludeInstrumental && i > 0 && paragraphStarts && paragraphStarts[i]) {
      lrc += `\n`;
    }

    if (isSimple) {
      lrc += `${line.words.map((w) => w.text).join("")}\n`;
      continue;
    }

    if (line.isCenter) {
      lrc += `[ktv:center]\n`;
    }

    if (line.isSingleLine) {
      lrc += `[ktv:singleline]\n`;
    }

    if (line.ktvsp !== undefined && line.ktvsp !== null) {
      lrc += `[ktvsp:${formatTime(line.ktvsp, true)}]\n`;
    }

    if (line.style && line.style !== currentExportStyle) {
      lrc += `[kstyle:${line.style}]\n`;
      currentExportStyle = line.style;
    }

    if (line.start === null) {
      lrc += `${line.words.map((w) => w.text).join("")}\n`;
      continue;
    }

    const lineTime = isEnhanced
      ? `[${formatTime(line.start, true)}]`
      : `[${formatTime(line.start)}]`;

    if (isEnhanced) {
      let lineText = "";
      let currentWordStyle = currentExportStyle;
      for (const w of line.words) {
        if (w.style && w.style !== currentWordStyle) {
          lineText += `<kstyle:${w.style}>`;
          currentWordStyle = w.style;
          currentExportStyle = w.style;
        }

        if (w.start !== null) {
          lineText += `<${formatTime(w.start, true)}>${w.text}`;
        } else {
          lineText += w.text;
        }
      }
      lrc += `${lineTime}${lineText}\n`;
    } else {
      lrc += `${lineTime}${line.words.map((w) => w.text).join("")}\n`;
    }
  }

  return lrc;
}

export function formatSrtTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

export function exportSrt(lines: LyricLine[], durationSec: number = 0): string {
  let srt = "";
  let index = 1;

  const validLines = lines.filter(
    (l) => l.start !== null && l.words.some((w) => trimASCII(w.text || "").length > 0),
  );

  for (let i = 0; i < validLines.length; i++) {
    const line = validLines[i];
    const nextLine = validLines[i + 1];

    const startSrt = formatSrtTime(line.start!);

    let endTimeSec: number | null = null;

    if (line.end !== null) {
      endTimeSec = line.end;
    } else {
      const lastWord = line.words[line.words.length - 1];
      if (lastWord && trimASCII(lastWord.text || "") === "" && lastWord.start !== null) {
        endTimeSec = lastWord.start;
      }
    }

    if (endTimeSec === null) {
      let fallbackEnd = line.start! + 5;
      if (nextLine && nextLine.start !== null) {
        fallbackEnd = nextLine.start;
      } else if (durationSec > line.start!) {
        fallbackEnd = durationSec;
      }

      if (fallbackEnd - line.start! > 10) {
        fallbackEnd = line.start! + 10;
      }
      endTimeSec = fallbackEnd;
    }

    if (endTimeSec <= line.start!) {
      endTimeSec = line.start! + 1;
    }

    const endSrt = formatSrtTime(endTimeSec);

    srt += `${index}\n`;
    srt += `${startSrt} --> ${endSrt}\n`;
    srt += `${line.words.map((w) => w.text).join("")}\n\n`;
    index++;
  }

  return srt.trim();
}
