"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { FontSelect } from "@/components/common/FontSelect";
import { BaseDialog } from "@/components/dialog/BaseDialog";
import { RawTextDisplay } from "@/components/panel/RawTextDisplay";
import { useI18n } from "@/hooks/useI18n";
import { AssOptions, generateAss } from "@/lib/ass-generator";
import { formatTime, parseSeconds } from "@/lib/lyric-utils";
import { recolorSvgMonochrome } from "@/lib/svg-to-ass-vector";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  EyeOff,
  Film,
  Image as ImageIcon,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

const SHOW_INTERNAL_TEST_PARAMS = true;

/** Fixed ASS path for ffmpeg subtitles filter (avoids apostrophe/space parsing bugs). */
const FFMPEG_ASS_BURN_ALIAS = "__ktv_burn__.ass";

type FfmpegFilenameCompatOs = "unix" | "windows";

function detectFfmpegFilenameCompatOs(): FfmpegFilenameCompatOs {
  if (typeof navigator === "undefined") return "unix";
  return /Windows|Win32|Win64|WOW64/i.test(navigator.userAgent) ? "windows" : "unix";
}

function hasNvidiaGpu(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const dbgRenderInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbgRenderInfo) return false;
    const renderer = (gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || "").toString().toLowerCase();
    const vendor = (gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) || "").toString().toLowerCase();
    return (
      renderer.includes("nvidia") ||
      renderer.includes("geforce") ||
      renderer.includes("rtx") ||
      renderer.includes("gtx") ||
      vendor.includes("nvidia")
    );
  } catch (e) {
    return false;
  }
}

function buildFfmpegBurnCommand(opts: {
  ffmpegMode: "cpu" | "nvidia";
  originalVideoName: string;
  assFilename: string;
  outputVideoName: string;
  filenameCompat: boolean;
  filenameCompatOs: FfmpegFilenameCompatOs;
  forceFpsEnabled: boolean;
  targetFps: string;
  forceScale720pEnabled: boolean;
  tempAssAlias: string;
}): string {
  const {
    ffmpegMode,
    originalVideoName,
    assFilename,
    outputVideoName,
    filenameCompat,
    filenameCompatOs,
    forceFpsEnabled,
    targetFps,
    forceScale720pEnabled,
    tempAssAlias,
  } = opts;

  let filterChain: string[] = [];

  if (forceScale720pEnabled) {
    filterChain.push(`scale=-2:'max(ih,720)'`);
  }

  if (forceFpsEnabled) {
    filterChain.push(`fps=fps='max(source_fps,${targetFps})'`);
  }

  filterChain.push(
    filenameCompat
      ? `subtitles=${tempAssAlias}`
      : `subtitles='${assFilename}'`
  );

  const subtitlesFilter = filterChain.join(",");

  const ffmpegArgs =
    ffmpegMode === "cpu"
      ? `ffmpeg -i "${originalVideoName}" -vf "${subtitlesFilter}" -c:v libx264 -crf 18 -preset slow -c:a copy "${outputVideoName}"`
      : `ffmpeg -i "${originalVideoName}" -vf "${subtitlesFilter}" -c:v h264_nvenc -preset slow -cq 19 -rc constqp -pix_fmt yuv420p -c:a copy "${outputVideoName}"`;

  if (!filenameCompat) {
    return ffmpegArgs;
  }

  const setupAss =
    filenameCompatOs === "unix"
      ? `ln -sf "${assFilename}" ${tempAssAlias}`
      : `copy /Y "${assFilename}" ${tempAssAlias}`;

  const cleanupAss =
    filenameCompatOs === "unix"
      ? `rm -f ${tempAssAlias}`
      : `del /F /Q ${tempAssAlias}`;

  return `${setupAss} && ${ffmpegArgs} && ${cleanupAss}`;
}

