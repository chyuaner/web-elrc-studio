/* eslint-disable @next/next/no-img-element */
"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { ElectronWindowControls } from "@/components/base/ElectronWindowControls";
import { UndoRedoControls } from "@/components/common/UndoRedo";
import { AboutDialog } from "@/components/dialog/AboutDialog";
import { useDialogs } from "@/components/dialog/DialogProvider";
import { LrcMetadataDialog } from "@/components/dialog/LrcMetadataDialog";
import { useI18n } from "@/hooks/useI18n";
import { AppCommands } from "@/lib/app-commands";
import { parseRawLyrics } from "@/lib/lyric-utils";
import {
  ChevronDown,
  Download,
  Edit2,
  FileText,
  Film,
  Hand,
  Maximize,
  Moon,
  MoreVertical,
  Music,
  RotateCw,
  Tag,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { useFileActions } from "@/components/base/useFileActions";

export function TopToolbar({ hideTitle = false }: { hideTitle?: boolean }) {
  const {
    undo,
    redo,
    pastActions,
    futureActions,
    file,
    setFile,
    commitLines,
    resetHistory,
    lines,
    syncMode,
    setMetadata,
    metadata,
    audioFileName,
    lyricFileName,
    setLyricFileName,
    exportFormat,
    shiftTime,
    setAudioSpecs,
    setIsPlaying,
    playerRef,
    duration,
    setDuration,
    setPlaybackRate,
    lrcMetadata,
    setLrcMetadata,
    touchUIMode,
    setTouchUIMode,
    autoLoadLyrics,
    setAutoLoadLyrics,
    autoLoadMedia,
    setAutoLoadMedia,
    setMode,
  } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const lyricInputRef = useRef<HTMLInputElement>(null);
  const mixedInputRef = useRef<HTMLInputElement>(null);
  const dialogs = useDialogs();
  const i18n = useI18n();
  const {
    processAudioFile,
    processLyricFile,
    handleExport,
    clearMedia,
    clearLyrics,
    loadEmbeddedLyrics,
    loadSiblingMediaForLyrics,
  } = useFileActions();

  const [loadMediaDropdownOpen, setLoadMediaDropdownOpen] = useState(false);
  const [loadDropdownOpen, setLoadDropdownOpen] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [orientationState, setOrientationState] = useState<
    "default" | "portrait" | "landscape" | "auto"
  >("default");
  const [canRotate, setCanRotate] = useState(false);

  useEffect(() => {
    const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;
    const hasScreenLock =
      typeof window !== "undefined" &&
      typeof screen !== "undefined" &&
      !!screen.orientation &&
      typeof (screen.orientation as any).lock === "function";
    const isMobile =
      typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanRotate(isCapacitor || (hasScreenLock && isMobile));
  }, []);

  const handleRotateScreen = React.useCallback(async () => {
    let nextState: "default" | "portrait" | "landscape" | "auto" = "default";
    if (orientationState === "default") {
      nextState = "portrait";
    } else if (orientationState === "portrait") {
      nextState = "landscape";
    } else if (orientationState === "landscape") {
      nextState = "auto";
    } else if (orientationState === "auto") {
      nextState = "portrait";
    }

    setOrientationState(nextState);

    const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;
    if (isCapacitor) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const ThemeControl = registerPlugin<any>("ThemeControl");
        await ThemeControl.setScreenOrientation({ orientation: nextState });
      } catch (err) {
        console.warn("Failed to set screen orientation via Capacitor:", err);
      }
    } else if (
      typeof window !== "undefined" &&
      typeof screen !== "undefined" &&
      screen.orientation &&
      typeof (screen.orientation as any).lock === "function"
    ) {
      try {
        if (nextState === "portrait") {
          await (screen.orientation as any).lock("portrait");
        } else if (nextState === "landscape") {
          await (screen.orientation as any).lock("landscape");
        } else if (nextState === "auto") {
          (screen.orientation as any).unlock();
        }
      } catch (err) {
        console.warn("Failed to set screen orientation via HTML5 screen.orientation:", err);
      }
    }
  }, [orientationState]);

  const MORE_MENU_ITEMS: {
    type: "link" | "action";
    label: string;
    url?: string;
    action?: () => void;
  }[] = [
    // { type: 'link', label: 'Buy me a Coffee', url: 'https://buymeacoffee.com/' },
    { type: "link", label: "專案首頁", url: "https://elrc.yuaner.tw" },
    { type: "link", label: "作者首頁", url: "https://yuaner.tw" },
  ];

  useEffect(() => {
    const api = (
      window as unknown as {
        electronAPI?: {
          needsManualWindowDrag?: boolean;
          windowDragStart?: (p: { x: number; y: number }) => void;
          windowDragMove?: (p: { x: number; y: number }) => void;
          windowDragEnd?: () => void;
        };
      }
    ).electronAPI;
    if (!api?.needsManualWindowDrag) return;

    const isDragHandle = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return false;
      if (
        el.closest("button") ||
        el.closest("input") ||
        el.closest(".app-region-no-drag") ||
        el.closest("[data-electron-window-controls]")
      ) {
        return false;
      }
      return !!el.closest("header");
    };

    let dragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !isDragHandle(e.target)) return;
      dragging = true;
      api.windowDragStart?.({ x: e.screenX, y: e.screenY });
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      api.windowDragMove?.({ x: e.screenX, y: e.screenY });
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      api.windowDragEnd?.();
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        setLoadMediaDropdownOpen(false);
        setLoadDropdownOpen(false);
        setExportDropdownOpen(false);
        setMoreMenuOpen(false);
      }
    };

    if (loadMediaDropdownOpen || loadDropdownOpen || exportDropdownOpen || moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [loadMediaDropdownOpen, loadDropdownOpen, exportDropdownOpen, moreMenuOpen]);

  // Track Fullscreen state for hiding titlebar spacers
  useEffect(() => {
    const isCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor;

    const checkFs = () => {
      const isDOMFs = !!document.fullscreenElement;
      // 在 Capacitor 中，視窗尺寸判斷極不準確（因為 Edge-to-Edge 模式），故排除之
      const isWindowFs =
        !isCapacitor &&
        window.innerWidth === window.screen.width &&
        window.innerHeight === window.screen.height;
      const isAndroidFs = !!(window as any).isAndroidFullscreen;
      setIsFullscreen(isDOMFs || isWindowFs || isAndroidFs);
    };

    document.addEventListener("fullscreenchange", checkFs);
    window.addEventListener("resize", checkFs);
    window.addEventListener("androidfullscreenchange" as any, checkFs);
    setTimeout(checkFs, 100);

    const api = (
      window as unknown as {
        electronAPI?: {
          onWindowStateChange?: (cb: (s: any) => void) => () => void;
          getWindowState?: () => Promise<{ isFullScreen?: boolean }>;
        };
      }
    ).electronAPI;
    let electronUnsub: (() => void) | undefined;
    if (api?.onWindowStateChange) {
      electronUnsub = api.onWindowStateChange((s: any) => {
        setIsFullscreen(!!s?.isFullScreen || !!document.fullscreenElement);
      });
    }
    if (api?.getWindowState) {
      api
        .getWindowState()
        .then((s: any) => {
          setIsFullscreen(!!s?.isFullScreen || !!document.fullscreenElement);
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener("fullscreenchange", checkFs);
      window.removeEventListener("resize", checkFs);
      window.removeEventListener("androidfullscreenchange" as any, checkFs);
      if (electronUnsub) electronUnsub();
    };
  }, []);

  useEffect(() => {
    const tauri = (window as any).__TAURI__;
    const electronAPI = (window as any).electronAPI;
    // Focus/blur detection: Tauri and Electron modes only
    if (!tauri && !electronAPI?.isElectron) return;

    // Electron: prefer IPC-based focus events (more reliable on Wayland/X11)
    if (electronAPI?.isElectron && typeof electronAPI.onFocusChanged === "function") {
      const unlisten = electronAPI.onFocusChanged((focused: boolean) => {
        setIsFocused(focused);
      });
      return unlisten;
    }

    // Tauri / fallback: use window blur/focus events
    const handleBlur = () => setIsFocused(false);
    const handleFocus = () => setIsFocused(true);

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
  const electronAPI =
    typeof window !== "undefined"
      ? (
          window as unknown as {
            electronAPI?: {
              isElectron?: boolean;
              shell?: { useCustomWindowControls?: boolean };
            };
          }
        ).electronAPI
      : undefined;
  const isElectron = !!electronAPI?.isElectron;
  const isElectronCustomControls = !!electronAPI?.shell?.useCustomWindowControls;
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows");
  const finalHideTitle = hideTitle || (isTauri && isWindows);
  // Unfocused dimming: only in Electron or Tauri desktop modes
  const isDesktopShell = isTauri || isElectron;
  const isUnfocused = isDesktopShell && !isFocused;
  const titleColor = isUnfocused
    ? "text-[var(--app-text-muted)]"
    : "text-[var(--app-text-secondary)]";
  const unfocusedClass = isUnfocused ? "toolbar-unfocused" : "";

  const isLyricNameMismatch = React.useMemo(() => {
    if (!lyricFileName || !audioFileName) return false;
    if (
      lyricFileName === "Embedded Tag" ||
      lyricFileName === "New Lyrics" ||
      lyricFileName === i18n.embeddedTag
    )
      return false;
    const audioBase = audioFileName.includes(".")
      ? audioFileName.substring(0, audioFileName.lastIndexOf("."))
      : audioFileName;
    const lyricBase = lyricFileName.includes(".")
      ? lyricFileName.substring(0, lyricFileName.lastIndexOf("."))
      : lyricFileName;
    return audioBase !== lyricBase;
  }, [audioFileName, lyricFileName, i18n.embeddedTag]);

  const lyricNameClass = isLyricNameMismatch
    ? "text-red-500 font-bold"
    : "text-[var(--app-text-secondary)]";
  const noAudioClass = !audioFileName && lyricFileName ? "text-red-500 font-bold" : "";

  // AppCommands mapping extracted from useEditor hooks above

  useEffect(() => {
    // Expose state for Tauri
    AppCommands.register({
      getState: () => ({
        audioFileName,
        lyricFileName,
        canClearMedia: !!audioFileName,
        canClearLyrics: lines.length > 0,
        canLoadEmbeddedLyrics: !!metadata?.lyric,
      }),
      setAudioSpecs: (specs: { format?: string; bitrate?: string; sampleRate?: string }) => {
        setAudioSpecs(specs);
      },
      loadMedia: () => fileInputRef.current?.click(),
      loadLyrics: () => lyricInputRef.current?.click(),
      clearMedia: clearMedia,
      clearLyrics: clearLyrics,
      loadEmbeddedLyrics: async () => {
        loadEmbeddedLyrics(metadata);
      },
      showLrcMetadata: () => setMetadataDialogOpen(true),
      exportStandard: () => handleExport("standard", "file", ".lrc 標準LRC (逐行同步)"),
      exportEnhanced: () =>
        handleExport("enhanced", "file", ".lrc 增強型LRC (ESLYRIC ﹣ 逐字同步)"),
      exportSimple: () => handleExport("simple", "file", ".txt 簡易歌詞 (無時間戳)"),
      exportSrt: () => handleExport("srt", "file", ".srt 影片字幕 (逐行同步)"),
      exportEmbeddedStandard: () =>
        handleExport(
          "standard",
          "embedded",
          `${audioFileName ? audioFileName.substring(audioFileName.lastIndexOf(".")).toLowerCase() : ""} 已嵌入歌詞的 標準LRC (逐行同步)`,
        ),
      exportEmbeddedEnhanced: () =>
        handleExport(
          "enhanced",
          "embedded",
          `${audioFileName ? audioFileName.substring(audioFileName.lastIndexOf(".")).toLowerCase() : ""} 已嵌入歌詞的 增強型LRC (ESLYRIC ﹣ 逐字同步)`,
        ),
      exportEmbeddedSimple: () =>
        handleExport(
          "simple",
          "embedded",
          `${audioFileName ? audioFileName.substring(audioFileName.lastIndexOf(".")).toLowerCase() : ""} 已嵌入歌詞的 簡易歌詞 (無時間戳)`,
        ),
      exportCurrent: () => {
        const title =
          syncMode === "word" ? ".lrc 增強型LRC (ESLYRIC ﹣ 逐字同步)" : ".lrc 標準LRC (逐行同步)";
        handleExport(exportFormat as "standard" | "enhanced" | "simple" | "srt", "file", title);
      },
      getExportOptions: () => {
        const ext = audioFileName
          ? audioFileName.substring(audioFileName.lastIndexOf(".")).toLowerCase()
          : "";
        const options = [
          {
            label: ".lrc 增強型LRC (ESLYRIC ﹣ 逐字同步)",
            action: "exportEnhanced",
          },
          { label: ".lrc 標準LRC (逐行同步)", action: "exportStandard" },
          { label: ".txt 簡易歌詞 (無時間戳)", action: "exportSimple" },
          { label: ".srt 影片字幕 (逐行同步)", action: "exportSrt" },
          { label: ".ass KTV字幕 (逐字同步)", action: "exportAssKtv" },
        ];
        if (ext === ".flac" || ext === ".m4a" || ext === ".mp4") {
          options.push({ label: "---", action: "separator" });
          options.push({
            label: `${ext} 已嵌入歌詞的 增強型LRC (ESLYRIC ﹣ 逐字同步)`,
            action: "exportEmbeddedEnhanced",
          });
          options.push({
            label: `${ext} 已嵌入歌詞的 標準LRC (逐行同步)`,
            action: "exportEmbeddedStandard",
          });
          options.push({
            label: `${ext} 已嵌入歌詞的 簡易歌詞 (無時間戳)`,
            action: "exportEmbeddedSimple",
          });
        }
        return options;
      },
      shiftTime: async () => {
        const val = await dialogs.prompt(
          "Shift all timings by X seconds (e.g., 0.5 or -1.2):",
          "0",
        );
        if (val !== null) {
          const sec = parseFloat(val);
          if (!isNaN(sec) && sec !== 0) {
            shiftTime(sec);
          }
        }
      },
      undo: () => undo(1),
      redo: () => redo(1),
      undoToSequence: (steps: number) => undo(steps),
      redoToSequence: (steps: number) => redo(steps),
      getUndoList: () => pastActions.map((a, i) => ({ id: `undo-${i}`, name: a.action })),
      getRedoList: () =>
        futureActions.map((a) => ({
          id: `redo-${Math.random()}`,
          name: a.action,
        })),
    });
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
    if (isTauri) {
      try {
        (window as any).__TAURI__.core
          .invoke("on_app_state_changed", {
            audioFileName,
            lyricFileName,
            canClearMedia: !!audioFileName,
            canClearLyrics: lines.length > 0,
            canLoadEmbeddedLyrics: !!metadata?.lyric,
          })
          .catch(() => {});
      } catch (e) {}
      try {
        (window as any).__TAURI__.core
          .invoke("on_history_changed", {
            canUndo: pastActions.length > 0,
            canRedo: futureActions.length > 0,
            undoList: pastActions.map((a) => a.action),
            redoList: futureActions.map((a) => a.action),
          })
          .catch(() => {});
      } catch (e) {}
    }
  }, [
    dialogs,
    audioFileName,
    lyricFileName,
    lines.length,
    metadata,
    setFile,
    setMetadata,
    commitLines,
    setLyricFileName,
    resetHistory,
    shiftTime,
    undo,
    redo,
    pastActions,
    futureActions,
    handleExport,
    setAudioSpecs,
    exportFormat,
    setLrcMetadata,
    clearLyrics,
    clearMedia,
    loadEmbeddedLyrics,
  ]);

  const [dragOverlay, setDragOverlay] = useState<"media" | "lyric" | "file" | null>(null);

  React.useEffect(() => {
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverlay(null);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const f = e.dataTransfer.files[0];
        if (
          f.type.startsWith("audio/") ||
          f.type.startsWith("video/") ||
          f.name.toLowerCase().endsWith(".flac")
        ) {
          processAudioFile(f);
        } else if (f.name.toLowerCase().endsWith(".txt") || f.name.toLowerCase().endsWith(".lrc")) {
          processLyricFile(f);
        }
      }
    };

    const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;
    let unlisteners: (() => void)[] = [];

    if (isTauri) {
      (window as any).__TAURI__.core
        .invoke("show_titlebar_buttons")
        .catch((err: any) => console.error("Failed to show titlebar buttons", err));

      const setupTauriListeners = async () => {
        const tauri = (window as any).__TAURI__;
        // ... DND logic as in the image ...
        const dropEntry = await tauri.event.listen("tauri://drop", async (event: any) => {
          const paths = event.payload.paths || [];
          if (paths.length > 0) {
            const path = paths[0];
            // ... handle file ...
          }
          setDragOverlay(null);
        });
        unlisteners.push(dropEntry);
        // ... other listeners ...
      };
      setupTauriListeners();
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const isTauri = typeof window !== "undefined" && (window as any).__TAURI__;

      if (!dragOverlay) {
        let detected: "media" | "lyric" | "file" | null = null;

        if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
          const items = Array.from(e.dataTransfer.items);
          const hasFiles = items.some((i) => i.kind === "file");

          if (isTauri) {
            // Tauri sometimes doesn't expose kind/type properly during dragover, just show default if there's *any* item or types contains 'Files'
            if (e.dataTransfer.types.includes("Files")) {
              detected = "file";
            }
          } else {
            if (!hasFiles) return; // Ignore drag of text selections or images from other tabs

            const hasImage = items.some((i) => i.kind === "file" && i.type.startsWith("image/"));
            if (hasImage) return; // Ignore dragging cover images around

            const hasAudioVideo = items.some(
              (i) =>
                i.kind === "file" &&
                (i.type.startsWith("audio/") || i.type.startsWith("video/") || i.type === ""),
            );
            // Some browsers leave type empty for unknown formats like flac during dragover
            const hasText = items.some(
              (i) => i.kind === "file" && (i.type.startsWith("text/") || i.type === ""),
            );

            if (hasAudioVideo) detected = "media";
            else if (hasText) detected = "lyric";
            else detected = "file";
          }
        }

        if (detected) setDragOverlay(detected);
      }
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only hide if we leave the actual window, to prevent flickering over children
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).nodeName === "HTML") {
        setDragOverlay(null);
      }
    };

    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);

    return () => {
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
    };
  }, [dragOverlay, processAudioFile, processLyricFile]);

  // Create refs to always have access to the latest process functions without recreating Tauri listeners
  const processAudioRef = useRef(processAudioFile);
  const processLyricRef = useRef(processLyricFile);
  useEffect(() => {
    processAudioRef.current = processAudioFile;
    processLyricRef.current = processLyricFile;
  }, [processAudioFile, processLyricFile]);

  useEffect(() => {
    const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI__;
    if (!isTauri) return;

    let active = true;
    const unlisteners: (() => void)[] = [];
    const tauri = (window as any).__TAURI__;

    const setupTauriListeners = async () => {
      try {
        const uEnter = await tauri.event.listen("tauri://drag-enter", (event: any) => {
          const paths = event.payload?.paths || [];
          if (paths.length > 0) {
            const path = paths[0];
            const ext = path.split(".").pop()?.toLowerCase();
            let detected: "media" | "lyric" | "file" = "file";
            if (
              ["flac", "mp3", "wav", "m4a", "aac", "ogg", "mp4", "mkv", "webm"].includes(
                ext as string,
              )
            ) {
              detected = "media";
            } else if (["txt", "lrc"].includes(ext as string)) {
              detected = "lyric";
            }
            setDragOverlay(detected);
          }
        });
        if (active) unlisteners.push(uEnter);
        else
          try {
            uEnter();
          } catch (e) {}

        const uLeave = await tauri.event.listen("tauri://drag-leave", () => {
          setDragOverlay(null);
        });
        if (active) unlisteners.push(uLeave);
        else
          try {
            uLeave();
          } catch (e) {}

        const uCancelled = await tauri.event.listen("tauri://drag-cancelled", () => {
          setDragOverlay(null);
        });
        if (active) unlisteners.push(uCancelled);
        else
          try {
            uCancelled();
          } catch (e) {}

        const uDrop = await tauri.event.listen("tauri://drag-drop", async (event: any) => {
          setDragOverlay(null);
          const paths = event.payload?.paths || [];
          if (paths.length > 0) {
            const path = paths[0];
            const fileName = path.split(/[/\\]/).pop() || "temp_file";
            const ext = fileName.split(".").pop()?.toLowerCase();

            let mimeType = "application/octet-stream";
            if (ext === "flac") mimeType = "audio/flac";
            else if (ext === "mp3") mimeType = "audio/mpeg";
            else if (ext === "wav") mimeType = "audio/wav";
            else if (ext === "m4a") mimeType = "audio/mp4";
            else if (ext === "aac") mimeType = "audio/aac";
            else if (ext === "txt") mimeType = "text/plain";
            else if (ext === "lrc") mimeType = "text/plain";

            try {
              const bytes = await tauri.core.invoke("read_file_binary", {
                path,
              });
              const blob = new Blob([bytes], { type: mimeType });
              const file = new File([blob], fileName, { type: mimeType });

              if (ext === "txt" || ext === "lrc") {
                processLyricRef.current(file);
              } else {
                processAudioRef.current(file);
              }
            } catch (err) {
              console.error("Failed to read file from Tauri native drop:", err);
            }
          }
        });
        if (active) unlisteners.push(uDrop);
        else
          try {
            (uDrop as any)();
          } catch (e) {}
      } catch (err) {
        console.error("Error setting up Tauri drag listeners:", err);
      }
    };

    setupTauriListeners();

    return () => {
      active = false;
      unlisteners.forEach((u) => {
        try {
          if (typeof u === "function") (u as any)();
        } catch (e) {
          console.warn("Caught unlisten error:", e);
        }
      });
    };
    // processAudioRef and processLyricRef are stable refs, but we should include them anyway if we want to be strict.
    // However, the lint warning was specifically about exportFormat in another effect.
  }, []);

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processAudioFile(f);
  };

  const handleLyricSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processLyricFile(f);
  };

  const titlebarSpacerClass = (height: string) =>
    `${height} shrink-0 transition-[width] titlebar-drag-spacer ${
      isElectron ? "app-region-drag" : "app-region-drag pointer-events-none"
    }`;

  const renderTitlebarLeftSpacer = (height: string, hiddenLg = true) => {
    if (isFullscreen) return null;
    return (
      <div
        style={{ width: "var(--titlebar-left-padding, 0px)" }}
        className={`${titlebarSpacerClass(height)} ${hiddenLg ? "hidden lg:block" : ""}`}
      />
    );
  };

  const renderTitlebarRightEnd = (height: string, hiddenLg = true) => {
    if (isFullscreen) return null;
    return isElectronCustomControls ? (
      <ElectronWindowControls className={`${height} ${hiddenLg ? "hidden lg:flex" : "flex"}`} />
    ) : (
      <div
        style={{ width: "var(--titlebar-right-padding, 0px)" }}
        className={`${titlebarSpacerClass(height)} ${hiddenLg ? "hidden lg:block" : ""}`}
      />
    );
  };

  const interactiveShellClass = isElectron ? "app-region-no-drag" : "";

  const renderButtonsRow = (className: string) => (
    <div
      className={`relative z-[200] flex-row flex-wrap items-center justify-center lg:justify-between w-full px-2 py-2 gap-y-2 gap-x-4 ${className}`}
    >
      {/* Left Group */}
      <div
        className={`flex items-center gap-2 flex-wrap justify-center lg:justify-start ${interactiveShellClass}`}
      >
        {renderTitlebarLeftSpacer("h-8")}

        <div className="relative dropdown-container">
          <div className="flex group shadow-sm rounded">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-l text-xs font-medium border border-[var(--app-border-light)] border-r-0 flex items-center gap-2 text-[var(--app-text-secondary)] transition-colors min-w-0"
            >
              <Music className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{i18n.loadMedia}</span>
            </button>
            <button
              onClick={() => setLoadMediaDropdownOpen(!loadMediaDropdownOpen)}
              className="px-1.5 py-1.5 bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-r border border-[var(--app-border-light)] text-[var(--app-text-muted)] transition-colors shrink-0"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {loadMediaDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[9999] overflow-hidden py-1">
              <label className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoLoadLyrics}
                  onChange={(e) => setAutoLoadLyrics(e.target.checked)}
                  className="accent-[var(--app-accent)]"
                />
                自動載入歌詞
              </label>
              <div className="h-px bg-[var(--app-border-base)] mx-2 my-1" />
              <button
                onClick={() => {
                  audioInputRef.current?.click();
                  setLoadMediaDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors flex items-center gap-2"
              >
                <Music className="w-3.5 h-3.5" /> 載入音樂
              </button>
              <button
                onClick={() => {
                  videoInputRef.current?.click();
                  setLoadMediaDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors flex items-center gap-2"
              >
                <Film className="w-3.5 h-3.5" /> 載入MV影片
              </button>
              <div className="h-px bg-[var(--app-border-base)] mx-2 my-1" />
              {isElectron && (
                <>
                  <button
                    disabled={
                      !lyricFileName ||
                      lyricFileName === "New Lyrics" ||
                      lyricFileName === "Embedded Tag"
                    }
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                    onClick={async () => {
                      setLoadMediaDropdownOpen(false);
                      await loadSiblingMediaForLyrics();
                    }}
                  >
                    <Music className="w-3.5 h-3.5 text-blue-400" />
                    載入與歌詞檔同名的媒體檔案
                  </button>
                  <div className="h-px bg-[var(--app-border-base)] mx-2 my-1" />
                </>
              )}
              <button
                disabled={!file}
                onClick={async () => {
                  setLoadMediaDropdownOpen(false);
                  if (file) {
                    const newFile = new File([file], file.name, {
                      type: file.type,
                      lastModified: file.lastModified,
                    });
                    if ((file as any).path) {
                      Object.defineProperty(newFile, "path", { value: (file as any).path });
                    }
                    await processAudioFile(newFile, true);
                  }
                }}
                className="w-full text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors flex items-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5" /> 重新載入媒體
              </button>
              <button
                disabled={!audioFileName}
                onClick={() => {
                  clearMedia();
                  setLoadMediaDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-400 hover:bg-red-500 hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> {i18n.clearMedia}
              </button>
            </div>
          )}
        </div>

        <div className="relative dropdown-container">
          <div className="flex group shadow-sm rounded">
            <button
              onClick={() => lyricInputRef.current?.click()}
              className="px-3 py-1.5 bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-l text-xs font-medium border border-[var(--app-border-light)] border-r-0 flex items-center gap-2 text-[var(--app-text-secondary)] transition-colors min-w-0"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="truncate">{i18n.loadLyrics}</span>
            </button>
            <button
              onClick={() => setLoadDropdownOpen(!loadDropdownOpen)}
              className="px-1.5 py-1.5 bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-r border border-[var(--app-border-light)] text-[var(--app-text-muted)] transition-colors shrink-0"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {loadDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[9999] overflow-hidden py-1">
              {isElectron && (
                <>
                  <label className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLoadMedia}
                      onChange={(e) => setAutoLoadMedia(e.target.checked)}
                      className="accent-[var(--app-accent)]"
                    />
                    自動載入媒體
                  </label>
                  <div className="h-px bg-[var(--app-border-base)] mx-2 my-1" />
                </>
              )}
              <button
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                onClick={() => {
                  lyricInputRef.current?.click();
                  setLoadDropdownOpen(false);
                }}
              >
                <FileText className="w-3.5 h-3.5" />
                {i18n.loadFileLyrics}
              </button>
              <button
                disabled={!metadata?.lyric}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                onClick={async () => {
                  if (metadata?.lyric) {
                    if (lines.length > 0) {
                      const confirmed = await dialogs.confirm(i18n.confirmEmbeddedLyrics);
                      if (!confirmed) return;
                    }
                    const parsed = parseRawLyrics(metadata.lyric);
                    resetHistory(parsed.lines, parsed.metadata);
                  }
                  setLoadDropdownOpen(false);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                {i18n.loadEmbeddedLyrics}
              </button>
              {isElectron && (
                <>
                  <button
                    disabled={!audioFileName}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                    onClick={async () => {
                      setLoadDropdownOpen(false);
                      if (audioFileName) {
                        const electronAPI = (window as any).electronAPI;
                        let currentAudioPath = (file as any)?.path;
                        if (electronAPI?.getPathForFile && file) {
                          currentAudioPath = electronAPI.getPathForFile(file) || currentAudioPath;
                        }
                        if (currentAudioPath) {
                          const parsed = await electronAPI.pathParse(currentAudioPath);
                          const lrcPath = await electronAPI.pathJoin(
                            parsed.dir,
                            parsed.name + ".lrc",
                          );
                          if (await electronAPI.fsExists(lrcPath)) {
                            const text = await electronAPI.fsReadFileText(lrcPath);
                            const lrcFile = new File([text], parsed.name + ".lrc", {
                              type: "text/plain",
                            });
                            Object.defineProperty(lrcFile, "path", {
                              value: lrcPath,
                            });
                            processLyricFile(lrcFile);
                          } else {
                            dialogs.alert("找不到同名的 .lrc 檔案");
                          }
                        } else {
                          dialogs.alert("無法取得目前媒體檔的路徑");
                        }
                      } else {
                        dialogs.alert("請先載入媒體檔");
                      }
                    }}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    載入與音檔同名的.lrc歌詞檔案
                  </button>
                </>
              )}
              <div className="h-px bg-[var(--app-border-base)] mx-2 my-1" />
              <button
                disabled={lines.length === 0}
                onClick={() => {
                  clearLyrics();
                  setLoadDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-red-400 hover:bg-red-500 hover:text-[var(--app-text-primary)] transition-colors flex items-center gap-2"
              >
                <X className="w-3.5 h-3.5" /> {i18n.clearLyrics}
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-[var(--app-border-base)] mx-1 hidden sm:block"></div>
        <div className="relative z-30">
          <UndoRedoControls />
        </div>
      </div>

      {/* Right Group */}
      <div
        className={`flex items-center gap-2 flex-wrap justify-center lg:justify-end mt-2 lg:mt-0 ${interactiveShellClass}`}
      >
        <button
          onClick={() => setTouchUIMode(!touchUIMode)}
          title="觸控 UI 模式"
          className={`p-1.5 rounded transition-colors mr-1 ${touchUIMode ? "text-[var(--app-accent)] bg-[var(--app-bg-hover)]" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)]"}`}
        >
          <Hand className="w-4 h-4" />
        </button>
        {mounted && !isTauri && (
          <button
            onClick={() => AppCommands.toggleTheme?.()}
            title="切換深淺色"
            className="p-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors mr-1"
          >
            <Moon className="w-4 h-4" />
          </button>
        )}
        {canRotate && (
          <button
            onClick={handleRotateScreen}
            title={
              orientationState === "default"
                ? "旋轉螢幕 (系統預設)"
                : orientationState === "portrait"
                  ? "旋轉螢幕 (鎖定直向)"
                  : orientationState === "landscape"
                    ? "旋轉螢幕 (鎖定橫向)"
                    : "旋轉螢幕 (自動旋轉)"
            }
            className={`p-1.5 rounded transition-colors mr-1 ${orientationState === "auto" ? "text-[var(--app-accent)] bg-[var(--app-bg-hover)]" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)]"}`}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => AppCommands.toggleFullscreen?.()}
          title="全螢幕"
          className={`p-1.5 rounded transition-colors mr-1 ${isFullscreen ? "text-[var(--app-accent)] bg-[var(--app-bg-hover)]" : "text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)]"}`}
        >
          <Maximize className="w-4 h-4" />
        </button>
        <div className="relative dropdown-container">
          <div className="flex group shadow-sm rounded">
            <button
              onClick={() => {
                if (syncMode === "word") {
                  handleExport("enhanced", "file", ".lrc 增強型LRC (ESLYRIC ﹣ 逐字同步)");
                } else {
                  handleExport("standard", "file", ".lrc 標準LRC (逐行同步)");
                }
              }}
              title="儲存為 .LRC 檔案 (Ctrl+S)"
              className="px-3 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black rounded-l text-xs font-bold uppercase flex items-center gap-2 transition-colors border border-transparent"
            >
              <Download className="w-4 h-4" /> 儲存
            </button>
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="px-1.5 py-1.5 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black rounded-r text-xs font-bold uppercase flex items-center transition-colors border border-transparent border-l-black/20"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {exportDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-max min-w-[14rem] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[9999] overflow-hidden py-1 whitespace-nowrap">
              {AppCommands.getExportOptions().map((opt, i) =>
                opt.action === "separator" ? (
                  <div key={i} className="my-1 border-t border-[var(--app-border-base)] mx-2"></div>
                ) : (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors flex flex-col gap-1"
                    onClick={() => {
                      const actionMap = {
                        exportEnhanced: () => handleExport("enhanced", "file", opt.label),
                        exportStandard: () => handleExport("standard", "file", opt.label),
                        exportSimple: () => handleExport("simple", "file", opt.label),
                        exportSrt: () => handleExport("srt", "file", opt.label),
                        exportAssKtv: () => {
                          setMode("ktv-ass");
                        },
                        exportEmbeddedEnhanced: () =>
                          handleExport("enhanced", "embedded", opt.label),
                        exportEmbeddedStandard: () =>
                          handleExport("standard", "embedded", opt.label),
                        exportEmbeddedSimple: () => handleExport("simple", "embedded", opt.label),
                      };
                      (actionMap as any)[opt.action]();
                      setExportDropdownOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
        <div className="relative dropdown-container">
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            title="其他選項 (More)"
            className="p-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {moreMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-max min-w-[12rem] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[9999] overflow-hidden py-1 whitespace-nowrap">
              {MORE_MENU_ITEMS.map((opt, i) => {
                if (opt.type === "link" && opt.url) {
                  return (
                    <a
                      key={i}
                      href={opt.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-full text-left px-4 py-2 text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                      onClick={() => setMoreMenuOpen(false)}
                    >
                      {opt.label}
                    </a>
                  );
                }
                return (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-2 text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                    onClick={() => {
                      if (opt.type === "action" && opt.action) {
                        opt.action();
                      }
                      setMoreMenuOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <div className="h-px bg-[var(--app-border-base)] my-1" />
              <button
                className="w-full text-left px-4 py-2 text-sm text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors"
                onClick={() => {
                  setAboutDialogOpen(true);
                  setMoreMenuOpen(false);
                }}
              >
                關於 (About)
              </button>
            </div>
          )}
        </div>
        {renderTitlebarRightEnd("h-8")}
      </div>
    </div>
  );

  return (
    <>
      <input
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleAudioSelect}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <input
        type="file"
        accept="audio/*"
        className="hidden"
        ref={audioInputRef}
        onChange={handleAudioSelect}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <input
        type="file"
        accept="video/*"
        className="hidden"
        ref={videoInputRef}
        onChange={handleAudioSelect}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <input
        type="file"
        accept=".txt,.lrc"
        className="hidden"
        ref={lyricInputRef}
        onChange={handleLyricSelect}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <input
        type="file"
        accept="audio/*,video/*,.flac,.txt,.lrc"
        className="hidden"
        ref={mixedInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (
              f.type.startsWith("audio/") ||
              f.type.startsWith("video/") ||
              f.name.toLowerCase().endsWith(".flac")
            ) {
              processAudioFile(f);
            } else if (
              f.name.toLowerCase().endsWith(".txt") ||
              f.name.toLowerCase().endsWith(".lrc")
            ) {
              processLyricFile(f);
            }
          }
        }}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = "";
        }}
      />
      {dragOverlay && (
        <div
          className="fixed inset-0 z-[100] bg-[var(--app-bg-base)]/80 backdrop-blur-sm flex items-center justify-center border-[3px] border-dashed border-[var(--app-accent)] m-4 rounded-xl pointer-events-none"
          style={{
            marginTop: "max(1rem, var(--app-safe-area-top))",
            marginBottom: "max(1rem, var(--app-safe-area-bottom))",
            marginLeft: "max(1rem, var(--app-safe-area-left))",
            marginRight: "max(1rem, var(--app-safe-area-right))",
          }}
        >
          <div className="text-center flex flex-col items-center gap-4 text-[var(--app-accent)] bg-[var(--app-bg-panel)] px-12 py-8 rounded-2xl shadow-2xl animate-pulse">
            <Music className="w-16 h-16" />
            <span className="text-3xl font-bold tracking-wide">
              Load{" "}
              {dragOverlay === "media"
                ? "Media"
                : dragOverlay === "lyric"
                  ? "Lyrics"
                  : "Media / Lyrics"}
            </span>
          </div>
        </div>
      )}
      <header
        ref={(el) => {
          if (!el) return;
          const observer = new ResizeObserver((entries) => {
            document.documentElement.style.setProperty(
              "--header-height",
              `${entries[0].contentRect.height}px`,
            );
          });
          observer.observe(el);
          return () => observer.disconnect();
        }}
        className={`bg-[var(--app-bg-panel-alt)] border-b border-[var(--app-border-base)] shrink-0 relative select-none flex flex-col lg:flex-row lg:items-center lg:justify-between sticky top-0 z-[60] w-full transition-opacity duration-300 ${isElectron ? "app-region-drag" : ""} ${unfocusedClass}`}
        style={{
          display: "var(--top-toolbar-display, flex)",
          paddingTop: isFullscreen
            ? "0px"
            : "max(var(--android-safe-top, 0px), env(safe-area-inset-top, 0px))",
        }}
        onDoubleClick={(e) => {
          if (!isElectron) return;
          const target = e.target as HTMLElement;
          if (
            target.closest("button") ||
            target.closest("input") ||
            target.closest(".app-region-no-drag") ||
            target.closest("[data-electron-window-controls]")
          ) {
            return;
          }
          (
            window as unknown as {
              electronAPI?: { windowToggleMaximize?: () => void };
            }
          ).electronAPI?.windowToggleMaximize?.();
        }}
      >
        {/* Desktop Title (Absolute centered) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center whitespace-nowrap overflow-hidden z-20 hidden lg:flex gap-4 px-2 py-1">
          <button
            onClick={() => setAboutDialogOpen(true)}
            title="關於 Enhanced LRC Studio"
            className="app-region-no-drag p-1 rounded transition-colors relative group shrink-0"
          >
            <img
              src="/icon-light.svg"
              alt="App Icon"
              className="w-5 h-5 theme-icon-light opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <img
              src="/icon-dark.svg"
              alt="App Icon"
              className="w-5 h-5 theme-icon-dark opacity-80 group-hover:opacity-100 transition-opacity"
            />
          </button>
          <div className="flex flex-col items-center">
            {!finalHideTitle && (
              <h1
                className={`text-sm font-normal tracking-tight ${titleColor} transition-colors duration-300`}
              >
                <span className="font-bold">E</span>
                <span>nhanced</span> <span className="font-bold">LRC Studio</span>
              </h1>
            )}
            <div
              className={`${finalHideTitle ? "text-sm" : "text-[10px] mt-0.5"} text-[var(--app-text-muted)] font-mono flex items-center justify-center gap-2 max-w-full transition-all overflow-hidden whitespace-nowrap`}
            >
              {audioFileName ? (
                <span>
                  {i18n.audio}:{" "}
                  <span
                    className="text-[var(--app-text-secondary)] app-region-no-drag pointer-events-auto"
                    title={audioFileName}
                  >
                    {audioFileName}
                  </span>
                </span>
              ) : (
                <span className={noAudioClass}>{i18n.noAudio}</span>
              )}
              <span className="opacity-50 shrink-0">|</span>
              {lyricFileName ? (
                <span>
                  {i18n.lyrics}:{" "}
                  <span
                    className={`${lyricNameClass} app-region-no-drag pointer-events-auto`}
                    title={lyricFileName === "Embedded Tag" ? i18n.embeddedTag : lyricFileName}
                  >
                    {lyricFileName === "Embedded Tag" ? i18n.embeddedTag : lyricFileName}
                  </span>
                </span>
              ) : metadata?.lyric ? (
                <span>
                  {i18n.lyrics}:{" "}
                  <span
                    className="text-[var(--app-text-secondary)] app-region-no-drag pointer-events-auto"
                    title={i18n.embeddedTag}
                  >
                    {i18n.embeddedTag}
                  </span>
                </span>
              ) : (
                <span>{i18n.noLyrics}</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Title Row */}
        <div className="lg:hidden items-center justify-between w-full py-2 app-region-drag relative bg-[var(--app-bg-panel-alt)] z-10 flex">
          {renderTitlebarLeftSpacer("h-6", false)}
          <div className="flex items-center justify-center overflow-hidden px-2 z-0 flex-1 gap-2 min-w-0">
            <button
              onClick={() => setMetadataDialogOpen(true)}
              title="LRC屬性"
              className="app-region-no-drag p-1 text-[var(--app-text-muted)] hover:text-[var(--app-accent)] hover:bg-[var(--app-bg-hover)] rounded transition-colors relative group shrink-0"
            >
              <Tag className="w-4 h-4" />
              <div className="absolute bottom-0 right-0 bg-[var(--app-bg-panel-alt)] group-hover:bg-[var(--app-bg-hover)] rounded-sm p-[1px] transition-colors border border-transparent group-hover:border-[var(--app-accent)]/30">
                <Edit2 className="w-[8px] h-[8px]" />
              </div>
            </button>
            <div className="flex flex-col items-start justify-center min-w-0">
              {!finalHideTitle && (
                <h1
                  className={`text-sm font-normal tracking-tight ${titleColor} transition-colors duration-300`}
                >
                  <span className="font-bold">E</span>
                  <span>nhanced</span> <span className="font-bold">LRC Maker</span>
                </h1>
              )}
              <div
                className={`${finalHideTitle ? "text-sm" : "text-[10px] mt-0.5"} text-[var(--app-text-muted)] font-mono flex items-center justify-start gap-x-2 max-w-full transition-all flex-wrap`}
              >
                {audioFileName ? (
                  <span
                    className="text-[var(--app-text-secondary)] app-region-no-drag pointer-events-auto break-all"
                    title={audioFileName}
                  >
                    {audioFileName}
                  </span>
                ) : (
                  <span className={noAudioClass}>{i18n.noAudio}</span>
                )}
                <span className="opacity-50 shrink-0">|</span>
                {lyricFileName ? (
                  <span
                    className={`${lyricNameClass} app-region-no-drag pointer-events-auto break-all`}
                    title={lyricFileName === "Embedded Tag" ? i18n.embeddedTag : lyricFileName}
                  >
                    {lyricFileName === "Embedded Tag" ? i18n.embeddedTag : lyricFileName}
                  </span>
                ) : metadata?.lyric ? (
                  <span
                    className="text-[var(--app-text-secondary)] app-region-no-drag pointer-events-auto"
                    title={i18n.embeddedTag}
                  >
                    {i18n.embeddedTag}
                  </span>
                ) : (
                  <span>{i18n.noLyrics}</span>
                )}
              </div>
            </div>
          </div>
          {renderTitlebarRightEnd("h-6", false)}
        </div>

        {/* Desktop Buttons */}
        {renderButtonsRow("hidden lg:flex flex-1 z-[200] relative")}
      </header>
      {/* Mobile Buttons — wrapped so --top-toolbar-display: none also hides this row on Linux Tauri */}
      <div
        style={{ display: "var(--top-toolbar-display, flex)" }}
        className={`transition-opacity duration-300 relative z-[100] ${unfocusedClass}`}
      >
        {renderButtonsRow(
          "flex lg:hidden bg-[var(--app-bg-panel-alt)] border-b border-[var(--app-border-base)] shrink-0",
        )}
      </div>

      <LrcMetadataDialog isOpen={metadataDialogOpen} onClose={() => setMetadataDialogOpen(false)} />
      <AboutDialog isOpen={aboutDialogOpen} onClose={() => setAboutDialogOpen(false)} />
    </>
  );
}
