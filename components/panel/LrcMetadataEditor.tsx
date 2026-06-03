"use client";
import { useEditor } from "@/components/base/EditorProvider";
import { Tooltip } from "@/components/common/Tooltip";
import { formatTime, LrcMetadata, LyricLine } from "@/lib/lyric-utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// --- Smart Import Logic ---
interface SmartExtraction {
  lineId: string;
  originalText: string;
  suggestions: { key: string; value: string }[];
  selected: boolean;
}

interface Extractor {
  name: string;
  match: (
    text: string,
    raw: string,
    lineIndex: number,
    totalLines: number,
  ) => { key: string; value: string }[] | null;
}

const extractors: Extractor[] = [
  {
    name: "Bracketed Tag Regex",
    match: (text, raw) => {
      const match = raw.trim().match(/^\[(.+?)[:：]\s*(.+)\]$/);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        const lowerKey = key.toLowerCase();

        if (lowerKey.startsWith("kstyledef") || lowerKey === "kstyle" || lowerKey === "ktvsp") {
          return null;
        }

        if (["词", "作词", "作詞", "lyrics", "lyricist"].includes(lowerKey)) key = "au";
        if (["演唱", "歌手", "vocal", "vocals", "singer"].includes(lowerKey)) key = "ar";
        if (["专辑", "專輯", "album"].includes(lowerKey)) key = "al";
        return [{ key, value }];
      }
      return null;
    },
  },
  {
    name: "Colon Regex",
    match: (text, raw, lineIndex, totalLines) => {
      const isEdge = lineIndex < 15 || lineIndex > totalLines - 15;

      // Allow up to 40 chars for key, avoiding lyric-ending punctuation inside the key
      const match = text.match(/^([^\.,!?。，！？\n]{1,40})[:：]\s*(.+)$/iu);
      if (match) {
        let key = match[1].trim();
        let value = match[2].trim();
        const lowerKey = key.toLowerCase();

        // Exclude common vocal role markers from being extracted as metadata
        const isRole =
          /^(男|女|合|合唱|男声|女声|主唱|和声|rap|os|口白|旁白|[\u4e00-\u9fa5A-Za-z0-9]+)$/i.test(
            key,
          );
        if (["男", "女", "合", "合唱"].includes(key)) {
          return null;
        }

        const originalLowerKey = lowerKey;

        if (["词", "作词", "作詞", "lyrics", "lyricist"].includes(lowerKey)) key = "au";
        if (["演唱", "歌手", "vocal", "vocals", "singer"].includes(lowerKey)) key = "ar";
        if (["专辑", "專輯", "album"].includes(lowerKey)) key = "al";

        const isKnown =
          [
            "au",
            "ar",
            "al",
            "ti",
            "by",
            "lyric",
            "compos",
            "arrang",
            "vocal",
            "produc",
            "mix",
            "master",
          ].some((k) => key.toLowerCase().includes(k)) ||
          [
            "词",
            "曲",
            "编",
            "唱",
            "后",
            "混",
            "母带",
            "制作",
            "吉他",
            "贝斯",
            "鼓",
            "键盘",
            "和声",
            "弦乐",
            "乐器",
            "歌名",
            "标题",
            "標題",
            "原唱",
            "翻唱",
            "鸣谢",
          ].some((k) => originalLowerKey.includes(k));

        if (!isKnown) {
          // If it's not a known metadata field, it might be a character name speaking or a specific singer.
          // If the "key" is very short (like a name), reject it, especially in the middle of the song.
          if (!isEdge || key.length <= 4) {
            return null; // Reject likely false positive (e.g. conversational lyrics or singer names like 美琪：)
          }
          if (key.length > 15) {
            return null; // Reject long false positive sentences
          }
        }

        return [{ key, value }];
      }
      return null;
    },
  },
  {
    name: "Dash Title Artist Regex",
    match: (text, raw, lineIndex) => {
      if (lineIndex > 10) return null; // Only accept at the very beginning

      // Require spaces around the dash to avoid matching hyphenated words like "Oh-oh"
      const match = text.match(/^(.+?)(?:\s+-\s+|\s*[–—]\s*)(.+)$/);
      if (
        match &&
        text.length < 100 &&
        !text.includes("，") &&
        !text.includes("。") &&
        !text.includes("？")
      ) {
        return [
          { key: "ti", value: match[1].trim() },
          { key: "ar", value: match[2].trim() },
        ];
      }
      return null;
    },
  },
];

