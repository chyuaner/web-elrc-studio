"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { BaseDialog } from "@/components/dialog/BaseDialog";
import { useEditor } from "@/components/base/EditorProvider";
import { generateAss, AssOptions } from "@/lib/ass-generator";
import {
  Download,
  SlidersHorizontal,
  Settings2,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
  Film,
  Copy,
  Check,
  X,
} from "lucide-react";
import { RawTextDisplay } from "@/components/panel/RawTextDisplay";
import { formatTime, parseSeconds } from "@/lib/lyric-utils";
import { FontSelect } from "@/components/common/FontSelect";

const SHOW_INTERNAL_TEST_PARAMS = true;

export function getDefaultAssOptions(lrcMetadata: any) {
  const initialTT = lrcMetadata.TT || lrcMetadata.tt;
  const initialTTE = lrcMetadata.TTE || lrcMetadata.tte;
  const hasCustomTime = !!initialTT;
  const parsedStart = hasCustomTime ? parseSeconds(initialTT) || 1 : 1;
  const parsedEnd = initialTTE
    ? parseSeconds(initialTTE) || parsedStart + 6
    : parsedStart + 6;

  return {
    primaryColor: "#2A04C8", // Blue
    color2: "#BC2600", // Red
    color3: "#800080", // Purple
    chorusColor: "#32AA17", // Green
    fontFamily: "Noto Sans CJK TC Medium",
    fontSize: 135, // Default for BottomLeft
    fontSizeOffset: 20, // Pre-offset for Noto Sans CJK TC Medium
    infoFontSize: 100, // Default for CenterInfo (song info, fontSize - 40)
    infoTitleFontSize: 125, // Default for red Title (fontSize - 10)
    songInfoTitle: lrcMetadata.kti !== undefined ? lrcMetadata.kti : "",
    songInfoArtist: lrcMetadata.kar !== undefined ? lrcMetadata.kar : "",
    songInfoAlbum: lrcMetadata.kal !== undefined ? lrcMetadata.kal : "",
    songInfoCustom: lrcMetadata.ko !== undefined ? lrcMetadata.ko : "",
    customStartInfoTime: hasCustomTime,
    startInfoStartTime: parsedStart,
    startInfoEndTime: parsedEnd,
    dualRowSpacing: 160,
    dualRowMarginL: 150,
    dualRowMarginR: 150,
    dualRowMarginV: 50,
    nextTriggerIndex: 1,
    row2FadeoutMode: "immediate" as const,
    interludeBuffer: 0.3,
    introDelayLimit: 60.0,
    fadeInOutTime: 0.5,
    playResX: 1920,
    playResY: 1080,
    simulatedOutlineWidth: 3,
    dotOuterColor: "#eeeeee",
    dotInnerColor: "#FFFFFF",
    dotOuterSize: 0.26,
    dotInnerSize: 0.24,
    dotSpacing: 0.75,
    songInfoTitleColor: "#BC2600",
    songInfoArtistColor: "#2A04C8",
  };
}

