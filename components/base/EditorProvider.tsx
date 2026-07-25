"use client";

import { LrcMetadata, LyricLine, splitWordsAegisub, formatTime, parseSeconds, trimASCII } from "@/lib/lyric-utils";
import React, { createContext, useContext, useEffect, useReducer, useRef, useState } from "react";

interface Hotkeys {
  stampWord: string;
  nextLine: string;
}

export type EditorMode = "text" | "sync" | "dual-sync" | "raw" | "ktv-ass";
export type SyncMode = "line" | "word";
export type ExportFormat = "standard" | "enhanced" | "word" | "simple" | "srt";

export interface HistoryState {
  past: {
    lines: LyricLine[];
    lrcMetadata: LrcMetadata;
    action: string;
    cursor: { line: number; word: number };
  }[];
  present: { lines: LyricLine[]; lrcMetadata: LrcMetadata };
  future: {
    lines: LyricLine[];
    lrcMetadata: LrcMetadata;
    action: string;
    cursor: { line: number; word: number };
  }[];
}

type Action =
  | { type: "SET_LINES"; payload: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]) }
  | { type: "SET_METADATA"; payload: LrcMetadata | ((prev: LrcMetadata) => LrcMetadata) }
  | { type: "RESET"; payloadLines?: LyricLine[]; payloadMetadata?: LrcMetadata }
  | {
      type: "COMMIT";
      payloadLines?: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]);
      payloadMetadata?: LrcMetadata | ((prev: LrcMetadata) => LrcMetadata);
      actionName?: string;
      cursor?: { line: number; word: number };
    }
  | { type: "UNDO"; payload?: number }
  | { type: "REDO"; payload?: number };

function historyReducer(
  state: HistoryState,
  action: Action & { currentCursor: { line: number; word: number } },
): HistoryState {
  switch (action.type) {
    case "SET_LINES": {
      const newLines =
        typeof action.payload === "function" ? action.payload(state.present.lines) : action.payload;
      return { ...state, present: { ...state.present, lines: newLines } };
    }
    case "SET_METADATA": {
      const newMeta =
        typeof action.payload === "function"
          ? action.payload(state.present.lrcMetadata)
          : action.payload;
      return { ...state, present: { ...state.present, lrcMetadata: newMeta } };
    }
    case "RESET": {
      const newLines = action.payloadLines || state.present.lines;
      const newMeta = action.payloadMetadata || state.present.lrcMetadata;
      return { present: { lines: newLines, lrcMetadata: newMeta }, past: [], future: [] };
    }
    case "COMMIT": {
      let newLines = state.present.lines;
      if (action.payloadLines !== undefined) {
        newLines =
          typeof action.payloadLines === "function"
            ? action.payloadLines(state.present.lines)
            : action.payloadLines;
      }
      let newMeta = state.present.lrcMetadata;
      if (action.payloadMetadata !== undefined) {
        newMeta =
          typeof action.payloadMetadata === "function"
            ? action.payloadMetadata(state.present.lrcMetadata)
            : action.payloadMetadata;
      }
      return {
        past: [
          ...state.past,
          {
            lines: state.present.lines,
            lrcMetadata: state.present.lrcMetadata,
            action: action.actionName || "Update",
            cursor: action.currentCursor,
          },
        ],
        present: { lines: newLines, lrcMetadata: newMeta },
        future: [],
      };
    }
    case "UNDO": {
      const steps = action.payload || 1;
      if (state.past.length === 0) return state;
      const actualSteps = Math.min(steps, state.past.length);
      const newPast = state.past.slice(0, state.past.length - actualSteps);
      const newPresentObj = state.past[state.past.length - actualSteps];

      const undoneStates = state.past.slice(state.past.length - actualSteps + 1);
      const futureItems = [
        ...undoneStates,
        {
          lines: state.present.lines,
          lrcMetadata: state.present.lrcMetadata,
          action: newPresentObj.action,
          cursor: action.currentCursor,
        },
        ...state.future,
      ];

      return {
        past: newPast,
        present: { lines: newPresentObj.lines, lrcMetadata: newPresentObj.lrcMetadata },
        future: futureItems,
      };
    }
    case "REDO": {
      const steps = action.payload || 1;
      if (state.future.length === 0) return state;
      const actualSteps = Math.min(steps, state.future.length);
      const newPresentObj = state.future[actualSteps - 1];

      const redoneStates = state.future.slice(0, actualSteps - 1);
      const pastItems = [
        ...state.past,
        {
          lines: state.present.lines,
          lrcMetadata: state.present.lrcMetadata,
          action: state.future[0]?.action || "Update",
          cursor: action.currentCursor,
        },
        ...redoneStates,
      ];

      const newFuture = state.future.slice(actualSteps);
      return {
        past: pastItems,
        present: { lines: newPresentObj.lines, lrcMetadata: newPresentObj.lrcMetadata },
        future: newFuture,
      };
    }
    default:
      return state;
  }
}

