"use client";

import { useEffect } from "react";
import { useFileActions } from "./useFileActions";

export function OpenAssociatedFileHandler() {
  const { processLyricFile } = useFileActions();

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.getInitialFile) return;

    let isCancelled = false;

    async function checkAndRun() {
      try {
        const filePath = await electronAPI.getInitialFile();
        if (!filePath || isCancelled) return;

        const text = await electronAPI.fsReadFileText(filePath);
        const parsed = await electronAPI.pathParse(filePath);
        const lrcFile = new File([text], parsed.base, { type: "text/plain" });
        Object.defineProperty(lrcFile, "path", { value: filePath });

        await processLyricFile(lrcFile);
      } catch (e) {
        console.error("Failed to open associated file:", e);
      }
    }

    checkAndRun();

    return () => {
      isCancelled = true;
    };
  }, [processLyricFile]);

  return null;
}