export function extractMetadataFromLines(lines: LyricLine[]): SmartExtraction[] {
  const results: SmartExtraction[] = [];
  const totalLines = lines.length;

  lines.forEach((line, index) => {
    const text =
      line.words && line.words.length > 0
        ? line.words
            .map((w) => w.text)
            .join("")
            .trim()
        : line.raw
            ?.replace(/\[.*?\]/g, "")
            .replace(/<.*?>/g, "")
            .trim() || "";

    // Fallback for lines that might strictly be Metadata
    const raw = line.raw || "";

    if (!text && !raw) return;

    for (const ext of extractors) {
      const suggestions = ext.match(text, raw, index, totalLines);
      if (suggestions && suggestions.length > 0) {
        // Determine original text to show to user
        let displayOriginalText = text;
        if (!displayOriginalText && raw) {
          displayOriginalText = raw.trim();
        }
        results.push({
          lineId: line.id,
          originalText: displayOriginalText,
          suggestions,
          selected: true,
        });
        break; // Use the first successful extractor
      }
    }
  });
  return results;
}
// ----------------------------

const InputRow = ({
  label,
  mKey,
  placeholder,
  value,
  onChange,
  onBlur,
  tooltip,
}: {
  label: string;
  mKey: keyof LrcMetadata;
  placeholder?: string;
  value: string;
  onChange: (key: string, val: string) => void;
  onBlur?: () => void;
  tooltip?: string;
}) => {
  const hasBrackets = /[\[\]]/.test(value || "");
  return (
    <div className={`flex flex-row items-center py-2 gap-2 border-transparent`}>
      <div className="flex items-center sm:w-20 w-16 shrink-0 gap-1 pl-1 sm:pl-0 text-right justify-end">
        <label
          className={`text-[10px] font-semibold text-[var(--app-text-secondary)] uppercase tracking-wider sm:text-xs`}
        >
          {label}
        </label>
        {tooltip && (
          <Tooltip
            title={
              <span className="normal-case max-w-[200px] whitespace-normal block">{tooltip}</span>
            }
          >
            <Info className="w-3 h-3 text-[var(--app-text-muted)] cursor-help" />
          </Tooltip>
        )}
      </div>
      <div className="flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(mKey as string, e.target.value)}
          onBlur={onBlur}
          className={`w-full bg-[var(--app-bg-input)] text-xs border border-[var(--app-border-light)] rounded focus:outline-none focus:border-[var(--app-accent)] transition-colors placeholder:opacity-40 sm:text-sm px-2 sm:px-3 py-1.5 ${hasBrackets ? "!text-red-500 font-medium" : ""}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

export function LrcMetadataEditor({ onClose }: { onClose?: () => void }) {
  const { lrcMetadata, setLrcMetadata, commitLrcMetadata, metadata, duration, lines, commitLines } =
    useEditor();
  const [formData, setFormData] = useState<LrcMetadata>(() => ({ ...lrcMetadata }));
  const [customKeys, setCustomKeys] = useState<{ key: string; value: string }[]>(() => {
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length"];
    const sysKeysList = ["kti", "kar", "kal", "ko", "tt", "tte", "kth", "klg", "klgno"];
    const isSystemKey = (key: string) => {
      const lower = key.toLowerCase();
      return (
        sysKeysList.includes(lower) ||
        lower.startsWith("kstyledef_") ||
        lower === "kstyledef" ||
        lower === "kstyle"
      );
    };
    const currentCustom: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(lrcMetadata)) {
      if (!predefinedKeys.includes(key) && value) {
        if (!isSystemKey(key)) {
          currentCustom.push({ key, value });
        }
      }
    }
    return currentCustom;
  });
  const [systemKeys, setSystemKeys] = useState<{ key: string; value: string }[]>(() => {
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length"];
    const sysKeysList = ["kti", "kar", "kal", "ko", "tt", "tte", "kth", "klg", "klgno"];
    const isSystemKey = (key: string) => {
      const lower = key.toLowerCase();
      return (
        sysKeysList.includes(lower) ||
        lower.startsWith("kstyledef_") ||
        lower === "kstyledef" ||
        lower === "kstyle"
      );
    };
    const currentSystem: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(lrcMetadata)) {
      if (!predefinedKeys.includes(key) && value) {
        if (isSystemKey(key)) {
          currentSystem.push({ key, value });
        }
      }
    }
    return currentSystem;
  });
  const [systemKeysOpen, setSystemKeysOpen] = useState(false);
  const isDialog = !!onClose;
  const lastAppliedRef = useRef<LrcMetadata | null>(null);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);

  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [smartExtractions, setSmartExtractions] = useState<SmartExtraction[]>([]);

  const ENABLE_FIXED_TAGS = true; // 預留參數控制固定標籤塞入

  const latestDataRef = useRef<{
    formData: LrcMetadata;
    customKeys: { key: string; value: string }[];
    systemKeys: { key: string; value: string }[];
  }>({ formData, customKeys, systemKeys });

  useEffect(() => {
    latestDataRef.current = { formData, customKeys, systemKeys };
  }, [formData, customKeys, systemKeys]);

  const commitChanges = React.useCallback(
    (finalData: LrcMetadata) => {
      commitLrcMetadata(finalData, "Edit LRC Metadata");
    },
    [commitLrcMetadata],
  );

  // Handle external lrcMetadata changes, ignoring self-triggered changes
  useEffect(() => {
    if (lastAppliedRef.current === lrcMetadata) return;

    setFormData({ ...lrcMetadata });
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length"];
    const sysKeysList = ["kti", "kar", "kal", "ko", "tt", "tte", "kth", "klg", "klgno"];
    const isSystemKey = (key: string) => {
      const lower = key.toLowerCase();
      return (
        sysKeysList.includes(lower) ||
        lower.startsWith("kstyledef_") ||
        lower === "kstyledef" ||
        lower === "kstyle"
      );
    };

    const currentCustom: { key: string; value: string }[] = [];
    const currentSystem: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(lrcMetadata)) {
      if (!predefinedKeys.includes(key) && value) {
        if (isSystemKey(key)) {
          currentSystem.push({ key, value });
        } else {
          currentCustom.push({ key, value });
        }
      }
    }
    setCustomKeys(currentCustom);
    setSystemKeys(currentSystem);
    lastAppliedRef.current = lrcMetadata;
  }, [lrcMetadata]);

  const applyChanges = (
    currentFormData: LrcMetadata,
    currentCustomKeys: typeof customKeys,
    currentSystemKeys: typeof systemKeys = systemKeys,
    shouldCommit = false,
  ) => {
    // Preserve existing tags from lrcMetadata to prevent any missing tags
    const finalData: LrcMetadata = { ...lrcMetadata };
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length"];

    // Clear all predefined keys to respect user deletions
    predefinedKeys.forEach((k) => {
      delete finalData[k];
    });

    // Set updated predefined keys
    predefinedKeys.forEach((k) => {
      if (currentFormData[k]) finalData[k] = currentFormData[k];
    });

    // Clear all old keys that are not predefined
    const activeCustomKeys = new Set(currentCustomKeys.map((ck) => ck.key).filter(Boolean));
    const activeSystemKeys = new Set(currentSystemKeys.map((sk) => sk.key).filter(Boolean));

    const allowedKeys = new Set([
      ...predefinedKeys,
      ...Array.from(activeCustomKeys),
      ...Array.from(activeSystemKeys),
    ]);

    // Delete any key in finalData that is not in the allowedKeys set
    for (const key of Object.keys(finalData)) {
      if (!allowedKeys.has(key)) {
        delete finalData[key];
      }
    }

    // Apply custom keys from currentCustomKeys
    currentCustomKeys.forEach(({ key, value }) => {
      if (key && value) finalData[key] = value;
    });

    // Apply system keys from currentSystemKeys
    currentSystemKeys.forEach(({ key, value }) => {
      if (key && value) finalData[key] = value;
    });

    lastAppliedRef.current = finalData;
    setLrcMetadata(finalData);
    if (shouldCommit) {
      commitChanges(finalData);
    }
  };

  const getAutoFilledData = (prev: LrcMetadata, overwrite: boolean): LrcMetadata => {
    // Start with lrcMetadata as baseline to prevent missing properties (e.g. on mount race conditions)
    const newData = { ...lrcMetadata, ...prev };

    if (metadata) {
      if (overwrite || !newData.ti) newData.ti = metadata.title || newData.ti;
      if (overwrite || !newData.ar) newData.ar = metadata.artist || newData.ar;
      if (overwrite || !newData.al) newData.al = metadata.album || newData.al;
    }

    if (duration > 0 && (overwrite || !newData.length)) {
      // Format duration to mm:ss (discarding sub-seconds for length is decent, or keep them)
      newData.length = formatTime(duration, false).split(".")[0];
    }

    if (overwrite || !newData.offset) newData.offset = "0";

    if (ENABLE_FIXED_TAGS && (overwrite || !newData.re)) {
      newData.re = "Enhanced LRC Studio https://elrc.yuaner.tw/";
    }

    return newData;
  };

  const triggerFillFromAudio = (overwrite: boolean) => {
    const {
      formData: currentFormData,
      customKeys: currentCustomKeys,
      systemKeys: currentSystemKeys,
    } = latestDataRef.current;
    const newData = getAutoFilledData(currentFormData, overwrite);

    if (JSON.stringify(currentFormData) !== JSON.stringify(newData)) {
      setFormData(newData);
      applyChanges(newData, currentCustomKeys, currentSystemKeys, true);
    }
  };

  // Apply auto-fill logic automatically if file metadata exists/changes
  useEffect(() => {
    if (autoFillEnabled && (metadata || duration > 0)) {
      triggerFillFromAudio(false); // false means do NOT overwrite existing tags
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metadata, duration, autoFillEnabled]); // when generic audio metadata or duration is ready, try to fill

  const handleBlur = () => {
    // Clean up empty custom keys visually on blur? Only if they are empty
    applyChanges(formData, customKeys, systemKeys, true);
  };

  const handleChange = (key: string, value: string) => {
    const newData = { ...formData, [key]: value };
    setFormData(newData);
    applyChanges(newData, customKeys, systemKeys, false);
  };

  const handleCustomChange = (index: number, newKey: string, newValue: string) => {
    const next = [...customKeys];
    next[index] = { key: newKey, value: newValue };
    setCustomKeys(next);
    applyChanges(formData, next, systemKeys, false);
  };

  const removeCustom = (index: number) => {
    const next = customKeys.filter((_, i) => i !== index);
    setCustomKeys(next);
    applyChanges(formData, next, systemKeys, true);
  };

  const addCustom = () => {
    const next = [...customKeys, { key: "", value: "" }];
    setCustomKeys(next);
    // Wait for user to type before committing to avoid empty tags causing UI resets
  };

  const handleSystemChange = (index: number, newKey: string, newValue: string) => {
    const next = [...systemKeys];
    next[index] = { key: newKey, value: newValue };
    setSystemKeys(next);
    applyChanges(formData, customKeys, next, false);
  };

  const removeSystem = (index: number) => {
    const next = systemKeys.filter((_, i) => i !== index);
    setSystemKeys(next);
    applyChanges(formData, customKeys, next, true);
  };

  const addSystem = () => {
    const next = [...systemKeys, { key: "", value: "" }];
    setSystemKeys(next);
  };

  const handleClose = () => {
    handleBlur();
    if (onClose) onClose();
  };

  // --- Smart Import Dialog ---
  const openSmartImport = () => {
    const extracted = extractMetadataFromLines(lines);
    setSmartExtractions(extracted);
    setSmartImportOpen(true);
  };

  const applySmartExtractions = () => {
    const selected = smartExtractions.filter((e) => e.selected);
    if (selected.length === 0) {
      setSmartImportOpen(false);
      return;
    }

    const newCustomKeys = [...customKeys];
    const newSystemKeys = [...systemKeys];
    const newFormData = { ...formData };
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length"];
    const sysKeysList = ["kti", "kar", "kal", "ko", "tt", "tte", "kth", "klg", "klgno"];
    const isSystemKey = (key: string) => {
      const lower = key.toLowerCase();
      return (
        sysKeysList.includes(lower) ||
        lower.startsWith("kstyledef_") ||
        lower === "kstyledef" ||
        lower === "kstyle"
      );
    };

    selected.forEach((ext) => {
      ext.suggestions.forEach((sug) => {
        if (predefinedKeys.includes(sug.key)) {
          newFormData[sug.key] = sug.value;
        } else {
          if (isSystemKey(sug.key)) {
            // Avoid inserting duplicates
            if (!newSystemKeys.find((sk) => sk.key.toLowerCase() === sug.key.toLowerCase())) {
              newSystemKeys.push({ key: sug.key, value: sug.value });
            }
          } else {
            // Avoid inserting duplicates
            if (!newCustomKeys.find((ck) => ck.key === sug.key && ck.value === sug.value)) {
              newCustomKeys.push({ key: sug.key, value: sug.value });
            }
          }
        }
      });
    });

    // Remove lines from editor
    const lineIdsToRemove = selected.map((s) => s.lineId);
    commitLines(
      (prev) => prev.filter((l) => !lineIdsToRemove.includes(l.id)),
      "Smart Import LRC Metadata",
    );

    setFormData(newFormData);
    setCustomKeys(newCustomKeys);
    setSystemKeys(newSystemKeys);
    applyChanges(newFormData, newCustomKeys, newSystemKeys, true);
    setSmartImportOpen(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="overflow-y-auto flex-1 custom-scrollbar space-y-4 pb-4 select-text px-4 py-2">
        <div className="flex flex-col gap-3 pb-3 border-b border-[var(--app-border-base)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => triggerFillFromAudio(true)}
              disabled={!metadata && duration === 0}
              className={`text-xs flex justify-center items-center gap-1.5 px-3 py-1.5 rounded transition-colors border shadow-sm ${metadata || duration ? "bg-[var(--app-bg-input)] hover:bg-[var(--app-bg-hover)] border-[var(--app-border-light)] text-[var(--app-text-secondary)]" : "bg-transparent border-[var(--app-border-base)] text-[var(--app-text-muted)] opacity-50 cursor-not-allowed"}`}
            >
              <Download className="w-3.5 h-3.5" /> 由音檔 ID3/Vorbis 標籤匯入
            </button>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--app-text-secondary)] hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={autoFillEnabled}
                onChange={(e) => setAutoFillEnabled(e.target.checked)}
                className="accent-[var(--app-accent)]"
              />
              自動補齊 (未填項目)
            </label>
          </div>
        </div>

        <div className={`space-y-1`}>
          <InputRow
            label="建立者 [by]"
            mKey="by"
            placeholder="LRC創作者"
            value={(formData.by as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="位移 [offset]"
            mKey="offset"
            placeholder="0"
            value={(formData.offset as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
            tooltip="本欄位僅作為宣告用途，不建議直接在本欄位手動調整。若要調整平移，建議利用本工具「整份歌詞時間平移」的功能讓所有時間戳真正平移。"
          />
          <InputRow
            label="標題 [ti]"
            mKey="ti"
            placeholder="歌名"
            value={(formData.ti as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="歌手 [ar]"
            mKey="ar"
            placeholder="演出者"
            value={(formData.ar as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="專輯 [al]"
            mKey="al"
            placeholder="唱片集"
            value={(formData.al as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="作者 [au]"
            mKey="au"
            placeholder="作詞/作曲"
            value={(formData.au as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="長度 [length]"
            mKey="length"
            placeholder="mm:ss"
            value={(formData.length as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="編輯器 [re]"
            mKey="re"
            placeholder="Enhanced LRC Studio"
            value={(formData.re as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <InputRow
            label="版本 [ve]"
            mKey="ve"
            placeholder="1.0"
            value={(formData.ve as string) || ""}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>

        <div className="space-y-3 pt-4 border-t border-[var(--app-border-base)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-[var(--app-text-secondary)]">
              自訂標籤
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={openSmartImport}
                className="text-[10px] flex items-center gap-1.5 bg-[var(--app-accent)] text-black hover:bg-[var(--app-accent-hover)] font-medium px-2 py-1 rounded transition-colors"
              >
                <Wand2 className="w-3 h-3" /> 由歌詞文件智慧匯入
              </button>
              <button
                onClick={addCustom}
                className="text-[10px] flex items-center gap-1 bg-[var(--app-bg-input)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-light)] px-2 py-1 rounded transition-colors"
              >
                <Plus className="w-3 h-3" /> 新增
              </button>
            </div>
          </div>

          {customKeys.length === 0 ? (
            <div className="text-[10px] text-[var(--app-text-muted)] text-center py-4 bg-[var(--app-bg-base)] rounded border border-[var(--app-border-light)] border-dashed">
              尚無自訂標籤
            </div>
          ) : (
            <div className="space-y-2 bg-[var(--app-bg-base)] p-2 sm:p-3 rounded-lg border border-[var(--app-border-base)] overflow-hidden">
              {customKeys.map((item, i) => {
                const hasKeyBrackets = /[\[\]]/.test(item.key || "");
                const hasValueBrackets = /[\[\]]/.test(item.value || "");
                return (
                  <div key={i} className={`flex items-center gap-1 w-full`}>
                    <div className={`flex items-center w-auto shrink-0`}>
                      <input
                        type="text"
                        value={item.key}
                        onChange={(e) => handleCustomChange(i, e.target.value.trim(), item.value)}
                        onBlur={handleBlur}
                        className={`bg-[var(--app-bg-input)] text-xs border border-[var(--app-border-light)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] w-14 sm:w-20 ${hasKeyBrackets ? "!text-red-500 font-medium" : ""}`}
                        placeholder="key"
                      />
                      <div className="text-xs font-mono text-[var(--app-text-muted)] ml-0.5 sm:ml-1">
                        :
                      </div>
                    </div>
                    <div className={`flex items-center flex-1 min-w-0`}>
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleCustomChange(i, item.key, e.target.value)}
                        onBlur={handleBlur}
                        className={`w-full min-w-0 bg-[var(--app-bg-input)] text-xs border border-[var(--app-border-light)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] ${hasValueBrackets ? "!text-red-500 font-medium" : ""}`}
                        placeholder="value"
                      />
                    </div>
                    <button
                      onClick={() => removeCustom(i)}
                      className={`p-1.5 text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3 pt-4 border-t border-[var(--app-border-base)]">
          <div
            onClick={() => setSystemKeysOpen(!systemKeysOpen)}
            className="flex items-center justify-between cursor-pointer group hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5 select-none text-[var(--app-text-secondary)]">
              {systemKeysOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h3 className="text-xs font-semibold tracking-wider group-hover:text-white">
                本系統專用
              </h3>
              <span className="text-[10px] text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 ml-2 font-normal">
                不建議手動修改
              </span>
            </div>
            <span className="text-[10px] text-[var(--app-text-muted)] group-hover:text-[var(--app-text-secondary)] hidden sm:inline">
              僅作為Bug排除使用
            </span>
          </div>

          {systemKeysOpen && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--app-text-muted)] italic">
                  系統專用標籤 (如: kti, kar, kal, ko, tt, tte, kstyledef_* )。調整不當可能影響 KTV
                  ASS 的導出
                </span>
                <button
                  onClick={addSystem}
                  className="text-[10px] flex items-center gap-1 bg-[var(--app-bg-input)] hover:bg-[var(--app-bg-hover)] border border-[var(--app-border-light)] px-2 py-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" /> 新增專用標籤
                </button>
              </div>

              {systemKeys.length === 0 ? (
                <div className="text-[10px] text-[var(--app-text-muted)] text-center py-4 bg-[var(--app-bg-base)] rounded border border-[var(--app-border-light)] border-dashed">
                  尚無系統專用標籤
                </div>
              ) : (
                <div className="space-y-2 bg-[var(--app-bg-base)] p-2 sm:p-3 rounded-lg border border-[var(--app-border-base)] overflow-hidden">
                  {systemKeys.map((item, i) => {
                    const hasKeyBrackets = /[\[\]]/.test(item.key || "");
                    const hasValueBrackets = /[\[\]]/.test(item.value || "");
                    return (
                      <div key={i} className={`flex items-center gap-1 w-full`}>
                        <div className={`flex items-center w-auto shrink-0`}>
                          <input
                            type="text"
                            value={item.key}
                            onChange={(e) =>
                              handleSystemChange(i, e.target.value.trim(), item.value)
                            }
                            onBlur={handleBlur}
                            className={`bg-[var(--app-bg-input)] text-xs border border-[var(--app-border-light)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] w-14 sm:w-20 ${hasKeyBrackets ? "!text-red-500 font-medium" : ""}`}
                            placeholder="key"
                          />
                          <div className="text-xs font-mono text-[var(--app-text-muted)] ml-0.5 sm:ml-1">
                            :
                          </div>
                        </div>
                        <div className={`flex items-center flex-1 min-w-0`}>
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => handleSystemChange(i, item.key, e.target.value)}
                            onBlur={handleBlur}
                            className={`w-full min-w-0 bg-[var(--app-bg-input)] text-xs border border-[var(--app-border-light)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] ${hasValueBrackets ? "!text-red-500 font-medium" : ""}`}
                            placeholder="value"
                          />
                        </div>
                        <button
                          onClick={() => removeSystem(i)}
                          className={`p-1.5 text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {onClose && (
        <div className="p-4 border-t border-[var(--app-border-base)] shrink-0 flex justify-end bg-[var(--app-bg-panel-alt)] rounded-b-xl">
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded text-sm font-medium bg-[var(--app-accent)] text-black hover:bg-[var(--app-accent-hover)] transition-colors shadow-sm"
          >
            完成
          </button>
        </div>
      )}

      {/* Smart Import Dialog */}
      {smartImportOpen && (
        <div className="absolute inset-0 z-50 bg-[var(--app-bg-panel)] flex flex-col justify-between animate-in slide-in-from-bottom-5 duration-200">
          <div className="p-4 border-b border-[var(--app-border-base)] flex flex-col gap-2 shrink-0 bg-[var(--app-bg-panel-alt)]">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-[var(--app-accent)]" /> 智慧匯入 (分析歌詞文件)
            </h3>
            <p className="text-xs text-[var(--app-text-muted)] leading-relaxed">
              我們在歌詞中偵測到以下可能是屬性資訊的段落。勾選您想匯入的項目，確認後這些行將從歌詞中被移除並搬移到
              LRC屬性區塊。
            </p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-[var(--app-bg-base)]">
            {smartExtractions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--app-text-muted)] space-y-4">
                <Info className="w-8 h-8 opacity-50" />
                <p className="text-xs">未找到任何符合格式的屬性資訊。</p>
              </div>
            ) : (
              smartExtractions.map((ext, i) => (
                <label
                  key={ext.lineId}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${ext.selected ? "border-[var(--app-accent)] bg-opacity-10 bg-[var(--app-accent)] text-white" : "border-[var(--app-border-base)] hover:border-[var(--app-border-light)]"}`}
                >
                  <div className="pt-1">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${ext.selected ? "bg-[var(--app-accent)] border-[var(--app-accent)] text-black" : "border-[var(--app-border-light)]"}`}
                    >
                      {ext.selected && <Check className="w-3 h-3" />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={ext.selected}
                      onChange={() => {
                        const next = [...smartExtractions];
                        next[i].selected = !next[i].selected;
                        setSmartExtractions(next);
                      }}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-mono truncate text-[var(--app-text-muted)] mb-1">
                      原始文字:{" "}
                      <span className="text-[var(--app-text-secondary)]">{ext.originalText}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[10px] text-[var(--app-text-muted)] border border-[var(--app-border-light)] rounded px-1.5 py-0.5">
                        匯出成
                      </span>
                      {ext.suggestions.map((sug, j) => (
                        <div
                          key={j}
                          className="text-[10px] bg-[var(--app-bg-input)] px-2 py-0.5 border border-[var(--app-border-light)] rounded flex items-center gap-1 font-mono"
                        >
                          <span className="text-[var(--app-text-secondary)] font-bold">
                            [{sug.key}:
                          </span>
                          <span className="truncate max-w-[120px] inline-block">{sug.value}</span>
                          <span className="text-[var(--app-text-secondary)] font-bold">]</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="p-4 border-t border-[var(--app-border-base)] flex justify-end gap-3 shrink-0 bg-[var(--app-bg-panel-alt)] shadow-[0_-10px_20px_rgba(0,0,0,0.2)] z-10">
            <button
              onClick={() => setSmartImportOpen(false)}
              className="px-4 py-2 rounded text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-border-base)] transition-colors"
            >
              取消
            </button>
            {smartExtractions.length > 0 && (
              <button
                onClick={applySmartExtractions}
                className="px-4 py-2 rounded text-xs bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black font-medium transition-colors"
              >
                確認匯入並移除歌詞
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
