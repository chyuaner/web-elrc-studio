"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";

type ElectronAPI = {
  shell?: { useCustomWindowControls?: boolean };
  windowMinimize?: () => void;
  windowToggleMaximize?: () => void;
  windowClose?: () => void;
  getWindowState?: () => Promise<{ isMaximized?: boolean; isFullScreen?: boolean }>;
  onWindowStateChange?: (
    cb: (state: { isMaximized?: boolean; isFullScreen?: boolean }) => void,
  ) => () => void;
};

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI ?? null;
}

export function ElectronWindowControls({ className = "" }: { className?: string }) {
  const [ready, setReady] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  const api = ready ? getElectronAPI() : null;
  const show = !!api?.shell?.useCustomWindowControls;

  useEffect(() => {
    if (!show || !api) return;

    api.getWindowState?.().then((s) => setIsMaximized(!!s?.isMaximized));
    const unsub = api.onWindowStateChange?.((s) => {
      setIsMaximized(!!s?.isMaximized);
    });
    return () => unsub?.();
  }, [show, api]);

  if (!show) return null;

  const btnClass =
    "flex items-center justify-center w-[24px] h-[24px] rounded-full border-none bg-[var(--app-winctrl-bg)] text-[var(--app-text-secondary)] hover:bg-[var(--app-winctrl-hover)] transition-colors disabled:opacity-40 disabled:pointer-events-none app-region-no-drag shrink-0";
  const closeClass = btnClass;

  return (
    <div
      className={`flex items-center gap-x-3 gap-y-2 px-2 app-region-no-drag shrink-0 ${className}`}
      data-electron-window-controls
    >
      <button
        type="button"
        className={btnClass}
        aria-label="最小化"
        title="最小化"
        onClick={() => api.windowMinimize?.()}
      >
        <ChevronDown className="w-5 h-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        className={btnClass}
        aria-label={isMaximized ? "還原" : "最大化"}
        title={isMaximized ? "還原" : "最大化"}
        onClick={() => api.windowToggleMaximize?.()}
      >
        {isMaximized ? (
          <div className="w-2.5 h-2.5 border-[1.5px] border-current rotate-45 rounded-sm"></div>
        ) : (
          <ChevronUp className="w-5 h-5" strokeWidth={1.5} />
        )}
      </button>
      <button
        type="button"
        className={closeClass}
        aria-label="關閉"
        title="關閉"
        onClick={() => api.windowClose?.()}
      >
        <X className="w-5 h-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