export function KtvAssExport() {
  const {
    lines,
    lrcMetadata,
    commitLrcMetadata,
    audioFileName,
    dualLineGapSec,
    setDualLineGapSec,
    metadata,
    showToast,
    playerRef,
    fileUrl,
    duration,
  } = useEditor();
  const [fontConfigOpen, setFontConfigOpen] = useState(false);
  const [colorConfigOpen, setColorConfigOpen] = useState(false);
  const [dotConfigOpen, setDotConfigOpen] = useState(false);
  const [testParamsOpen, setTestParamsOpen] = useState(false);
  const [burnVideoDialogOpen, setBurnVideoDialogOpen] = useState(false);
  const [rawPreviewOpen, setRawPreviewOpen] = useState(false);
  const [ffmpegMode, setFfmpegMode] = useState<"cpu" | "nvidia">("cpu");
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const [options, setOptions] = useState<
    Omit<AssOptions, "interludeThreshold">
  >(() => getDefaultAssOptions(lrcMetadata));

  const originalVideoName = audioFileName || "video.mp4";
  const baseName = useMemo(() => {
    return audioFileName
      ? audioFileName.replace(/\.[^/.]+$/, "")
      : lrcMetadata.ti || "KTV";
  }, [audioFileName, lrcMetadata.ti]);
  const assFilename = `${baseName}.ass`;
  const outputVideoName = `【KTV】${originalVideoName}`;

  const ffmpegCommand = useMemo(() => {
    if (ffmpegMode === "cpu") {
      return `ffmpeg -i "${originalVideoName}" -vf "subtitles='${assFilename}'" -c:v libx264 -crf 18 -preset slow -c:a copy "${outputVideoName}"`;
    } else {
      return `ffmpeg -i "${originalVideoName}" -vf "subtitles='${assFilename}'" -c:v h264_nvenc -preset slow -cq 19 -rc constqp -pix_fmt yuv420p -c:a copy "${outputVideoName}"`;
    }
  }, [ffmpegMode, originalVideoName, assFilename, outputVideoName]);



  // 當 Lrc 內部的自訂 KTV 中繼資料被更新時，將歌名、歌手、專輯與自訂欄位同步至 options，確保資料即時更新且不遺失自定義渲染樣式（不自動回退至通用屬性）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptions((prev) => {
      const metadataTitle =
        lrcMetadata.kti !== undefined ? lrcMetadata.kti : "";
      const metadataArtist =
        lrcMetadata.kar !== undefined ? lrcMetadata.kar : "";
      const metadataAlbum =
        lrcMetadata.kal !== undefined ? lrcMetadata.kal : "";
      const metadataCustom = lrcMetadata.ko !== undefined ? lrcMetadata.ko : "";

      if (
        prev.songInfoTitle !== metadataTitle ||
        prev.songInfoArtist !== metadataArtist ||
        prev.songInfoAlbum !== metadataAlbum ||
        prev.songInfoCustom !== metadataCustom
      ) {
        return {
          ...prev,
          songInfoTitle: metadataTitle,
          songInfoArtist: metadataArtist,
          songInfoAlbum: metadataAlbum,
          songInfoCustom: metadataCustom,
        };
      }
      return prev;
    });
  }, [lrcMetadata.kti, lrcMetadata.kar, lrcMetadata.kal, lrcMetadata.ko]);

  const [detectedVideo, setDetectedVideo] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // 自動偵測當前載入影片的原始解析度
  useEffect(() => {
    let active = true;
    const checkResolution = () => {
      if (!active) return;
      const videoElement = playerRef?.current as HTMLVideoElement | null;
      if (videoElement && videoElement.tagName === "VIDEO") {
        const w = videoElement.videoWidth;
        const h = videoElement.videoHeight;
        if (w > 0 && h > 0) {
          if (
            !detectedVideo ||
            detectedVideo.width !== w ||
            detectedVideo.height !== h
          ) {
            setDetectedVideo({ width: w, height: h });
            setOptions((o) => {
              if (o.playResX !== w || o.playResY !== h) {
                return {
                  ...o,
                  playResX: w,
                  playResY: h,
                };
              }
              return o;
            });
            // showToast removed per user request
          }
        }
      } else {
        if (detectedVideo !== null) {
          setDetectedVideo(null);
        }
      }
    };

    // 1. 立即檢查一次
    checkResolution();

    // 2. 設定一個 300 毫秒的 interval 進行輪詢，確保能在第 1 時間即時更新
    const timer = setInterval(checkResolution, 300);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [playerRef, showToast, fileUrl, duration, detectedVideo]);

  const assContent = useMemo(() => {
    return generateAss(lines, lrcMetadata, {
      ...options,
      interludeThreshold: dualLineGapSec,
    });
  }, [lines, lrcMetadata, options, dualLineGapSec]);

  const handleDownload = () => {
    const blob = new Blob([assContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Create base filename from audio or metadata
    const baseName = audioFileName
      ? audioFileName.replace(/\.[^/.]+$/, "")
      : lrcMetadata.ti || "KTV";
    link.download = `${baseName}.ass`;
    document.body.appendChild(link);
    link.click();

    // Use requestAnimationFrame to ensure it's removed after browser has processed click
    requestAnimationFrame(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    });
  };

  const handleImportFromTags = () => {
    const title =
      metadata?.title ||
      metadata?.rawTags?.TITLE ||
      metadata?.rawTags?.title ||
      "";
    const artist =
      metadata?.artist ||
      metadata?.rawTags?.ARTIST ||
      metadata?.rawTags?.artist ||
      "";
    const album =
      metadata?.album ||
      metadata?.rawTags?.ALBUM ||
      metadata?.rawTags?.album ||
      "";
    const updated = {
      ...options,
      songInfoTitle: title,
      songInfoArtist: artist,
      songInfoAlbum: album,
    };
    setOptions(updated);
    syncToLrcMetadata(updated);
    showToast("已從音檔標籤匯入資訊");
  };

  const handleImportFromLrc = () => {
    const title = lrcMetadata.ti || "";
    const artist = lrcMetadata.ar || "";
    const album = lrcMetadata.al || "";
    
    // 把所有的LRC屬性「自訂標籤」（排除本系統專用的標籤）也一起填入「自訂內容」
    const predefinedKeys = ['ti', 'ar', 'al', 'au', 'by', 'offset', 're', 've', 'length', 'tool'];
    const sysKeysList = ['kti', 'kar', 'kal', 'ko', 'tt', 'tte', 'kth'];
    
    const customParts: string[] = [];
    for (const [key, value] of Object.entries(lrcMetadata)) {
      if (!predefinedKeys.includes(key) && !sysKeysList.includes(key.toLowerCase()) && value) {
        customParts.push(`${key}：${value}`);
      }
    }
    const custom = customParts.join("\n");

    const updated = {
      ...options,
      songInfoTitle: title,
      songInfoArtist: artist,
      songInfoAlbum: album,
      songInfoCustom: custom,
    };
    setOptions(updated);
    syncToLrcMetadata(updated);
    showToast("已從 LRC 屬性匯入資訊");
  };

  const lastCommittedMetaRef = useRef<any>(null);

  const syncToLrcMetadata = (newOptions: typeof options) => {
    const updatedMeta = { ...lrcMetadata };
    if (newOptions.customStartInfoTime) {
      updatedMeta.TT = formatTime(newOptions.startInfoStartTime, true);
      const isExactly6s =
        Math.abs(
          newOptions.startInfoEndTime - (newOptions.startInfoStartTime + 6),
        ) < 0.005;
      if (isExactly6s) {
        delete updatedMeta.TTE;
        delete updatedMeta.tte;
      } else {
        updatedMeta.TTE = formatTime(newOptions.startInfoEndTime, true);
      }
    } else {
      delete updatedMeta.TT;
      delete updatedMeta.tt;
      delete updatedMeta.TTE;
      delete updatedMeta.tte;
    }

    // 同步自訂歌曲資訊欄位 (kti, kar, kal, ko)
    if (newOptions.songInfoTitle !== undefined) {
      updatedMeta.kti = newOptions.songInfoTitle;
    }
    if (newOptions.songInfoArtist !== undefined) {
      updatedMeta.kar = newOptions.songInfoArtist;
    }
    if (newOptions.songInfoAlbum !== undefined) {
      updatedMeta.kal = newOptions.songInfoAlbum;
    }
    if (newOptions.songInfoCustom !== undefined) {
      updatedMeta.ko = newOptions.songInfoCustom;
    }

    lastCommittedMetaRef.current = updatedMeta;
    commitLrcMetadata(updatedMeta, "Update Custom KTV Info and Times");
  };

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  // 當外部/內部 options 時間改變時，同步其字串格式至精準格式 mm:ss.mmm
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartInput(formatTime(options.startInfoStartTime, true));
  }, [options.startInfoStartTime]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndInput(formatTime(options.startInfoEndTime, true));
  }, [options.startInfoEndTime]);

  const parsePreciseTimeString = (val: string): number | null => {
    const regex = /^(\d+):(\d{1,2})(?:\.(\d+))?$/;
    const m = val.trim().match(regex);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const msStr = m[3] || "0";
      const ms = parseFloat(`0.${msStr}`);
      return min * 60 + sec + ms;
    }
    const secValue = parseFloat(val.trim());
    if (!isNaN(secValue) && !val.includes(":")) {
      return secValue;
    }
    return null;
  };

  const handleStartInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStartInput(val);

    const parsed = parsePreciseTimeString(val);
    if (parsed !== null) {
      const newEnd = Number((parsed + 6).toFixed(3));
      const updated = {
        ...options,
        startInfoStartTime: parsed,
        startInfoEndTime: newEnd,
      };
      setOptions(updated);
      syncToLrcMetadata(updated);
    }
  };

  const handleStartInputBlur = () => {
    const parsed = parsePreciseTimeString(startInput);
    if (parsed !== null) {
      const newEnd = Number((parsed + 6).toFixed(3));
      const updated = {
        ...options,
        startInfoStartTime: parsed,
        startInfoEndTime: newEnd,
      };
      setOptions(updated);
      syncToLrcMetadata(updated);
    } else {
      setStartInput(formatTime(options.startInfoStartTime, true));
    }
  };

  const handleEndInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEndInput(val);

    const parsed = parsePreciseTimeString(val);
    if (parsed !== null) {
      const updated = {
        ...options,
        startInfoEndTime: parsed,
      };
      setOptions(updated);
      syncToLrcMetadata(updated);
    }
  };

  const handleEndInputBlur = () => {
    const parsed = parsePreciseTimeString(endInput);
    if (parsed !== null) {
      const updated = {
        ...options,
        startInfoEndTime: parsed,
      };
      setOptions(updated);
      syncToLrcMetadata(updated);
    } else {
      setEndInput(formatTime(options.startInfoEndTime, true));
    }
  };

  // Sync state if metadata changed externally and we haven't touched it yet, or clear on lyrics close
  useEffect(() => {
    if (lastCommittedMetaRef.current === lrcMetadata) return;

    if (lines.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions((o) => ({
        ...o,
        songInfoTitle: "",
        songInfoArtist: "",
        songInfoAlbum: "",
        songInfoCustom: "",
        customStartInfoTime: false,
        startInfoStartTime: 1,
        startInfoEndTime: 7,
      }));
    } else {
      const extTT = lrcMetadata.TT || lrcMetadata.tt;
      const extTTE = lrcMetadata.TTE || lrcMetadata.tte;
      const hasExtCustom = !!extTT;
      const extStart = hasExtCustom ? parseSeconds(extTT) || 1 : 1;
      const extEnd = extTTE
        ? parseSeconds(extTTE) || extStart + 6
        : extStart + 6;

      // 歌曲資訊完全「不要」自動從預設的LRC標籤(ti, ar, al)匯入，只在明確設定了專用屬性(kti, kar, kal)時才讀取
      // 如此一來可完美支援使用者刻意將主唱與專輯留空的需求
      const loadedTitle = lrcMetadata.kti !== undefined ? lrcMetadata.kti : "";
      const loadedArtist = lrcMetadata.kar !== undefined ? lrcMetadata.kar : "";
      const loadedAlbum = lrcMetadata.kal !== undefined ? lrcMetadata.kal : "";
      const loadedCustom = lrcMetadata.ko !== undefined ? lrcMetadata.ko : "";

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions((o) => ({
        ...o,
        songInfoTitle: loadedTitle,
        songInfoArtist: loadedArtist,
        songInfoAlbum: loadedAlbum,
        songInfoCustom: loadedCustom,
        customStartInfoTime: hasExtCustom,
        startInfoStartTime: extStart,
        startInfoEndTime: extEnd,
      }));
    }
  }, [
    lines.length,
    lrcMetadata,
    lrcMetadata.ti,
    lrcMetadata.ar,
    lrcMetadata.al,
    lrcMetadata.kti,
    lrcMetadata.kar,
    lrcMetadata.kal,
    lrcMetadata.ko,
    lrcMetadata.TT,
    lrcMetadata.TTE,
    lrcMetadata.tt,
    lrcMetadata.tte,
  ]);

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg-main)] overflow-hidden">
      {/* Title Bar inside Tab */}
      <div className="shrink-0 px-4 py-3 bg-[var(--app-bg-base)] border-b border-[var(--app-border-base)] flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--app-text-primary)]">KTV ASS 輸出</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="text-[11px] flex items-center gap-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black px-3 py-1.5 rounded transition-colors font-bold z-10 animate-in fade-in duration-200"
          >
            <Download className="w-3.5 h-3.5" /> 下載 .ass 檔
          </button>
          
          <button
            onClick={() => setBurnVideoDialogOpen(true)}
            className="text-[11px] flex items-center gap-1.5 bg-[var(--app-bg-panel)] border border-[var(--app-border-light)] text-[var(--app-text-primary)] hover:bg-[var(--app-border-base)] px-3 py-1.5 rounded transition-colors font-bold z-10 animate-in fade-in duration-200"
          >
            <Film className="w-3.5 h-3.5" /> 壓製成影片
          </button>
        </div>
      </div>

      {/* Settings / Toolbar Panel */}
      <div className="shrink-0 p-4 bg-[var(--app-bg-base)] border-b border-[var(--app-border-base)] flex flex-col gap-4 overflow-y-auto max-h-[50vh]">
        <div className="text-xs text-[var(--app-text-secondary)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column */}
            <div className="flex flex-col gap-5">
              {/* 視訊尺寸與 ASS 比例設定 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center gap-2">
                  <label className="font-semibold text-[var(--app-text-primary)] text-xs">
                    視訊尺寸與 ASS 比例設定
                  </label>
                  {detectedVideo && (
                    <button
                      type="button"
                      onClick={() => {
                        const v = {
                          videoWidth: detectedVideo.width,
                          videoHeight: detectedVideo.height,
                        };
                        setOptions({
                          ...options,
                          playResX: v.videoWidth,
                          playResY: v.videoHeight,
                        });
                        showToast(
                          `已套用影片原始比例：${v.videoWidth} x ${v.videoHeight}`,
                        );
                      }}
                      className="text-[10px] text-[var(--app-accent)] hover:underline font-medium flex items-center gap-1 bg-[var(--app-bg-base)] border border-[var(--app-border-light)] rounded px-2 py-0.5"
                    >
                      🎯 套用影片原始大小 ({detectedVideo.width}x
                      {detectedVideo.height})
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded">
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div className="flex flex-col gap-1 col-span-3 sm:col-span-1">
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                        比例預設值
                      </span>
                      <select
                        value={
                          options.playResX === 1920 && options.playResY === 1080
                            ? "1920x1080"
                            : options.playResX === 1280 &&
                                options.playResY === 720
                              ? "1280x720"
                              : options.playResX === 1440 &&
                                  options.playResY === 1080
                                ? "1440x1080"
                                : options.playResX === 960 &&
                                    options.playResY === 720
                                  ? "960x720"
                                  : options.playResX === 2560 &&
                                      options.playResY === 1080
                                    ? "2560x1080"
                                    : "custom"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") return;
                          const [w, h] = val.split("x").map(Number);
                          setOptions({
                            ...options,
                            playResX: w,
                            playResY: h,
                          });
                        }}
                        className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-xs"
                      >
                        <option value="1920x1080">
                          16:9 FHD (1920 x 1080)
                        </option>
                        <option value="1280x720">16:9 HD (1280 x 720)</option>
                        <option value="1440x1080">4:3 FHD (1440 x 1080)</option>
                        <option value="960x720">
                          4:3 Standard (960 x 720)
                        </option>
                        <option value="2560x1080">
                          21:9 UltraWide (2560 x 1080)
                        </option>
                        <option value="custom">自訂比例大小</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 col-span-3 sm:col-span-1">
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium font-semibold">
                        寬度 (PlayResX)
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          value={options.playResX || 1920}
                          onChange={(e) => {
                            const w = parseInt(e.target.value) || 1920;
                            setOptions({ ...options, playResX: w });
                          }}
                          className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 pr-6 focus:outline-none focus:border-[var(--app-accent)] text-xs font-mono"
                        />
                        <span className="absolute right-2 top-1.5 text-[9px] text-[var(--app-text-muted)] font-mono">
                          px
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 col-span-3 sm:col-span-1">
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium font-semibold">
                        高度 (PlayResY)
                      </span>
                      <div className="relative">
                        <input
                          type="number"
                          value={options.playResY || 1080}
                          onChange={(e) => {
                            const h = parseInt(e.target.value) || 1080;
                            setOptions({ ...options, playResY: h });
                          }}
                          className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 pr-6 focus:outline-none focus:border-[var(--app-accent)] text-xs font-mono"
                        />
                        <span className="absolute right-2 top-1.5 text-[9px] text-[var(--app-text-muted)] font-mono">
                          px
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--app-text-muted)] leading-tight mt-1">
                    設定正確的影片解析度，可避免在播放不同比例（如 4:3
                    懷舊影片或寬螢幕電影）的影片時，小白圓等 SVG
                    向量繪圖圖案產生拉伸、扁平或任何變形的問題。
                  </p>
                </div>
              </div>

              {/* 間奏閥值 */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-[var(--app-text-primary)] text-xs">
                  間奏閥值
                </label>
                <div className="flex flex-col gap-1.5 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="0.5"
                      value={dualLineGapSec}
                      onChange={(e) =>
                        setDualLineGapSec(parseFloat(e.target.value))
                      }
                      onMouseUp={() =>
                        commitLrcMetadata(
                          { ...lrcMetadata, kth: dualLineGapSec.toString() },
                          "Update Interlude Threshold",
                        )
                      }
                      onTouchEnd={() =>
                        commitLrcMetadata(
                          { ...lrcMetadata, kth: dualLineGapSec.toString() },
                          "Update Interlude Threshold",
                        )
                      }
                      onKeyUp={() =>
                        commitLrcMetadata(
                          { ...lrcMetadata, kth: dualLineGapSec.toString() },
                          "Update Interlude Threshold",
                        )
                      }
                      className="flex-1 accent-[var(--app-accent)]"
                    />
                    <span className="font-mono w-12 text-right text-[var(--app-text-primary)]">
                      {dualLineGapSec.toFixed(1)}s
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--app-text-muted)]">
                    當兩句歌詞相隔超過此數值，將被視為新段落並重新進入排版。
                  </p>
                </div>
              </div>

              {/* 字幕顏色設定 */}
              <div className="flex flex-col gap-1.5">
                <div
                  onClick={() => setColorConfigOpen(!colorConfigOpen)}
                  className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-white transition-colors"
                >
                  <span>字幕顏色設定</span>
                  {colorConfigOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                  )}
                </div>

                {colorConfigOpen && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded animate-in fade-in duration-200">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                        已唱字幕 (Color 1)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={options.primaryColor}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              primaryColor: e.target.value,
                            })
                          }
                          className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                        />
                        <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                          {options.primaryColor.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex flex-col gap-1 opacity-50 tooltip-wrapper"
                      title="尚未實裝多部和音支援"
                    >
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                        已唱字幕2 (暫不支援)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={options.color2}
                          onChange={(e) =>
                            setOptions({ ...options, color2: e.target.value })
                          }
                          disabled
                          className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                        />
                        <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                          {options.color2.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex flex-col gap-1 opacity-50 tooltip-wrapper"
                      title="尚未實裝多部和音支援"
                    >
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                        已唱字幕3 (暫不支援)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={options.color3}
                          onChange={(e) =>
                            setOptions({ ...options, color3: e.target.value })
                          }
                          disabled
                          className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                        />
                        <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                          {options.color3.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex flex-col gap-1 opacity-50 tooltip-wrapper"
                      title="尚未實裝多部和音支援"
                    >
                      <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                        已唱合唱 (暫不支援)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={options.chorusColor}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              chorusColor: e.target.value,
                            })
                          }
                          disabled
                          className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                        />
                        <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                          {options.chorusColor.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {SHOW_INTERNAL_TEST_PARAMS && (
                      <>
                        <div className="flex flex-col gap-1 border-t border-[var(--app-border-light)] pt-2 col-span-2 mt-1">
                          <span className="text-[10px] text-[var(--app-accent)] font-semibold">
                            [內部測試] 開始資訊顏色
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                            標題顏色 (Title)
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={options.songInfoTitleColor || "#BC2600"}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  songInfoTitleColor: e.target.value,
                                })
                              }
                              className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                              {(options.songInfoTitleColor || "#BC2600").toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                            主唱/專輯文字顏色 (Info)
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={options.songInfoArtistColor || "#2A04C8"}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  songInfoArtistColor: e.target.value,
                                })
                              }
                              className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                              {(options.songInfoArtistColor || "#2A04C8").toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 字體設定 */}
              <div className="flex flex-col gap-1.5">
                <div
                  onClick={() => setFontConfigOpen(!fontConfigOpen)}
                  className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-white transition-colors"
                >
                  <span>字體設定</span>
                  {fontConfigOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                  )}
                </div>

                {fontConfigOpen && (
                  <div className="flex flex-col gap-3 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded animate-in fade-in duration-200">
                    <div className="flex flex-col gap-2 border-b border-[var(--app-border-light)] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium shrink-0">
                          本機字型名稱:
                        </span>
                        <FontSelect
                          value={options.fontFamily}
                          onChange={(val, font) => {
                            const updates: any = { fontFamily: val };
                            if (font && font.sizeOffset !== undefined) {
                              updates.fontSizeOffset = font.sizeOffset;
                            }
                            setOptions({ ...options, ...updates });
                          }}
                        />
                      </div>

                      <div
                        className="text-[9px] text-[var(--app-text-muted)] w-full block mt-0.5"
                        style={{ letterSpacing: "-0.3px" }}
                      >
                        ASS
                        字幕的顯示依賴您的本機環境與播放器，請確保已安裝選用的字型。播放器底層引擎通常會嘗試自動
                        fallback
                        作業系統字體，但為確保效果原貌，建議您使用本系統提供的通用字體選項。
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1.5 flex-1 min-w-[80px]">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium whitespace-nowrap">
                          字體大小:
                        </span>
                        <input
                          type="number"
                          value={options.fontSize}
                          onChange={(e) => {
                            const newSize = parseInt(e.target.value) || 120;
                            const diff = newSize - options.fontSize;
                            setOptions({
                              ...options,
                              fontSize: newSize,
                              infoFontSize:
                                (options.infoFontSize || 110) + diff,
                              infoTitleFontSize:
                                (options.infoTitleFontSize || 140) + diff,
                            });
                          }}
                          className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-center font-mono text-xs"
                          title="主字體大小"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 flex-1 min-w-[80px]">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium whitespace-nowrap">
                          描邊粗細:
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={
                            options.simulatedOutlineWidth !== undefined
                              ? options.simulatedOutlineWidth
                              : 3
                          }
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setOptions({
                              ...options,
                              simulatedOutlineWidth: val,
                            });
                          }}
                          className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] text-center font-mono text-xs"
                        />
                      </div>
                    </div>

                    {SHOW_INTERNAL_TEST_PARAMS && (
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap border-t border-[var(--app-border-light)] pt-3 mt-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[100px]">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium whitespace-nowrap">
                            標題大小:
                          </span>
                          <input
                            type="number"
                            value={options.infoTitleFontSize || 140}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 140;
                              setOptions({ ...options, infoTitleFontSize: val });
                            }}
                            className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] text-center font-mono text-xs"
                          />
                        </div>

                        <div className="flex items-center gap-1.5 flex-1 min-w-[100px]">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium whitespace-nowrap">
                            內文大小:
                          </span>
                          <input
                            type="number"
                            value={options.infoFontSize || 110}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 110;
                              setOptions({ ...options, infoFontSize: val });
                            }}
                            className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-1.5 py-1 focus:outline-none focus:border-[var(--app-accent)] text-center font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-[var(--app-text-muted)] mt-auto leading-tight">
                      字體外框皆固定從反（白字體配黑框，彩字體配白框）。
                    </p>
                  </div>
                )}
              </div>

              {/* 間奏倒數小圓設定 */}
              {SHOW_INTERNAL_TEST_PARAMS && (
                <div className="flex flex-col gap-1.5">
                  <div
                    onClick={() => setDotConfigOpen(!dotConfigOpen)}
                    className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-white transition-colors"
                  >
                    <span>間奏倒數小圓設定 (內部)</span>
                    {dotConfigOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                    )}
                  </div>

                  {dotConfigOpen && (
                    <div className="flex flex-col gap-3 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded animate-in fade-in duration-200">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                            外框部分顏色 (Hex)
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={options.dotOuterColor || "#DEDDDA"}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  dotOuterColor: e.target.value,
                                })
                              }
                              className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                              {(options.dotOuterColor || "#DEDDDA").toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                            內圓本體顏色 (Hex)
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={options.dotInnerColor || "#FFFFFF"}
                              onChange={(e) =>
                                setOptions({
                                  ...options,
                                  dotInnerColor: e.target.value,
                                })
                              }
                              className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                              {(options.dotInnerColor || "#FFFFFF").toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-[var(--app-text-muted)] font-medium">
                            外圓形半徑比例
                          </span>
                          <span className="font-mono text-[var(--app-text-primary)]">
                            {options.dotOuterSize !== undefined ? options.dotOuterSize : 0.28}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="0.5"
                          step="0.01"
                          value={options.dotOuterSize !== undefined ? options.dotOuterSize : 0.28}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              dotOuterSize: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--app-accent)]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-[var(--app-text-muted)] font-medium">
                            內圓形半徑比例 (小於外圓形)
                          </span>
                          <span className="font-mono text-[var(--app-text-primary)]">
                            {options.dotInnerSize !== undefined
                              ? options.dotInnerSize
                              : 0.26}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="0.4"
                          step="0.01"
                          value={
                            options.dotInnerSize !== undefined
                              ? options.dotInnerSize
                              : 0.26
                          }
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              dotInnerSize: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--app-accent)]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-[var(--app-text-muted)] font-medium">
                            小白圓間距比例
                          </span>
                          <span className="font-mono text-[var(--app-text-primary)]">
                            {options.dotSpacing !== undefined
                              ? options.dotSpacing
                              : 0.75}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="1.2"
                          step="0.01"
                          value={
                            options.dotSpacing !== undefined
                              ? options.dotSpacing
                              : 0.75
                          }
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              dotSpacing: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 密集測試區 */}
              {SHOW_INTERNAL_TEST_PARAMS && (
                <div className="flex flex-col gap-1.5">
                  <div
                    onClick={() => setTestParamsOpen(!testParamsOpen)}
                    className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-white transition-colors"
                  >
                    <span>測試參數 (內部)</span>
                    {testParamsOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-white" />
                    )}
                  </div>

                  {testParamsOpen && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-[var(--app-bg-panel)] border border-[var(--app-border-light)] p-3 rounded animate-in fade-in duration-200">
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          行間距 (px)
                        </label>
                        <input
                          type="number"
                          value={options.dualRowSpacing}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              dualRowSpacing: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          左右邊距 LR (px)
                        </label>
                        <input
                          type="number"
                          value={options.dualRowMarginL}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setOptions({
                              ...options,
                              dualRowMarginL: val,
                              dualRowMarginR: val,
                            });
                          }}
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          上下邊距 V (px)
                        </label>
                        <input
                          type="number"
                          value={options.dualRowMarginV}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              dualRowMarginV: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          資訊字體
                        </label>
                        <input
                          type="number"
                          value={options.infoFontSize}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              infoFontSize: parseInt(e.target.value),
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          標題字體
                        </label>
                        <input
                          type="number"
                          value={options.infoTitleFontSize}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              infoTitleFontSize: parseInt(e.target.value) || 150,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          字體補正 (px)
                        </label>
                        <input
                          type="number"
                          value={options.fontSizeOffset || 0}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              fontSizeOffset: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5 text-[var(--app-accent)] border-dashed border-[var(--app-accent)/50]"
                          title="字體大小強制補正值 (隨字體切換自動載入)"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          間奏緩衝 (s)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={options.interludeBuffer}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              interludeBuffer: parseFloat(e.target.value),
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          觸發索引
                        </label>
                        <input
                          type="number"
                          value={options.nextTriggerIndex}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              nextTriggerIndex: parseInt(e.target.value),
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[var(--app-text-muted)]">
                          淡出模式
                        </label>
                        <select
                          value={options.row2FadeoutMode}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              row2FadeoutMode: e.target.value as
                                | "immediate"
                                | "delayed",
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        >
                          <option value="immediate">Immediate</option>
                          <option value="delayed">Delayed</option>
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          淡入淡出時間 (s)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={options.fadeInOutTime}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              fadeInOutTime: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">
                          延遲顯示資訊門檻 (s)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={options.introDelayLimit}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              introDelayLimit: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-5">
              {/* 歌曲開始資訊 */}
              <div className="flex flex-col gap-3 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <label className="font-semibold text-[var(--app-text-primary)] text-xs">
                    歌曲開始資訊
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={handleImportFromTags}
                      className="px-2 py-1 bg-[var(--app-bg-hover)] border border-[var(--app-border-light)] rounded text-[10px] text-[var(--app-text-primary)] hover:bg-[var(--app-border-base)] transition-colors"
                    >
                      由音檔標籤匯入
                    </button>
                    <button
                      onClick={handleImportFromLrc}
                      className="px-2 py-1 bg-[var(--app-bg-hover)] border border-[var(--app-border-light)] rounded text-[10px] text-[var(--app-text-primary)] hover:bg-[var(--app-border-base)] transition-colors"
                    >
                      由LRC屬性匯入
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-[60px_1fr] items-start gap-2">
                  <span className="text-[var(--app-text-muted)] text-[10px] text-right self-start mt-1.5">
                    標題
                  </span>
                  <textarea
                    rows={Math.max(1, (options.songInfoTitle || "").split("\n").length)}
                    value={options.songInfoTitle}
                    onChange={(e) => {
                      const updated = {
                        ...options,
                        songInfoTitle: e.target.value,
                      };
                      setOptions(updated);
                      syncToLrcMetadata(updated);
                    }}
                    className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-xs text-[var(--app-text-primary)] resize-none leading-normal overflow-y-hidden"
                  />

                  <span className="text-[var(--app-text-muted)] text-[10px] text-right self-start mt-1.5">
                    主唱
                  </span>
                  <textarea
                    rows={Math.max(1, (options.songInfoArtist || "").split("\n").length)}
                    value={options.songInfoArtist}
                    onChange={(e) => {
                      const updated = {
                        ...options,
                        songInfoArtist: e.target.value,
                      };
                      setOptions(updated);
                      syncToLrcMetadata(updated);
                    }}
                    className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-xs text-[var(--app-text-primary)] resize-none leading-normal overflow-y-hidden"
                  />

                  <span className="text-[var(--app-text-muted)] text-[10px] text-right self-start mt-1.5">
                    專輯
                  </span>
                  <textarea
                    rows={Math.max(1, (options.songInfoAlbum || "").split("\n").length)}
                    value={options.songInfoAlbum}
                    onChange={(e) => {
                      const updated = {
                        ...options,
                        songInfoAlbum: e.target.value,
                      };
                      setOptions(updated);
                      syncToLrcMetadata(updated);
                    }}
                    className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-xs text-[var(--app-text-primary)] resize-none leading-normal overflow-y-hidden"
                  />

                  <span className="text-[var(--app-text-muted)] text-[10px] text-right self-start mt-1">
                    自訂內容
                  </span>
                  <textarea
                    value={options.songInfoCustom}
                    onChange={(e) => {
                      const updated = {
                        ...options,
                        songInfoCustom: e.target.value,
                      };
                      setOptions(updated);
                      syncToLrcMetadata(updated);
                    }}
                    placeholder="例如：&#10;作詞：XXX&#10;作曲：OOO"
                    rows={3}
                    className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 focus:outline-none focus:border-[var(--app-accent)] text-xs text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] mb-1 resize-y"
                  />
                </div>

                <div className="flex items-center gap-2 border-t border-[var(--app-border-light)] pt-2 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors select-none">
                    <input
                      type="checkbox"
                      checked={options.customStartInfoTime}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const updated = {
                          ...options,
                          customStartInfoTime: checked,
                        };
                        setOptions(updated);
                        syncToLrcMetadata(updated);
                      }}
                      className="accent-[var(--app-accent)]"
                    />
                    <span>特殊自訂顯示時間戳</span>
                  </label>
                </div>

                {options.customStartInfoTime && (
                  <div className="flex items-center gap-2 pl-[60px] animate-fade-in">
                    <input
                      type="text"
                      value={startInput}
                      onChange={handleStartInputChange}
                      onBlur={handleStartInputBlur}
                      className="w-24 bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)] text-center font-mono"
                      title="Start Time"
                    />
                    <span className="text-[var(--app-text-muted)]">~</span>
                    <input
                      type="text"
                      value={endInput}
                      onChange={handleEndInputChange}
                      onBlur={handleEndInputBlur}
                      className="w-24 bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)] text-center font-mono"
                      title="End Time"
                    />
                  </div>
                )}
              </div>

              {/* 自訂間奏Logo圖檔 (準備中) */}
              <div className="flex flex-col gap-1.5 opacity-50 relative border border-[var(--app-border-light)] p-3 rounded bg-[var(--app-bg-input)]">
                <label className="font-semibold text-xs text-[var(--app-text-primary)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> 自訂間奏Logo圖檔 (準備中)
                </label>
                <div className="flex items-center gap-2 pointer-events-none mt-2">
                  <input
                    type="file"
                    disabled
                    className="text-xs bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded py-1.5 px-2 w-full text-[var(--app-text-muted)] border-dashed border-[var(--app-border-light)]"
                  />
                </div>
                <div
                  className="absolute inset-0 bg-transparent"
                  title="此功能正在開發中"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="border border-[var(--app-border-light)] rounded overflow-hidden mb-4">
        <div 
          onClick={() => setRawPreviewOpen(!rawPreviewOpen)}
          className="flex items-center justify-between px-4 py-2.5 bg-[var(--app-bg-input)] cursor-pointer hover:bg-[var(--app-bg-hover)] transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--app-text-muted)]" />
            <span className="text-xs font-semibold text-[var(--app-text-primary)]">
              .ass RAW Preview 字幕內容預覽
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--app-text-muted)]">
              {rawPreviewOpen ? "點擊收合" : "點擊展開"}
            </span>
            {rawPreviewOpen ? (
              <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)]" />
            )}
          </div>
        </div>
        
        {rawPreviewOpen && (
          <div className="flex flex-col min-h-[300px] max-h-[500px] overflow-hidden lg:relative border-t border-[var(--app-border-light)]">
            <RawTextDisplay
              customText={
                assContent ||
                "; 沒有包含同步時間標籤的歌詞資料。請先到「逐字同步」頁尾打節拍。"
              }
              hideKaraokePreview={true}
              customLeftControls={
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[var(--app-text-muted)]" />
                  <span className="text-xs font-mono text-[var(--app-text-muted)]">
                    .ass RAW Preview
                  </span>
                </div>
              }
            />
          </div>
        )}
      </div>

      {/* FFmpeg 壓製影片教學 Dialog */}
      <BaseDialog
        isOpen={burnVideoDialogOpen}
        onClose={() => setBurnVideoDialogOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[var(--app-accent)]" /> 壓製成新影片 (利用 FFmpeg)
          </span>
        }
        maxWidthClass="max-w-2xl"
        footer={
          <button 
            onClick={() => setBurnVideoDialogOpen(false)}
            className="px-5 py-2 bg-[var(--app-bg-hover)] hover:bg-[var(--app-border-base)] text-[var(--app-text-primary)] text-[11px] font-semibold rounded transition-colors"
          >
            關閉
          </button>
        }
      >
        <div className="text-xs sm:text-sm text-[var(--app-text-secondary)] leading-relaxed space-y-4">
          <p>
            要將字幕<strong>永久壓製固定 (Hardsub)</strong>在您的 MV 影片中，最有效率且畫質最好的方式是使用免費開源工具 <strong>FFmpeg</strong>。
          </p>
          <p className="bg-[var(--app-accent)]/10 text-[var(--app-accent)] p-3 rounded border border-[var(--app-accent)]/30">
            ⚠️ <strong>開始前提醒：</strong>請確認您已點擊上方 <strong>「下載 .ass 檔」</strong> 按鈕將字幕檔案儲存到本機，並與您的原始影片放置在<strong>同一個資料夾</strong>中。
          </p>

          <div className="space-y-2 border border-[var(--app-border-light)] p-4 rounded bg-[var(--app-bg-input)]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-[var(--app-text-primary)]">
                選擇硬體加速/解碼模式：
              </label>
              <select
                value={ffmpegMode}
                onChange={(e) => setFfmpegMode(e.target.value as "cpu" | "nvidia")}
                className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 text-xs focus:outline-none focus:border-[var(--app-accent)]"
              >
                <option value="cpu">💻 CPU 模式 (適合任何電腦，畫質好，速度一般)</option>
                <option value="nvidia">⚡ Nvidia 模式 (適合顯卡支援 CUDA，極速壓製)</option>
              </select>
            </div>

            <p className="text-[10px] text-[var(--app-text-muted)] leading-tight">
              {ffmpegMode === "cpu" 
                ? "CPU 模式使用 libx264 編碼器，設定較高壓縮比與高品質參數 (-crf 18 -preset slow)。" 
                : "Nvidia 模式使用 GPU 硬體加速編碼器 h264_nvenc，可大幅縮短轉檔時間，兼顧超高畫質。"}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[var(--app-text-muted)] text-[11px] font-medium block">
              終端機指令 (Terminal / CMD)：
            </span>
            <div className="relative">
              <textarea
                readOnly
                value={ffmpegCommand}
                className="w-full bg-black text-green-400 font-mono text-[11px] leading-relaxed p-3.5 pr-12 rounded border border-[var(--app-border-light)] focus:outline-none select-all h-24 resize-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ffmpegCommand);
                  setCopiedFeedback(true);
                  setTimeout(() => setCopiedFeedback(false), 2000);
                  showToast("已將 ffmpeg 指令複製到剪貼簿！");
                }}
                className="absolute right-3 top-3 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                title="複製指令"
              >
                {copiedFeedback ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-300" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-[var(--app-border-base)] pt-3 text-xs text-[var(--app-text-muted)] space-y-1">
            <p className="font-semibold text-[var(--app-text-primary)]">💡 執行步驟：</p>
            <ol className="list-decimal pl-5 space-y-1 text-[var(--app-text-secondary)]">
              <li>打開您電腦的終端機 App (Windows 為 <strong>CMD / PowerShell</strong>，Mac/Linux 為 <strong>Terminal</strong>)。</li>
              <li>使用 <code>cd</code> 指令切換至存放影片與字幕檔的資料夾。</li>
              <li>複製並貼上上方的指令，然後按下 Enter 開始壓製。</li>
              <li>壓製完成後，即可於同個資料夾中獲得檔名開頭為 <strong>【KTV】</strong> 的全新壓製影片！</li>
            </ol>
          </div>
        </div>
      </BaseDialog>
    </div>
  );
}
