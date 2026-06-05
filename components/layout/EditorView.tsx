"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { useGlobalHotkeys } from "@/components/base/useGlobalHotkeys";
import { KtvAssExport } from "@/components/panel/KtvAssExport";
import { RawTextDisplay } from "@/components/panel/RawTextDisplay";
import { SyncEditor } from "@/components/panel/SyncEditor";
import { TextEditor } from "@/components/panel/TextEditor";
import { useI18n } from "@/hooks/useI18n";
import { useEffect, useState } from "react";

export function EditorView() {
  const { mode, setMode } = useEditor();
  const i18n = useI18n();
  useGlobalHotkeys();

  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isReallyNarrow, setIsReallyNarrow] = useState(false);
  const [isTall, setIsTall] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobileLayout = window.innerWidth < 1024;
      const reallyNarrow = window.innerWidth < 768; // sm
      setIsMobileLayout(mobileLayout);
      setIsReallyNarrow(reallyNarrow);
      setIsTall(window.innerHeight > 1110);
      if (reallyNarrow && mode === "dual-sync") {
        setMode("sync");
      }
    };
    handleResize(); // trigger once
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mode, setMode]);

  return (
    <div
      className={
        isMobileLayout && !isTall
          ? "contents"
          : "flex-1 w-full h-full overflow-hidden flex flex-col"
      }
    >
      <div
        className={`flex bg-[var(--app-bg-panel)] border-b border-[var(--app-border-base)] shrink-0 z-20 ${isMobileLayout && !isTall ? "static" : ""}`}
      >
        <button
          onClick={() => setMode("text")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors focus:outline-none focus-[var(--app-accent)] focus-visible:ring-2 focus-visible:ring-inset ${mode === "text" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          {i18n.tabText}
        </button>
        <button
          onClick={() => setMode("sync")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors focus:outline-none focus-[var(--app-accent)] focus-visible:ring-2 focus-visible:ring-inset ${mode === "sync" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          {i18n.tabSync}
        </button>
        {!isReallyNarrow && (
          <button
            onClick={() => setMode("dual-sync")}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors focus:outline-none focus-[var(--app-accent)] focus-visible:ring-2 focus-visible:ring-inset ${mode === "dual-sync" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
          >
            {i18n.tabDualSync}
          </button>
        )}
        <button
          onClick={() => setMode("raw")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors focus:outline-none focus-[var(--app-accent)] focus-visible:ring-2 focus-visible:ring-inset ${mode === "raw" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          {i18n.tabRaw}
        </button>
        <button
          onClick={() => setMode("ktv-ass")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 hover:bg-[var(--app-bg-hover)] transition-colors focus:outline-none focus-[var(--app-accent)] focus-visible:ring-2 focus-visible:ring-inset ${mode === "ktv-ass" ? "border-[var(--app-accent)] text-[var(--app-accent)]" : "border-transparent text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]"}`}
        >
          KTV ASS輸出
        </button>
      </div>

      <div
        className={isMobileLayout && !isTall ? "contents" : "flex-1 overflow-hidden flex flex-col"}
      >
        {mode === "text" && <TextEditor />}
        {(mode === "sync" || mode === "dual-sync") && <SyncEditor />}
        {mode === "raw" && <RawTextDisplay />}
        <div
          className={mode === "ktv-ass" ? "flex-1 overflow-hidden flex flex-col h-full" : "hidden"}
        >
          <KtvAssExport />
        </div>
      </div>
    </div>
  );
}