export interface FileMetadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
  track?: string;
  lyric?: string;
  format?: string;
  picture?: any;
  pictures?: string[];
  rawTags?: Record<string, any>;
}

interface EditorContextType {
  file: File | null;
  fileUrl: string | null;
  audioFileName: string | null;
  lyricFileName: string | null;
  lyricFile: File | null;
  setLyricFileName: (name: string | null) => void;
  setLyricFile: (file: File | null) => void;
  setFile: (file: File | null) => void;
  metadata: FileMetadata | null;
  setMetadata: (meta: FileMetadata | null) => void;
  lrcMetadata: LrcMetadata;
  setLrcMetadata: (meta: LrcMetadata) => void;
  commitLrcMetadata: (meta: LrcMetadata, actionName?: string) => void;

  trackAssignments: number[];
  paragraphStarts: boolean[];
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: (enabled: boolean) => void;
  autoJumpEnabled: boolean;
  setAutoJumpEnabled: (enabled: boolean) => void;

  lines: LyricLine[];
  setLines: (payload: LyricLine[] | ((prev: LyricLine[]) => LyricLine[])) => void;
  resetHistory: (
    payloadLines: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]),
    payloadMetadata?: LrcMetadata,
  ) => void;
  commitLines: (
    payload: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]),
    actionName?: string,
    payloadMetadata?: LrcMetadata,
  ) => void;
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  shiftTime: (offsetSec: number) => void;
  shiftTimeFromIndex: (index: number, offsetSec: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  pastCount: number;
  futureCount: number;
  pastActions: { action: string }[];
  futureActions: { action: string }[];

  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  exportFormat: ExportFormat;
  setExportFormat: (format: ExportFormat) => void;
  dualLineGapSec: number;
  setDualLineGapSec: (sec: number) => void;

  syncMode: SyncMode;
  setSyncMode: (mode: SyncMode) => void;

  activeLineIndex: number;
  setActiveLineIndex: (idx: number) => void;
  activeWordIndex: number;
  setActiveWordIndex: (idx: number) => void;

  hotkeys: Hotkeys;
  setHotkeys: (hk: Hotkeys) => void;

  duration: number;
  setDuration: (time: number) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  audioLatency: number;
  setAudioLatency: (latency: number) => void;
  playbackRate: number;
  setPlaybackRate: React.Dispatch<React.SetStateAction<number>>;

  touchUIMode: boolean;
  setTouchUIMode: (touchUIMode: boolean) => void;

  playerRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>;

  audioSpecs: {
    format?: string;
    bitrate?: string;
    sampleRate?: string;
    bitsPerSample?: string;
  } | null;
  setAudioSpecs: (
    specs: {
      format?: string;
      bitrate?: string;
      sampleRate?: string;
      bitsPerSample?: string;
    } | null,
  ) => void;

  autoLoadLyrics: boolean;
  setAutoLoadLyrics: (val: boolean) => void;
  autoLoadMedia: boolean;
  setAutoLoadMedia: (val: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  handleFormatWords: () => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [lyricFileName, setLyricFileName] = useState<string | null>(null);
  const [lyricFile, setLyricFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("standard");
  const [dualLineGapSec, setDualLineGapSec] = useState<number>(6);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(false);
  const [autoJumpEnabled, setAutoJumpEnabled] = useState<boolean>(true);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [rawMode, setRawMode] = useState<EditorMode>("sync");
  const [syncMode, setSyncMode] = useState<SyncMode>("line");

  const mode = rawMode;

  useEffect(() => {
    let titleParts = [];
    if (audioFileName) {
      if (lyricFileName) {
        titleParts.push(`${audioFileName} (${lyricFileName})`);
      } else {
        titleParts.push(audioFileName);
      }
    } else if (lyricFileName) {
      titleParts.push(lyricFileName);
    }

    if (titleParts.length > 0) {
      document.title = `${titleParts.join(" ")} - Enhanced LRC Studio`;
    } else {
      document.title = "Enhanced LRC Studio";
    }
  }, [audioFileName, lyricFileName]);

  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  const [hotkeys, setHotkeys] = useState<Hotkeys>({
    stampWord: " ",
    nextLine: "m",
  });

  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLatency, setAudioLatency] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [touchUIMode, setTouchUIMode] = useState(false);
  const [audioSpecs, setAudioSpecs] = useState<{
    format?: string;
    bitrate?: string;
    sampleRate?: string;
  } | null>(null);
  const [autoLoadLyrics, setAutoLoadLyrics] = useState(true); // 自動載入歌詞 預設值
  const [autoLoadMedia, setAutoLoadMedia] = useState(false); // 自動載入媒體 預設值
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isElectron = !!(window as any).electronAPI?.isElectron;
      if (isElectron) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAutoLoadMedia(true);
      }
    }
  }, []);

  useEffect(() => {
    const isTouch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    if (isTouch) {
      setTimeout(() => setTouchUIMode(true), 0);
    }
  }, []);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const [historyState, dispatchLinesRaw] = useReducer(historyReducer, {
    past: [],
    present: { lines: [], lrcMetadata: {} },
    future: [],
  });

  const setMode = React.useCallback(
    (newMode: EditorMode) => {
      if (newMode === "sync" || newMode === "dual-sync") {
        const currentLines = historyState.present.lines;
        const hasWordTimestamps = currentLines.some(
          (l) => l.words && l.words.some((w) => w.start !== null),
        );
        if (hasWordTimestamps) {
          setSyncMode("word");
          setExportFormat("enhanced");
        }
      }
      setRawMode(newMode);
    },
    [historyState.present.lines],
  );

  const dispatchLines = (action: Action) => {
    dispatchLinesRaw({
      ...action,
      currentCursor: { line: activeLineIndex, word: activeWordIndex },
    } as any);
    if (action.type === "UNDO") {
      const steps = action.payload || 1;
      const actualSteps = Math.min(steps, historyState.past.length);
      const pastState = historyState.past[historyState.past.length - actualSteps];
      if (pastState?.cursor) {
        setActiveLineIndex(pastState.cursor.line);
        setActiveWordIndex(pastState.cursor.word);
      }
    } else if (action.type === "REDO") {
      const steps = action.payload || 1;
      const actualSteps = Math.min(steps, historyState.future.length);
      const futureState = historyState.future[actualSteps - 1];
      if (futureState?.cursor) {
        setActiveLineIndex(futureState.cursor.line);
        setActiveWordIndex(futureState.cursor.word);
      }
    }
  };

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFileUrl(url);
      setAudioFileName(file.name);
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl(null);
      setAudioFileName(null);
    }
  }, [file]);

  const lines = historyState.present.lines;
  const lrcMetadata = historyState.present.lrcMetadata;

  useEffect(() => {
    if (lines.length > 0 && activeLineIndex >= lines.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveLineIndex(0);
      setActiveWordIndex(0);
    }
  }, [lines.length, activeLineIndex]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (lines.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lines]);

  const trackAssignments = React.useMemo(() => {
    const tracks: number[] = [];
    const pStarts: boolean[] = [];
    let currentTrack = 0;

    let firstStampedFound = false;
    let explicitInterludePending = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLineEmpty =
        !line.raw || trimASCII(line.raw) === "" || line.words.every((w) => !trimASCII(w.text || ""));

      if (i === 0) {
        tracks.push(0);
        pStarts.push(true);
        if (line.start !== null) firstStampedFound = true;
        if (isLineEmpty && line.start !== null) explicitInterludePending = true;
        continue;
      }

      if (line.start !== null && !firstStampedFound) {
        firstStampedFound = true;
        currentTrack = 0;
        tracks.push(0);
        pStarts.push(true);
        if (isLineEmpty) explicitInterludePending = true;
        continue;
      }

      const prevLine = lines[i - 1];
      let prevEnd = prevLine.end;
      if (prevEnd === null && prevLine.words?.length > 0) {
        const lastWordWithStart = [...prevLine.words].reverse().find((w) => w.start !== null);
        if (lastWordWithStart) prevEnd = lastWordWithStart.start;
      }

      let gapSec = -1;
      if (prevEnd !== null && line.start !== null) {
        gapSec = line.start - prevEnd;
      }

      const prevIsSingle = !!prevLine.isSingleLine;
      const forceNewPara = !!line.isSingleLine || prevIsSingle || line.ktvsp != null;

      if (gapSec >= dualLineGapSec || explicitInterludePending || forceNewPara) {
        currentTrack = 0;
        pStarts.push(true);
        explicitInterludePending = false;
      } else {
        currentTrack = currentTrack === 0 ? 1 : 0;
        pStarts.push(false);
      }

      if (isLineEmpty && line.start !== null) {
        explicitInterludePending = true;
      }

      tracks.push(currentTrack);
    }
    return { tracks, pStarts };
  }, [lines, dualLineGapSec]);

  const setLines = (payload: LyricLine[] | ((prev: LyricLine[]) => LyricLine[])) => {
    dispatchLines({ type: "SET_LINES", payload });
  };
  const setLrcMetadata = (payload: LrcMetadata | ((prev: LrcMetadata) => LrcMetadata)) => {
    dispatchLines({ type: "SET_METADATA", payload });
  };
  const resetHistory = React.useCallback(
    (
      payloadLines: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]),
      payloadMetadata?: LrcMetadata,
    ) => {
      const newLines =
        typeof payloadLines === "function"
          ? payloadLines(historyState.present.lines)
          : payloadLines;
      dispatchLines({
        type: "RESET",
        payloadLines: newLines,
        payloadMetadata: payloadMetadata || {},
      });
      setActiveLineIndex(0);
      setActiveWordIndex(0);

      if (payloadMetadata && payloadMetadata.kth) {
        const parsed = parseFloat(payloadMetadata.kth);
        if (!isNaN(parsed) && parsed > 0) {
          setDualLineGapSec(parsed);
        }
      } else {
        setDualLineGapSec(6); // Reset to default
      }

      // Smart detect word timestamps on load
      const hasWordTimestamps = newLines.some(
        (l) => l.words && l.words.some((w) => w.start !== null),
      );
      if (hasWordTimestamps) {
        setSyncMode("word");
        setExportFormat("enhanced");
      }

      const hasAnyTimestamps = newLines.some(
        (l) => l.start !== null || (l.words && l.words.some((w) => w.start !== null)),
      );
      setAutoScrollEnabled(hasAnyTimestamps);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [historyState.present.lines],
  );
  const commitLines = (
    payload: LyricLine[] | ((prev: LyricLine[]) => LyricLine[]),
    actionName?: string,
    payloadMetadata?: LrcMetadata,
  ) => {
    dispatchLines({ type: "COMMIT", payloadLines: payload, actionName, payloadMetadata });
  };
  const commitLrcMetadata = (
    payload: LrcMetadata | ((prev: LrcMetadata) => LrcMetadata),
    actionName?: string,
  ) => {
    dispatchLines({
      type: "COMMIT",
      payloadMetadata: payload,
      actionName: actionName || "Update Metadata",
    });
  };
  const undo = (steps = 1) => dispatchLines({ type: "UNDO", payload: steps });
  const redo = (steps = 1) => dispatchLines({ type: "REDO", payload: steps });

  const shiftTime = (offsetSec: number) => {
    const oldMeta = historyState.present.lrcMetadata;
    const updatedMeta = { ...oldMeta };

    // 1. tt (歌曲自訂開始顯示時間)
    const initialTT = updatedMeta.TT || updatedMeta.tt;
    if (initialTT) {
      const key = updatedMeta.TT ? "TT" : "tt";
      const sec = parseSeconds(initialTT);
      const newSec = Math.max(0, sec + offsetSec);
      updatedMeta[key] = formatTime(newSec, false);
    }

    // 2. tte (歌曲自訂結束顯示時間)
    const initialTTE = updatedMeta.TTE || updatedMeta.tte;
    if (initialTTE) {
      const key = updatedMeta.TTE ? "TTE" : "tte";
      const sec = parseSeconds(initialTTE);
      const newSec = Math.max(0, sec + offsetSec);
      updatedMeta[key] = formatTime(newSec, false);
    }

    // 3. klgno (特殊指定不顯示 Logo 時段)
    if (updatedMeta.klgno) {
      const intervals = updatedMeta.klgno.split(";");
      const newIntervals = intervals
        .map((part) => {
          if (!part.trim()) return "";
          const times = part.split("-");
          if (times.length === 2) {
            const startVal = times[0].trim();
            const endVal = times[1].trim();

            const startSec = startVal.includes(":") ? parseSeconds(startVal) : parseFloat(startVal);
            const endSec = endVal.includes(":") ? parseSeconds(endVal) : parseFloat(endVal);

            if (!isNaN(startSec) && !isNaN(endSec)) {
              const newStartSec = Math.max(0, startSec + offsetSec);
              const newEndSec = Math.max(0, endSec + offsetSec);
              
              const newStartStr = startVal.includes(":") ? formatTime(newStartSec, false) : newStartSec.toFixed(2);
              const newEndStr = endVal.includes(":") ? formatTime(newEndSec, false) : newEndSec.toFixed(2);
              return `${newStartStr}-${newEndStr}`;
            }
          }
          return part;
        })
        .filter(Boolean);
      updatedMeta.klgno = newIntervals.join(";");
    }

    commitLines(
      (prev) =>
        prev.map((line) => {
          const start = line.start !== null ? Math.max(0, line.start + offsetSec) : null;
          const end = line.end !== null ? Math.max(0, line.end + offsetSec) : null;
          const words = line.words.map((w) => ({
            ...w,
            start: w.start !== null ? Math.max(0, w.start + offsetSec) : null,
            end: w.end !== null ? Math.max(0, w.end + offsetSec) : null,
          }));
          const updatedLine: any = { ...line, start, end, words };
          if (line.ktvsp != null) {
            updatedLine.ktvsp = Math.max(0, line.ktvsp + offsetSec);
          }
          return updatedLine;
        }),
      `Shift Time ${offsetSec > 0 ? "+" : ""}${offsetSec}s`,
      updatedMeta,
    );
  };

  const shiftTimeFromIndex = (index: number, offsetSec: number) => {
    commitLines(
      (prev) =>
        prev.map((line, i) => {
          if (i < index) return line;
          const start = line.start !== null ? Math.max(0, line.start + offsetSec) : null;
          const end = line.end !== null ? Math.max(0, line.end + offsetSec) : null;
          const words = line.words.map((w) => ({
            ...w,
            start: w.start !== null ? Math.max(0, w.start + offsetSec) : null,
            end: w.end !== null ? Math.max(0, w.end + offsetSec) : null,
          }));
          const updatedLine: any = { ...line, start, end, words };
          if (line.ktvsp != null) {
            updatedLine.ktvsp = Math.max(0, line.ktvsp + offsetSec);
          }
          return updatedLine;
        }),
      `Shift ${offsetSec > 0 ? "+" : ""}${offsetSec}s From #${index + 1}`,
    );
  };

  const handleFormatWords = () => {
    commitLines(
      (prev) =>
        prev.map((line) => ({
          ...line,
          words: splitWordsAegisub(line.words.map((w) => w.text).join("")),
        })),
      "Format Words",
    );
  };

  return (
    <EditorContext.Provider
      value={{
        file,
        setFile,
        fileUrl,
        audioFileName,
        lyricFileName,
        setLyricFileName,
        lyricFile,
        setLyricFile,
        metadata,
        setMetadata,
        lrcMetadata,
        setLrcMetadata,
        commitLrcMetadata,
        lines,
        setLines,
        resetHistory,
        commitLines,
        undo,
        redo,
        shiftTime,
        shiftTimeFromIndex,
        trackAssignments: trackAssignments.tracks,
        paragraphStarts: trackAssignments.pStarts,
        autoScrollEnabled,
        setAutoScrollEnabled,
        autoJumpEnabled,
        setAutoJumpEnabled,
        canUndo: historyState.past.length > 0,
        canRedo: historyState.future.length > 0,
        pastCount: historyState.past.length,
        futureCount: historyState.future.length,
        pastActions: historyState.past,
        futureActions: historyState.future,
        mode,
        setMode,
        syncMode,
        setSyncMode,
        exportFormat,
        setExportFormat,
        dualLineGapSec,
        setDualLineGapSec,
        activeLineIndex,
        setActiveLineIndex,
        activeWordIndex,
        setActiveWordIndex,
        hotkeys,
        setHotkeys,
        duration,
        setDuration,
        isPlaying,
        setIsPlaying,
        audioLatency,
        setAudioLatency,
        playbackRate,
        setPlaybackRate,
        touchUIMode,
        setTouchUIMode,
        audioSpecs,
        setAudioSpecs,
        playerRef,
        autoLoadLyrics,
        setAutoLoadLyrics,
        autoLoadMedia,
        setAutoLoadMedia,
        toastMessage,
        showToast,
        handleFormatWords,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