export function getDefaultAssOptions(lrcMetadata: any) {
  const initialTT = lrcMetadata.TT || lrcMetadata.tt;
  const initialTTE = lrcMetadata.TTE || lrcMetadata.tte;
  const hasCustomTime = !!initialTT;
  const parsedStart = hasCustomTime ? parseSeconds(initialTT) || 1 : 1;
  const parsedEnd = initialTTE ? parseSeconds(initialTTE) || parsedStart + 6 : parsedStart + 6;

  return {
    primaryColor: "#2A04C8", // Blue N
    blueColor: "#2A04C8", // Blue B
    color2: "#BC2600", // Red
    color3: "#800080", // Purple
    chorusColor: "#32AA17", // Green
    orangeColor: "#FF7F00", // Orange
    grayColor: "#9CA3AF", // Gray
    fontFamily: "Noto Sans CJK TC Medium",
    fontSize: 130, // Default for BottomLeft
    fontSizeOffset: 20, // Pre-offset for Noto Sans CJK TC Medium
    infoFontSize: 100, // Default for CenterInfo (song info, fontSize - 40)
    infoTitleFontSize: 125, // Default for red Title (fontSize - 10)
    songInfoTitle: lrcMetadata.kti !== undefined ? lrcMetadata.kti : "",
    songInfoArtist: lrcMetadata.kar !== undefined ? lrcMetadata.kar : "",
    songInfoAlbum: lrcMetadata.kal !== undefined ? lrcMetadata.kal : "",
    songInfoCustom: lrcMetadata.ko !== undefined ? lrcMetadata.ko : "",
    interludeLogoSvg: lrcMetadata.klg !== undefined ? lrcMetadata.klg : "",
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
    logoMaxWidth: 450,
    logoMaxHeight: 300,
    logoMinInterludeGap: 9.0,
    logoMonochrome: false,
    logoMonochromeColor: "#FFFFFF",
    klgno: lrcMetadata.klgno !== undefined ? lrcMetadata.klgno : "",
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
    file,
  } = useEditor();
  const i18n = useI18n();
  const [fontConfigOpen, setFontConfigOpen] = useState(false);
  const [colorConfigOpen, setColorConfigOpen] = useState(false);
  const [dotConfigOpen, setDotConfigOpen] = useState(false);
  const [testParamsOpen, setTestParamsOpen] = useState(false);
  const [burnVideoDialogOpen, setBurnVideoDialogOpen] = useState(false);
  const [rawPreviewOpen, setRawPreviewOpen] = useState(false);
  const [ffmpegMode, setFfmpegMode] = useState<"cpu" | "nvidia">("cpu");

  useEffect(() => {
    if (hasNvidiaGpu()) {
      const timer = setTimeout(() => {
        setFfmpegMode("nvidia");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);
  const [ffmpegFilenameCompat, setFfmpegFilenameCompat] = useState(false);
  const [ffmpegFilenameCompatOs, setFfmpegFilenameCompatOs] = useState<FfmpegFilenameCompatOs>(
    detectFfmpegFilenameCompatOs,
  );
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [videoPreference, setVideoPreference] = useState<"original" | "best" | "advanced">("original");
  const [forceFpsEnabled, setForceFpsEnabled] = useState(false);
  const [targetFps, setTargetFps] = useState<"60" | "59.94" | "50" | "30" | "29.97">("60");
  const [forceScale720pEnabled, setForceScale720pEnabled] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [interludeLogoFileName, setInterludeLogoFileName] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<Omit<AssOptions, "interludeThreshold">>(() =>
    getDefaultAssOptions(lrcMetadata),
  );

  const [dotPreset, setDotPreset] = useState<"anime" | "general" | "custom">(() => {
    const rawOpts = getDefaultAssOptions(lrcMetadata);
    const outer = (rawOpts.dotOuterColor || "#eeeeee").toLowerCase();
    const inner = (rawOpts.dotInnerColor || "#ffffff").toLowerCase();
    const outerS = rawOpts.dotOuterSize !== undefined ? rawOpts.dotOuterSize : 0.26;
    const innerS = rawOpts.dotInnerSize !== undefined ? rawOpts.dotInnerSize : 0.24;
    const spacing = rawOpts.dotSpacing !== undefined ? rawOpts.dotSpacing : 0.75;
    if (outer === "#eeeeee" && inner === "#ffffff" && outerS === 0.26 && innerS === 0.24 && spacing === 0.75) {
      return "anime";
    }
    if (outer === "#ffffff" && inner === "#ffffff" && outerS === 0.26 && innerS === 0.24 && spacing === 0.75) {
      return "general";
    }
    return "custom";
  });

  const [tempAssAlias, setTempAssAlias] = useState("__ktv_burn_temp__.ass");

  useEffect(() => {
    if (burnVideoDialogOpen) {
      const rand = Math.floor(Math.random() * 1000000).toString(36);
      const timer = setTimeout(() => {
        setTempAssAlias(`__ktv_burn_${rand}__.ass`);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [burnVideoDialogOpen]);

  const activeForceFps = useMemo(() => {
    if (videoPreference === "best") return true;
    if (videoPreference === "advanced") return forceFpsEnabled;
    return false;
  }, [videoPreference, forceFpsEnabled]);

  const activeTargetFps = useMemo(() => {
    if (videoPreference === "best") return "60";
    return targetFps;
  }, [videoPreference, targetFps]);

  const activeForceScale720p = useMemo(() => {
    if (videoPreference === "best") return true;
    if (videoPreference === "advanced") return forceScale720pEnabled;
    return false;
  }, [videoPreference, forceScale720pEnabled]);

  const interludeLogoPreviewSvg = useMemo(() => {
    if (!options.interludeLogoSvg) return "";
    let svg = options.interludeLogoSvg;
    if (options.logoMonochrome) {
      svg = recolorSvgMonochrome(svg, options.logoMonochromeColor ?? "#FFFFFF");
    }
    return svg.replace(/<svg/i, '<svg style="width:100%;height:100%"');
  }, [options.interludeLogoSvg, options.logoMonochrome, options.logoMonochromeColor]);

  const [newExcludeStart, setNewExcludeStart] = useState("");
  const [newExcludeEnd, setNewExcludeEnd] = useState("");

  const parsedIntervals = useMemo(() => {
    if (!options.klgno) return [];
    return options.klgno
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const parts = part.split("-");
        if (parts.length === 2) {
          return {
            startStr: parts[0].trim(),
            endStr: parts[1].trim(),
            raw: part,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [options.klgno]);

  const handleAddExcludeInterval = () => {
    const start = newExcludeStart.trim();
    const end = newExcludeEnd.trim();
    if (!start || !end) {
      showToast("開始時間與結束時間皆為必填");
      return;
    }
    const timeFormat = /^\d+:\d+(?:\.\d+)?$/;
    if (!timeFormat.test(start) || !timeFormat.test(end)) {
      showToast("時間格式不正確，例：01:11.099");
      return;
    }

    const tStart = parseSeconds(start);
    const tEnd = parseSeconds(end);
    if (tStart >= tEnd) {
      showToast("開始時間必須小於結束時間");
      return;
    }

    const newItem = `${start}-${end}`;
    const prevList = options.klgno ? options.klgno.split(";").filter(Boolean) : [];

    if (prevList.includes(newItem)) {
      showToast("此不顯示時段已存在");
      return;
    }

    const newList = [...prevList, newItem].join(";");
    const updated = { ...options, klgno: newList };
    setOptions(updated);
    syncToLrcMetadata(updated);

    setNewExcludeStart("");
    setNewExcludeEnd("");
    showToast("已成功新增特殊自訂 Logo 排除時段");
  };

  const handleRemoveExcludeInterval = (idxToRemove: number) => {
    const prevList = options.klgno ? options.klgno.split(";").filter(Boolean) : [];
    const filtered = prevList.filter((_, idx) => idx !== idxToRemove);
    const newList = filtered.join(";");
    const updated = { ...options, klgno: newList };
    setOptions(updated);
    syncToLrcMetadata(updated);
    showToast("已刪除該排除時段");
  };

  const originalVideoName = audioFileName || "video.mp4";
  const baseName = useMemo(() => {
    return audioFileName ? audioFileName.replace(/\.[^/.]+$/, "") : lrcMetadata.ti || "KTV";
  }, [audioFileName, lrcMetadata.ti]);
  const assFilename = `${baseName}.ass`;
  const outputVideoName = `【KTV】${originalVideoName}`;

  const ffmpegCommand = useMemo(
    () =>
      buildFfmpegBurnCommand({
        ffmpegMode,
        originalVideoName,
        assFilename,
        outputVideoName,
        filenameCompat: ffmpegFilenameCompat,
        filenameCompatOs: ffmpegFilenameCompatOs,
        forceFpsEnabled: activeForceFps,
        targetFps: activeTargetFps,
        forceScale720pEnabled: activeForceScale720p,
        tempAssAlias,
      }),
    [
      ffmpegMode,
      originalVideoName,
      assFilename,
      outputVideoName,
      ffmpegFilenameCompat,
      ffmpegFilenameCompatOs,
      activeForceFps,
      activeTargetFps,
      activeForceScale720p,
      tempAssAlias,
    ],
  );

  // 當 Lrc 內部的自訂 KTV 中繼資料被更新時，將歌名、歌手、專輯與自訂欄位同步至 options，確保資料即時更新且不遺失自定義渲染樣式（不自動回退至通用屬性）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptions((prev) => {
      const metadataTitle = lrcMetadata.kti !== undefined ? lrcMetadata.kti : "";
      const metadataArtist = lrcMetadata.kar !== undefined ? lrcMetadata.kar : "";
      const metadataAlbum = lrcMetadata.kal !== undefined ? lrcMetadata.kal : "";
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
          if (!detectedVideo || detectedVideo.width !== w || detectedVideo.height !== h) {
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
      songDuration: duration,
    });
  }, [lines, lrcMetadata, options, dualLineGapSec, duration]);

  const handleInterludeLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
      showToast("請選擇 SVG 格式的 Logo 圖檔");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const svgText = reader.result as string;
      const updated = { ...options, interludeLogoSvg: svgText };
      setOptions(updated);
      syncToLrcMetadata(updated);
      setInterludeLogoFileName(file.name);
      showToast(`已載入 Logo：${file.name}`);
    };
    reader.onerror = () => {
      showToast("讀取 SVG 檔案失敗");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearInterludeLogo = () => {
    const updated = { ...options };
    delete updated.interludeLogoSvg;
    setOptions(updated);
    syncToLrcMetadata(updated);
    setInterludeLogoFileName(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    showToast("已清除 Logo 圖檔");
  };

  const handleDownload = async () => {
    const electronAPI = (window as any).electronAPI;

    // Create base filename from audio or metadata
    const baseName = audioFileName
      ? audioFileName.replace(/\.[^/.]+$/, "")
      : lrcMetadata.ti || "KTV";
    const defaultName = `${baseName}.ass`;

    if (electronAPI?.showSaveDialog) {
      let defaultPath = defaultName;

      const getFilePath = (f: any) => {
        if (!f) return null;
        if (electronAPI?.getPathForFile) {
          return electronAPI.getPathForFile(f) || f.path;
        }
        return f.path;
      };

      const mediaPath = getFilePath(file);
      if (mediaPath) {
        try {
          const parsed = await electronAPI.pathParse(mediaPath);
          defaultPath = await electronAPI.pathJoin(parsed.dir, defaultName);
        } catch (e) {
          console.error("Path parse/join failed", e);
        }
      }

      const result = await electronAPI.showSaveDialog({
        title: i18n.saveAss || ".ass KTV字幕 (逐字同步)",
        defaultPath: defaultPath,
        filters: [
          { name: "Advanced Substation Alpha", extensions: ["ass"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result.canceled && result.filePath) {
        await electronAPI.fsWriteFileText(result.filePath, assContent);
        showToast(`${i18n.savedTo || "已儲存至 "}${result.filePath}`);
        return;
      }
      if (result.canceled) return;
    }

    const blob = new Blob([assContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = defaultName;
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
    const title = metadata?.title || metadata?.rawTags?.TITLE || metadata?.rawTags?.title || "";
    const artist = metadata?.artist || metadata?.rawTags?.ARTIST || metadata?.rawTags?.artist || "";
    const album = metadata?.album || metadata?.rawTags?.ALBUM || metadata?.rawTags?.album || "";
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
    const predefinedKeys = ["ti", "ar", "al", "au", "by", "offset", "re", "ve", "length", "tool"];
    const sysKeysList = ["kti", "kar", "kal", "ko", "tt", "tte", "kth", "klg"];

    const customParts: string[] = [];
    for (const [key, value] of Object.entries(lrcMetadata)) {
      if (!predefinedKeys.includes(key) && !sysKeysList.includes(key.toLowerCase()) && value) {
        if (
          !key.toLowerCase().startsWith("kstyledef_") &&
          key.toLowerCase() !== "kstyle" &&
          key.toLowerCase() !== "kstyledef"
        ) {
          customParts.push(`${key}：${value}`);
        }
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
        Math.abs(newOptions.startInfoEndTime - (newOptions.startInfoStartTime + 6)) < 0.005;
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
    // 同步間奏 Logo 圖檔 (klg)
    if (newOptions.interludeLogoSvg !== undefined) {
      if (newOptions.interludeLogoSvg) {
        updatedMeta.klg = newOptions.interludeLogoSvg;
      } else {
        delete updatedMeta.klg;
      }
    }
    // 同步不顯示 Logo 時段 (klgno)
    if (newOptions.klgno !== undefined) {
      if (newOptions.klgno) {
        updatedMeta.klgno = newOptions.klgno;
      } else {
        delete updatedMeta.klgno;
      }
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
        interludeLogoSvg: "",
        klgno: "",
      }));
    } else {
      const extTT = lrcMetadata.TT || lrcMetadata.tt;
      const extTTE = lrcMetadata.TTE || lrcMetadata.tte;
      const hasExtCustom = !!extTT;
      const extStart = hasExtCustom ? parseSeconds(extTT) || 1 : 1;
      const extEnd = extTTE ? parseSeconds(extTTE) || extStart + 6 : extStart + 6;

      // 歌曲資訊完全「不要」自動從預設的LRC標籤(ti, ar, al)匯入，只在明確設定了專用屬性(kti, kar, kal)時才讀取
      // 如此一來可完美支援使用者刻意將主唱與專輯留空的需求
      const loadedTitle = lrcMetadata.kti !== undefined ? lrcMetadata.kti : "";
      const loadedArtist = lrcMetadata.kar !== undefined ? lrcMetadata.kar : "";
      const loadedAlbum = lrcMetadata.kal !== undefined ? lrcMetadata.kal : "";
      const loadedCustom = lrcMetadata.ko !== undefined ? lrcMetadata.ko : "";
      const loadedLogo = lrcMetadata.klg !== undefined ? lrcMetadata.klg : "";
      const loadedKlgno = lrcMetadata.klgno !== undefined ? lrcMetadata.klgno : "";

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
        interludeLogoSvg: loadedLogo,
        klgno: loadedKlgno,
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
    lrcMetadata.klg,
    lrcMetadata.klgno,
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
          <a
            href="https://fonts.google.com/download?family=Noto%20Sans%20TC"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-accent)] underline underline-offset-4 decoration-zinc-500 hover:decoration-[var(--app-accent)] transition-all font-semibold z-10 flex items-center gap-1 mr-3"
            title="下載推薦的 Noto Sans TC 字體檔"
          >
            <Download className="w-3.5 h-3.5 text-orange-400" /> 下載預設字體
          </a>

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
      <div className="flex-1 p-4 bg-[var(--app-bg-base)] flex flex-col gap-4 overflow-y-auto">
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
                        showToast(`已套用影片原始比例：${v.videoWidth} x ${v.videoHeight}`);
                      }}
                      className="text-[10px] text-[var(--app-accent)] hover:underline font-medium flex items-center gap-1 bg-[var(--app-bg-base)] border border-[var(--app-border-light)] rounded px-2 py-0.5"
                    >
                      🎯 套用影片原始大小 ({detectedVideo.width}x{detectedVideo.height})
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
                            : options.playResX === 1280 && options.playResY === 720
                              ? "1280x720"
                              : options.playResX === 1440 && options.playResY === 1080
                                ? "1440x1080"
                                : options.playResX === 960 && options.playResY === 720
                                  ? "960x720"
                                  : options.playResX === 2560 && options.playResY === 1080
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
                        <option value="1920x1080">16:9 FHD (1920 x 1080)</option>
                        <option value="1280x720">16:9 HD (1280 x 720)</option>
                        <option value="1440x1080">4:3 FHD (1440 x 1080)</option>
                        <option value="960x720">4:3 Standard (960 x 720)</option>
                        <option value="2560x1080">21:9 UltraWide (2560 x 1080)</option>
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
                      onChange={(e) => setDualLineGapSec(parseFloat(e.target.value))}
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

              {/* 字體設定 */}
              <div className="flex flex-col gap-1.5">
                <div
                  onClick={() => setFontConfigOpen(!fontConfigOpen)}
                  className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-[var(--app-accent)] transition-colors"
                >
                  <span>字體設定</span>
                  {fontConfigOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
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
                              infoFontSize: (options.infoFontSize || 110) + diff,
                              infoTitleFontSize: (options.infoTitleFontSize || 140) + diff,
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
                              setOptions({
                                ...options,
                                infoTitleFontSize: val,
                              });
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

              {/* 字幕顏色設定 */}
              {SHOW_INTERNAL_TEST_PARAMS && (
                <div className="flex flex-col gap-1.5">
                  <div
                    onClick={() => setColorConfigOpen(!colorConfigOpen)}
                    className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-[var(--app-accent)] transition-colors"
                  >
                    <span>字幕顏色設定</span>
                    {colorConfigOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                    )}
                  </div>

                  {colorConfigOpen && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded animate-in fade-in duration-200">
                      {/* 已唱預設N（預設） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱預設N (預設)
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

                      {/* 已唱綠色G（合唱） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱綠色G (合唱)
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
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {options.chorusColor.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 已唱藍色B（男 or 第一人） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱藍色B (男 or 第一人)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={options.blueColor || "#2A04C8"}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                blueColor: e.target.value,
                              })
                            }
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {(options.blueColor || "#2A04C8").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 已唱紅色R（女 or 第二人） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱紅色R (女 or 第二人)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={options.color2}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                color2: e.target.value,
                              })
                            }
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {options.color2.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 已唱紫色P（第三人） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱紫色P (第三人)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={options.color3}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                color3: e.target.value,
                              })
                            }
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {options.color3.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 已唱橘色O（第四人） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                          已唱橘色O (第四人)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={options.orangeColor || "#FF7F00"}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                orangeColor: e.target.value,
                              })
                            }
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {(options.orangeColor || "#FF7F00").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 已唱灰色T（旁白） */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-[var(--app-text-muted)] font-medium font-semibold">
                          已唱灰色T (旁白)
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={options.grayColor || "#9CA3AF"}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                grayColor: e.target.value,
                              })
                            }
                            className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                            {(options.grayColor || "#9CA3AF").toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* 開始資訊顏色 */}
                      <div className="flex flex-col gap-1 border-t border-[var(--app-border-light)] pt-2 col-span-2 mt-1">
                        <span className="text-[10px] text-[var(--app-accent)] font-semibold">
                          開始資訊顏色
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
                        <span className="text-[10px] text-[var(--app-text-muted)] font-semibold font-medium">
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
                    </div>
                  )}
                </div>
              )}

              {/* 間奏倒數小圓設定 */}
              <div className="flex flex-col gap-1.5">
                <div
                  onClick={() => setDotConfigOpen(!dotConfigOpen)}
                  className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-[var(--app-accent)] transition-colors"
                >
                  <span>間奏倒數小圓設定</span>
                  {dotConfigOpen ? (
                    <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                  )}
                </div>

                {dotConfigOpen && (
                  <div className="flex flex-col gap-3.5 bg-[var(--app-bg-input)] p-3 border border-[var(--app-border-light)] rounded animate-in fade-in duration-200">
                    
                    {/* Live Visual Countdown Dots Preview */}
                    <div className="flex flex-col gap-1 bg-black/35 p-2 rounded border border-zinc-900/60 shadow-inner">
                      <span className="text-[9px] text-zinc-500 font-bold select-none px-1 tracking-wide uppercase">
                        倒數計時小圓視覺預覽 (即時反應)
                      </span>
                      <div className="relative flex items-center justify-center h-20 bg-zinc-950 rounded overflow-hidden border border-zinc-900/40">
                        {/* Dark background overlay simulating video scene */}
                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_14px]" />
                        <div className="absolute top-1.5 left-2 px-1 py-0.5 bg-black/60 rounded border border-zinc-850 pointer-events-none">
                          <span className="text-[8px] font-mono tracking-tight text-white/50">1920x1080 KTV VIEW</span>
                        </div>
                        
                        <div className="absolute bottom-1.5 right-2 font-mono text-[8px] text-white/30 pointer-events-none">
                          {options.dotOuterColor?.toUpperCase()} / {options.dotInnerColor?.toUpperCase()}
                        </div>

                        {/* High-fidelity dots flex */}
                        <div 
                          className="flex items-center z-10" 
                          style={{ 
                            gap: `${(options.dotSpacing !== undefined ? options.dotSpacing : 0.75) * 44}px` 
                          }}
                        >
                          {[1, 2, 3, 4].map((i) => {
                            const outerS = (options.dotOuterSize !== undefined ? options.dotOuterSize : 0.26) * 110;
                            const innerS = (options.dotInnerSize !== undefined ? options.dotInnerSize : 0.24) * 110;
                            return (
                              <div
                                key={i}
                                className="rounded-full flex items-center justify-center transition-all duration-300 shadow-md"
                                style={{
                                  width: `${outerS}px`,
                                  height: `${outerS}px`,
                                  backgroundColor: options.dotOuterColor || "#eeeeee",
                                }}
                              >
                                <div
                                  className="rounded-full transition-all duration-300"
                                  style={{
                                    width: `${innerS}px`,
                                    height: `${innerS}px`,
                                    backgroundColor: options.dotInnerColor || "#ffffff",
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Preset Choice Cards (Grid Layout) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Preset Option: 外框白圓 */}
                      <button
                        type="button"
                        onClick={() => {
                          setDotPreset("anime");
                          setOptions((o) => ({
                            ...o,
                            dotOuterColor: "#EEEEEE",
                            dotInnerColor: "#FFFFFF",
                            dotOuterSize: 0.26,
                            dotInnerSize: 0.24,
                            dotSpacing: 0.75,
                          }));
                        }}
                        className={`flex flex-col items-center justify-between p-2 rounded border text-left transition-all cursor-pointer ${
                          dotPreset === "anime"
                            ? "bg-orange-500/10 border-orange-500/80 ring-1 ring-orange-500/30"
                            : "bg-zinc-900/40 border-[var(--app-border-light)] hover:border-[var(--app-border-base)]"
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-[var(--app-text-primary)]">外框白圓</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            dotPreset === "anime" ? "border-orange-500" : "border-zinc-600"
                          }`}>
                            {dotPreset === "anime" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                          </div>
                        </div>
                        
                        {/* Preset mini visualization */}
                        <div className="w-full h-8 bg-zinc-950 rounded flex items-center justify-center gap-1.5 mb-1.5 border border-zinc-900">
                          {[1, 2, 3].map((idx) => (
                            <div key={idx} className="w-3.5 h-3.5 rounded-full bg-[#EEEEEE] flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF]" />
                            </div>
                          ))}
                        </div>
                        <span className="text-[9px] text-[var(--app-text-muted)] text-center w-full block">適合動漫 MV</span>
                      </button>

                      {/* Preset Option: 一般白圓 */}
                      <button
                        type="button"
                        onClick={() => {
                          setDotPreset("general");
                          setOptions((o) => ({
                            ...o,
                            dotOuterColor: "#FFFFFF",
                            dotInnerColor: "#FFFFFF",
                            dotOuterSize: 0.26,
                            dotInnerSize: 0.24,
                            dotSpacing: 0.75,
                          }));
                        }}
                        className={`flex flex-col items-center justify-between p-2 rounded border text-left transition-all cursor-pointer ${
                          dotPreset === "general"
                            ? "bg-orange-500/10 border-orange-500/80 ring-1 ring-orange-500/30"
                            : "bg-zinc-900/40 border-[var(--app-border-light)] hover:border-[var(--app-border-base)]"
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-[var(--app-text-primary)]">一般白圓</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            dotPreset === "general" ? "border-orange-500" : "border-zinc-600"
                          }`}>
                            {dotPreset === "general" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                          </div>
                        </div>
                        
                        {/* Preset mini visualization */}
                        <div className="w-full h-8 bg-zinc-950 rounded flex items-center justify-center gap-1.5 mb-1.5 border border-zinc-900">
                          {[1, 2, 3].map((idx) => (
                            <div key={idx} className="w-3.5 h-3.5 rounded-full bg-[#FFFFFF] flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#FFFFFF]" />
                            </div>
                          ))}
                        </div>
                        <span className="text-[9px] text-[var(--app-text-muted)] text-center w-full block">一般 MV 適用</span>
                      </button>

                      {/* Preset Option: 自訂 */}
                      <button
                        type="button"
                        onClick={() => {
                          setDotPreset("custom");
                        }}
                        className={`flex flex-col items-center justify-between p-2 rounded border text-left transition-all cursor-pointer ${
                          dotPreset === "custom"
                            ? "bg-orange-500/10 border-orange-500/80 ring-1 ring-orange-500/30"
                            : "bg-zinc-900/40 border-[var(--app-border-light)] hover:border-[var(--app-border-base)]"
                        }`}
                      >
                        <div className="w-full flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-[var(--app-text-primary)]">自訂</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            dotPreset === "custom" ? "border-orange-500" : "border-zinc-600"
                          }`}>
                            {dotPreset === "custom" && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                          </div>
                        </div>
                        
                        {/* Preset mini visualization */}
                        <div className="w-full h-8 bg-zinc-950 rounded flex items-center justify-center mb-1.5 border border-zinc-900 relative overflow-hidden">
                          <div className="flex items-center gap-1" style={{ gap: `${Math.max(2, Math.min(8, (options.dotSpacing !== undefined ? options.dotSpacing : 0.75) * 8))}px` }}>
                            {[1, 2, 3].map((idx) => {
                              const sizeS = (options.dotOuterSize !== undefined ? options.dotOuterSize : 0.26) * 50;
                              const innerS = (options.dotInnerSize !== undefined ? options.dotInnerSize : 0.24) * 50;
                              return (
                                <div
                                  key={idx}
                                  className="rounded-full flex items-center justify-center shrink-0"
                                  style={{
                                    width: `${Math.max(6, Math.min(18, sizeS))}px`,
                                    height: `${Math.max(6, Math.min(18, sizeS))}px`,
                                    backgroundColor: options.dotOuterColor || "#eeeeee",
                                  }}
                                >
                                  <div
                                    className="rounded-full shrink-0"
                                    style={{
                                      width: `${Math.max(4, Math.min(16, innerS))}px`,
                                      height: `${Math.max(4, Math.min(16, innerS))}px`,
                                      backgroundColor: options.dotInnerColor || "#ffffff",
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-[9px] text-[var(--app-text-muted)] text-center w-full block">手動微調</span>
                      </button>
                    </div>

                    {/* Collapsible custom parameters, visible only if dotPreset is custom */}
                    {dotPreset === "custom" && (
                      <div className="space-y-3 bg-black/15 p-3 rounded border border-[var(--app-border-light)] mt-1 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                              外框部分顏色 (Hex)
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={options.dotOuterColor || "#eeeeee"}
                                onChange={(e) =>
                                  setOptions({
                                    ...options,
                                    dotOuterColor: e.target.value,
                                  })
                                }
                                className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0"
                              />
                              <span className="font-mono text-[10px] text-[var(--app-text-primary)]">
                                {(options.dotOuterColor || "#eeeeee").toUpperCase()}
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
                              {options.dotOuterSize !== undefined ? options.dotOuterSize : 0.26}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="0.5"
                            step="0.01"
                            value={options.dotOuterSize !== undefined ? options.dotOuterSize : 0.26}
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
                              {options.dotInnerSize !== undefined ? options.dotInnerSize : 0.24}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.4"
                            step="0.01"
                            value={options.dotInnerSize !== undefined ? options.dotInnerSize : 0.24}
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
                              {options.dotSpacing !== undefined ? options.dotSpacing : 0.75}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.2"
                            step="0.01"
                            value={options.dotSpacing !== undefined ? options.dotSpacing : 0.75}
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
              </div>

              {/* 密集測試區 */}
              {SHOW_INTERNAL_TEST_PARAMS && (
                <div className="flex flex-col gap-1.5">
                  <div
                    onClick={() => setTestParamsOpen(!testParamsOpen)}
                    className="flex items-center justify-between font-semibold text-[var(--app-text-primary)] text-xs cursor-pointer group hover:text-[var(--app-accent)] transition-colors"
                  >
                    <span>測試參數 (內部)</span>
                    {testParamsOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--app-text-muted)] group-hover:text-[var(--app-accent)]" />
                    )}
                  </div>

                  {testParamsOpen && (
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-[var(--app-bg-panel)] border border-[var(--app-border-light)] p-3 rounded animate-in fade-in duration-200">
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">行間距 (px)</label>
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
                        <label className="text-[var(--app-text-muted)]">左右邊距 LR (px)</label>
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
                        <label className="text-[var(--app-text-muted)]">上下邊距 V (px)</label>
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
                        <label className="text-[var(--app-text-muted)]">資訊字體</label>
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
                        <label className="text-[var(--app-text-muted)]">標題字體</label>
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
                        <label className="text-[var(--app-text-muted)]">字體補正 (px)</label>
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
                        <label className="text-[var(--app-text-muted)]">間奏緩衝 (s)</label>
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
                        <label className="text-[var(--app-text-muted)]">觸發索引</label>
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
                        <label className="text-[var(--app-text-muted)]">淡出模式</label>
                        <select
                          value={options.row2FadeoutMode}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              row2FadeoutMode: e.target.value as "immediate" | "delayed",
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5"
                        >
                          <option value="immediate">Immediate</option>
                          <option value="delayed">Delayed</option>
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">淡入淡出時間 (s)</label>
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
                        <label className="text-[var(--app-text-muted)]">延遲顯示資訊門檻 (s)</label>
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
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">Logo 最大寬度 (px)</label>
                        <input
                          type="number"
                          value={options.logoMaxWidth !== undefined ? options.logoMaxWidth : 450}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              logoMaxWidth: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5 font-mono text-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[var(--app-text-muted)]">Logo 最大高度 (px)</label>
                        <input
                          type="number"
                          value={options.logoMaxHeight !== undefined ? options.logoMaxHeight : 300}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              logoMaxHeight: parseInt(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5 font-mono text-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col col-span-2">
                        <label className="text-[var(--app-text-muted)]">
                          Logo 間奏顯示最小門檻 (s)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={
                            options.logoMinInterludeGap !== undefined
                              ? options.logoMinInterludeGap
                              : 9.0
                          }
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              logoMinInterludeGap: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="bg-[var(--app-bg-input)] border border-[var(--app-border-input)] rounded px-1 py-0.5 font-mono"
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

              {/* 自訂出版商Logo圖檔 */}
              <div className="flex flex-col gap-1.5 border border-[var(--app-border-light)] p-3 rounded bg-[var(--app-bg-input)]">
                <label className="font-semibold text-xs text-[var(--app-text-primary)] flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> 自訂出版商 Logo 圖檔 (SVG)
                </label>
                <p className="text-[10px] text-[var(--app-text-muted)] leading-relaxed">
                  僅支援 SVG 向量格式，匯出時會轉為 ASS
                  內嵌向量圖。目前測試階段固定顯示於左上角（左距 dualRowMarginL、上距
                  dualRowMarginV，等比例縮小至最大寬高範圍）。
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    onChange={handleInterludeLogoUpload}
                    className="text-xs bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded py-1.5 px-2 w-full text-[var(--app-text-primary)] border-dashed border-[var(--app-border-light)] file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-[var(--app-bg-hover)] file:text-[var(--app-text-primary)]"
                  />
                </div>
                {options.interludeLogoSvg && (
                  <div className="flex flex-col gap-2.5 mt-2 animate-fade-in border-t border-[var(--app-border-light)] pt-2.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-primary)] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!options.logoMonochrome}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              logoMonochrome: e.target.checked,
                            })
                          }
                          className="rounded border-[var(--app-border-input)]"
                        />
                        <span>變為單色</span>
                      </label>
                      <div
                        className={`flex items-center gap-2 ${options.logoMonochrome ? "" : "opacity-40 pointer-events-none"}`}
                      >
                        <input
                          type="color"
                          value={options.logoMonochromeColor ?? "#FFFFFF"}
                          disabled={!options.logoMonochrome}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              logoMonochromeColor: e.target.value,
                            })
                          }
                          className="h-6 w-6 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0 disabled:cursor-not-allowed"
                        />
                        <span className="font-mono text-[10px] text-[var(--app-text-muted)]">
                          {(options.logoMonochromeColor ?? "#FFFFFF").toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 shrink-0 border border-[var(--app-border-light)] rounded bg-white/10 flex items-center justify-center overflow-hidden"
                        dangerouslySetInnerHTML={{
                          __html: interludeLogoPreviewSvg,
                        }}
                      />
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-[var(--app-text-muted)] truncate max-w-[150px] font-mono leading-none">
                            {interludeLogoFileName || "從 LRC 載入的 SVG 圖檔"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const svgToSave = options.logoMonochrome
                                  ? recolorSvgMonochrome(
                                      options.interludeLogoSvg!,
                                      options.logoMonochromeColor ?? "#FFFFFF",
                                    )
                                  : options.interludeLogoSvg!;
                                const blob = new Blob([svgToSave], {
                                  type: "image/svg+xml;charset=utf-8",
                                });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = interludeLogoFileName || "publisher_logo.svg";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                showToast("已另存 Logo 圖片");
                              } catch (err) {
                                showToast("儲存失敗，請重試");
                              }
                            }}
                            className="shrink-0 flex items-center gap-1 py-0.5 px-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-200 transition-colors border border-blue-500/20 text-[10px] font-medium"
                          >
                            <span>另存這張圖片</span>
                          </button>
                        </div>
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={handleClearInterludeLogo}
                            className="flex items-center gap-1 py-0.5 px-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors border border-red-500/20 text-[10px] font-medium w-fit"
                            title="清除已選的圖片"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>清除已選的圖片</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 特殊自訂不要顯示 Logo 時段 */}
              <div
                id="exclude-logo-intervals"
                className="flex flex-col gap-2 border border-[var(--app-border-light)] p-3 rounded bg-[var(--app-bg-input)]"
              >
                <label className="font-semibold text-xs text-[var(--app-text-primary)] flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-orange-400" /> 特殊指定不顯示 Logo 時段
                </label>
                <p className="text-[10px] text-[var(--app-text-muted)] leading-relaxed">
                  可自訂特定時間戳範圍不要出現任何 Logo，時間戳核心顯示如歌詞不受影響。
                </p>

                {/* 新增區段 */}
                <div className="flex gap-2.5 items-end bg-[var(--app-bg-panel)] p-2.5 rounded border border-[var(--app-border-light)] z-10">
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                      開始時間 (mm:ss.cs/ms)
                    </span>
                    <input
                      type="text"
                      id="exclude-start-input"
                      value={newExcludeStart}
                      onChange={(e) => setNewExcludeStart(e.target.value)}
                      placeholder="01:11.099"
                      className="w-full bg-[var(--app-bg-base)] border border-[var(--app-border-input)] rounded px-2.5 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)] font-mono text-center"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[10px] text-[var(--app-text-muted)] font-medium">
                      結束時間 (mm:ss.cs/ms)
                    </span>
                    <input
                      type="text"
                      id="exclude-end-input"
                      value={newExcludeEnd}
                      onChange={(e) => setNewExcludeEnd(e.target.value)}
                      placeholder="01:17.211"
                      className="w-full bg-[var(--app-bg-base)] border border-[var(--app-border-input)] rounded px-2.5 py-1 text-xs text-[var(--app-text-primary)] focus:outline-none focus:border-[var(--app-accent)] font-mono text-center"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExcludeInterval}
                    className="shrink-0 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black font-semibold text-xs py-1.5 px-3 rounded transition-colors flex items-center gap-1 h-[26px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>新增</span>
                  </button>
                </div>

                {/* 清單顯示 */}
                <div className="flex flex-col gap-1.5 mt-1 max-h-[180px] overflow-y-auto pr-1">
                  {parsedIntervals.length === 0 ? (
                    <div className="text-[10px] text-[var(--app-text-muted)] text-center py-2.5 bg-black/10 rounded border border-dashed border-[var(--app-border-light)]">
                      尚未新增任何不顯示 Logo 的時段
                    </div>
                  ) : (
                    parsedIntervals.map((interval, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-xs font-mono bg-[var(--app-bg-panel)] border border-[var(--app-border-light)] rounded px-2.5 py-1.5 hover:bg-[var(--app-bg-hover)] transition-colors group"
                      >
                        <div className="flex items-center gap-2 text-[var(--app-text-primary)]">
                          <Clock className="w-3.5 h-3.5 text-orange-400/70" />
                          <span>{interval.startStr}</span>
                          <span className="text-[var(--app-text-muted)]">➔</span>
                          <span>{interval.endStr}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExcludeInterval(index)}
                          className="p-1 rounded hover:bg-red-500/10 text-[var(--app-text-muted)] hover:text-red-400 transition-colors"
                          title="刪除此時段"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="shrink-0 border-t border-[var(--app-border-base)] bg-[var(--app-bg-panel)] animate-fade-in">
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
                assContent || "; 沒有包含同步時間標籤的歌詞資料。請先到「逐字同步」頁尾打節拍。"
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
            要將字幕<strong>永久壓製固定 (Hardsub)</strong>在您的 MV
            影片中，最有效率且畫質最好的方式是使用免費開源工具 <strong>FFmpeg</strong>。
          </p>
          <p className="bg-[var(--app-accent)]/10 text-[var(--app-accent)] p-3 rounded border border-[var(--app-accent)]/30">
            ⚠️ <strong>開始前提醒：</strong>請確認您已點擊上方 <strong>「下載 .ass 檔」</strong>{" "}
            按鈕將字幕檔案儲存到本機，並與您的原始影片放置在
            <strong>同一個資料夾</strong>中。
            {ffmpegFilenameCompat && (
              <>
                {" "}
                已啟用加強檔名讀取：指令會透過暫存別名 <code>{tempAssAlias}</code>{" "}
                讀取字幕（適用檔名含撇號、空格等特殊字元），完成後會自動刪除該別名檔。
              </>
            )}
          </p>

          <div className="space-y-4 border border-[var(--app-border-light)] p-4 rounded bg-[var(--app-bg-input)]">
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

            <div className="space-y-2.5 pt-3 border-t border-[var(--app-border-light)]">
              <label className="text-xs font-semibold text-[var(--app-text-primary)] block font-semibold text-[var(--app-accent)]">
                影片品質偏好：
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVideoPreference("original");
                    setAdvancedOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded border text-left flex flex-col transition-all cursor-pointer ${
                    videoPreference === "original"
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5 text-[var(--app-accent)]"
                      : "border-[var(--app-border-input)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-muted)]"
                  }`}
                >
                  <span className="text-xs font-semibold block">同原影片畫質 (僅壓製字幕)</span>
                  <span className="text-[10px] mt-1 leading-tight text-[var(--app-text-muted)]">
                    同原影片畫質與影格數。
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVideoPreference("best");
                    setAdvancedOpen(false);
                  }}
                  className={`px-3 py-2.5 rounded border text-left flex flex-col transition-all cursor-pointer ${
                    videoPreference === "best"
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)]/15 text-[var(--app-accent)]"
                      : "border-[var(--app-border-input)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-muted)]"
                  }`}
                >
                  <span className="text-xs font-semibold block">最佳觀賞體驗 (強制拉高60fps、720p)</span>
                  <span className="text-[10px] mt-1 leading-tight text-[var(--app-text-muted)]">
                    強制拉高60fps與720p以上（專為 YouTube 與 BiliBili 最佳體驗設計）。
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setVideoPreference("advanced");
                    setAdvancedOpen(true);
                  }}
                  className={`px-3 py-2.5 rounded border text-left flex flex-col transition-all cursor-pointer ${
                    videoPreference === "advanced"
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)]/5 text-[var(--app-accent)]"
                      : "border-[var(--app-border-input)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-muted)]"
                  }`}
                >
                  <span className="text-xs font-semibold block">自訂/進階自訂區</span>
                  <span className="text-[10px] mt-1 leading-tight text-[var(--app-text-muted)]">
                    自訂 FPS 跟縮放尺寸設定。
                  </span>
                </button>
              </div>

              {/* 最佳觀賞體驗說明 */}
              {videoPreference === "best" && (
                <div className="bg-[var(--app-bg-panel)] p-2.5 rounded border border-[var(--app-border-light)] text-[11px] text-[var(--app-text-primary)] leading-normal space-y-1 mt-2">
                  <p className="font-semibold text-[var(--app-accent)] flex items-center gap-1 text-xs">
                    ✨ 最佳觀賞體驗：強制提高到 60fps 與 720p 以上
                  </p>
                  <p className="text-[10px] text-[var(--app-text-muted)] leading-relaxed">
                    本設定會強制將轉檔影格率拉升至 60fps、並將低於 720p 的原始影片等比例縮放至 720p。這兩項設定是為了能在 YouTube 與 Bilibili 上開啟「高影格率 60fps」播放選項的關鍵。
                  </p>
                  <p className="text-[10px] text-orange-400 mt-1 leading-relaxed font-semibold">
                    ⚠️ 說明：本程式僅做 KTV 字幕演譯最佳化生成，不包含 AI 補影格 (AI Frame Interpolation) 技術，檔案體積會變大但不會干涉原影片品質，非常適合用在 YouTube 與 Bilibili 上。
                  </p>
                </div>
              )}

              {/* 加強檔名讀取正確性 (獨立選項) */}
              <div className="space-y-1.5 bg-black/15 p-2.5 rounded border border-[var(--app-border-light)] text-xs mt-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="flex items-center gap-2 font-semibold text-[var(--app-text-primary)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ffmpegFilenameCompat}
                      onChange={(e) => setFfmpegFilenameCompat(e.target.checked)}
                      className="rounded border-[var(--app-border-input)] text-[var(--app-accent)] focus:ring-[var(--app-accent)]"
                    />
                    <span>加強檔名讀取正確性 (建議！防止多並行任務衝突)</span>
                  </label>
                  <select
                    value={ffmpegFilenameCompatOs}
                    onChange={(e) => setFfmpegFilenameCompatOs(e.target.value as FfmpegFilenameCompatOs)}
                    disabled={!ffmpegFilenameCompat}
                    className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-[var(--app-accent)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--app-text-primary)]"
                  >
                    <option value="unix">for Linux / macOS</option>
                    <option value="windows">for Windows</option>
                  </select>
                </div>
                <p className="text-[10px] text-[var(--app-text-muted)] leading-tight">
                  啟用後，轉檔時會使用隨機的臨時字幕別名檔讀取字幕（如 <code>{tempAssAlias}</code>），避免特殊字元或中文檔名衝突，完成後會自動清理隨機檔。
                </p>
              </div>
            </div>

            {/* 進階自訂區 (預設收合) */}
            <div className="border-t border-[var(--app-border-light)] pt-3 mt-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="flex items-center justify-between w-full text-xs font-semibold text-[var(--app-text-primary)] hover:text-[var(--app-accent)] transition-colors cursor-pointer select-none"
              >
                <span className="flex items-center gap-1">
                  ⚙️ 調整與進階參數自訂 (進階選項)
                </span>
                <span className="text-[10px] text-[var(--app-text-muted)] border border-[var(--app-border-light)] rounded px-1.5 py-0.5">
                  {advancedOpen ? "點擊收合 ▴" : "點擊展開 ▾"}
                </span>
              </button>

              {advancedOpen && (
                <div className="mt-3 space-y-3 pl-1 animate-fade-in text-xs">
                  {/* 強制提高 fps */}
                  <div className="space-y-1 bg-black/10 p-2.5 rounded border border-[var(--app-border-light)]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label className="flex items-center gap-2 font-semibold text-[var(--app-text-primary)] cursor-pointer select-none font-semibold">
                        <input
                          type="checkbox"
                          checked={videoPreference === "advanced" ? forceFpsEnabled : activeForceFps}
                          disabled={videoPreference !== "advanced"}
                          onChange={(e) => setForceFpsEnabled(e.target.checked)}
                          className="rounded border-[var(--app-border-input)] text-[var(--app-accent)] focus:ring-[var(--app-accent)] disabled:opacity-40"
                        />
                        <span>強制提高影格數 (FPS) 至：</span>
                      </label>
                      <select
                        value={activeTargetFps}
                        onChange={(e) => setTargetFps(e.target.value as any)}
                        disabled={videoPreference !== "advanced" || !forceFpsEnabled}
                        className="bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-0.5 text-[11px] font-mono focus:outline-none focus:border-[var(--app-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="60">60fps</option>
                        <option value="59.94">59.94fps</option>
                        <option value="50">50fps</option>
                        <option value="30">30fps</option>
                        <option value="29.97">29.97fps</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-[var(--app-text-muted)] leading-tight">
                      若原始影片的影格率 (FPS) 低於此數值，將強制拉高至該值（若原影片影格率已大於指定值，則保留原影格，絕不降低流暢度）。
                    </p>
                  </div>

                  {/* 強制提高 720p */}
                  <div className="space-y-1 bg-black/10 p-2.5 rounded border border-[var(--app-border-light)]">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <label className="flex items-center gap-2 font-semibold text-[var(--app-text-primary)] cursor-pointer select-none font-semibold">
                        <input
                          type="checkbox"
                          checked={videoPreference === "advanced" ? forceScale720pEnabled : activeForceScale720p}
                          disabled={videoPreference !== "advanced"}
                          onChange={(e) => setForceScale720pEnabled(e.target.checked)}
                          className="rounded border-[var(--app-border-input)] text-[var(--app-accent)] focus:ring-[var(--app-accent)] disabled:opacity-40"
                        />
                        <span>強制等比例放大至 720p 以上</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-[var(--app-text-muted)] leading-tight">
                      若原始影片的高度低於 720px，將強制等比例縮放至 720p。已達 720p 或更高者則保留原始解析度，不破壞原畫質尺寸。
                    </p>
                  </div>

                  {/* 進階狀態提醒 */}
                  {videoPreference !== "advanced" && (
                    <p className="text-[10px] text-orange-400 font-medium">
                      💡 目前非「自訂/進階自訂區」模式，上方 FPS 與 720p 勾選狀態已被簡便設置鎖定（同選擇的偏好）。如需手動微調請先在「影片品質偏好」中點擊「自訂/進階自訂區」。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[var(--app-text-muted)] text-[11px] font-medium block">
              終端機指令 (Terminal / CMD)：
            </span>
            <div className="relative">
              <textarea
                readOnly
                value={ffmpegCommand}
                className="w-full bg-black text-green-400 font-mono text-[11px] leading-relaxed p-3.5 pr-12 rounded border border-[var(--app-border-light)] focus:outline-none select-all h-28 resize-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(ffmpegCommand);
                  setCopiedFeedback(true);
                  setTimeout(() => setCopiedFeedback(false), 2000);
                  showToast("已將 ffmpeg 指令複製 to 剪貼簿！");
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

          <div className="space-y-1.5 border-t border-[var(--app-border-base)] pt-3 text-xs text-[var(--app-text-muted)]">
            <p className="font-semibold text-[var(--app-text-primary)]">💡 執行步驟：</p>
            <ol className="list-decimal pl-5 space-y-1 text-[var(--app-text-secondary)]">
              <li>
                打開您電腦的終端機 App (Windows 為 <strong>CMD / PowerShell</strong>，Mac/Linux 為{" "}
                <strong>Terminal</strong>)。
              </li>
              <li>
                使用 <code>cd</code> 指令切換至存放影片與字幕檔的資料夾。
              </li>
              <li>複製並貼上上方的指令，然後按下 Enter 開始壓製。</li>
              <li>
                壓製完成後，即可於同個資料夾中獲得檔名開頭為 <strong>【KTV】</strong>{" "}
                的全新壓製影片！
              </li>
            </ol>
          </div>
        </div>
      </BaseDialog>
    </div>
  );
}
