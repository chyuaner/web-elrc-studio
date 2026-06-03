export interface HistoryItem {
  id: string;
  name: string;
}

export interface AppStateType {
  audioFileName: string | null;
  lyricFileName: string | null;
  canClearMedia: boolean;
  canClearLyrics: boolean;
  canLoadEmbeddedLyrics: boolean;
}

export interface AppCommandsType {
  getState: () => AppStateType;
  getExportOptions: () => { label: string; action: string }[];
  setAudioSpecs:
    | null
    | ((specs: {
        format?: string;
        bitrate?: string;
        sampleRate?: string;
        bitsPerSample?: string;
      }) => void);
  loadMedia: null | (() => void);
  loadLyrics: null | (() => void);
  clearMedia: null | (() => Promise<void>);
  clearLyrics: null | (() => Promise<void>);
  loadEmbeddedLyrics: null | (() => Promise<void>);
  showLrcMetadata: null | (() => void);

  undo: null | (() => void);
  redo: null | (() => void);
  undoToSequence: null | ((steps: number) => void);
  redoToSequence: null | ((steps: number) => void);

  getUndoList: null | (() => HistoryItem[]);
  getRedoList: null | (() => HistoryItem[]);

  exportStandard: null | (() => void);
  exportEnhanced: null | (() => void);
  exportSimple: null | (() => void);
  exportSrt: null | (() => void);
  exportEmbeddedStandard: null | (() => void);
  exportEmbeddedEnhanced: null | (() => void);
  exportEmbeddedSimple: null | (() => void);
  exportCurrent: null | (() => void);
  shiftTime: null | (() => Promise<void>);
  setTitlebarEnabled: null | ((enabled: boolean) => void);
  toggleFullscreen: null | (() => void);
  toggleTheme: null | ((forceTheme?: "dark" | "light") => void);

  register: (handlers: Partial<Omit<AppCommandsType, "register">>) => void;
}

export const AppCommands: AppCommandsType = {
  getState: () => ({
    audioFileName: null,
    lyricFileName: null,
    canClearMedia: false,
    canClearLyrics: false,
    canLoadEmbeddedLyrics: false,
  }),
  getExportOptions: () => [],
  setAudioSpecs: null,
  loadMedia: null,
  loadLyrics: null,
  clearMedia: null,
  clearLyrics: null,
  loadEmbeddedLyrics: null,
  showLrcMetadata: null,

  undo: null,
  redo: null,
  undoToSequence: null,
  redoToSequence: null,

  getUndoList: null,
  getRedoList: null,

  exportStandard: null,
  exportEnhanced: null,
  exportSimple: null,
  exportSrt: null,
  exportEmbeddedStandard: null,
  exportEmbeddedEnhanced: null,
  exportEmbeddedSimple: null,
  exportCurrent: null,
  shiftTime: null,
  setTitlebarEnabled: null,
  toggleFullscreen: null,
  toggleTheme: null,

  register: (handlers: Partial<Omit<AppCommandsType, "register">>) => {
    for (const [key, value] of Object.entries(handlers)) {
      if (key !== "register") {
        (AppCommands as any)[key] = value;
      }
    }
  },
};

if (typeof window !== "undefined") {
  (window as any).AppCommands = AppCommands;
}
