"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { isTextEditable } from "@/lib/utils";
import { useCallback, useEffect } from "react";

export function useSyncHotkeys() {
  const {
    lines,
    commitLines,
    syncMode,
    activeLineIndex,
    setActiveLineIndex,
    activeWordIndex,
    setActiveWordIndex,
    playerRef,
    audioLatency,
    hotkeys,
    mode,
  } = useEditor();

  const getEffectiveTime = useCallback(() => {
    const time = playerRef.current ? playerRef.current.currentTime : 0;
    return Math.max(0, time - audioLatency / 1000);
  }, [playerRef, audioLatency]);

  const handleLineStamp = useCallback(() => {
    if (activeLineIndex >= lines.length) return;
    const timeToStamp = getEffectiveTime();

    commitLines(
      (prev) => {
        const newLines = [...prev];
        newLines[activeLineIndex] = {
          ...newLines[activeLineIndex],
          start: timeToStamp,
        };
        return newLines;
      },
      `Stamp Line ${activeLineIndex + 1}`,
    );

    setActiveLineIndex(activeLineIndex + 1);
  }, [activeLineIndex, lines.length, getEffectiveTime, commitLines, setActiveLineIndex]);

  const handleWordStamp = useCallback(() => {
    if (activeLineIndex >= lines.length) return;
    const currentLine = lines[activeLineIndex];
    if (!currentLine.words || activeWordIndex >= currentLine.words.length) {
      if (activeLineIndex < lines.length - 1) {
        setActiveLineIndex(activeLineIndex + 1);
        setActiveWordIndex(0);
      }
      return;
    }

    const wordText = currentLine.words[activeWordIndex].text || "⏎";
    const timeToStamp = getEffectiveTime();

    commitLines((prev) => {
      const newLines = [...prev];
      const newWords = [...newLines[activeLineIndex].words];
      newWords[activeWordIndex] = {
        ...newWords[activeWordIndex],
        start: timeToStamp,
      };

      newLines[activeLineIndex] = {
        ...newLines[activeLineIndex],
        words: newWords,
        // Optionally stamp the line if it's the first word
        start: activeWordIndex === 0 ? timeToStamp : newLines[activeLineIndex].start,
      };

      return newLines;
    }, `Stamp Word '${wordText}'`);

    if (activeWordIndex === currentLine.words.length - 1) {
      if (activeLineIndex < lines.length - 1) {
        setActiveLineIndex(activeLineIndex + 1);
        setActiveWordIndex(0);
      } else {
        setActiveWordIndex(activeWordIndex + 1);
      }
    } else {
      setActiveWordIndex(activeWordIndex + 1);
    }
  }, [
    activeLineIndex,
    activeWordIndex,
    lines,
    getEffectiveTime,
    commitLines,
    setActiveLineIndex,
    setActiveWordIndex,
  ]);

  const handleWordNextLine = useCallback(() => {
    if (activeLineIndex < lines.length - 1) {
      setActiveLineIndex(activeLineIndex + 1);
      setActiveWordIndex(0);
    }
  }, [activeLineIndex, lines.length, setActiveLineIndex, setActiveWordIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (isTextEditable(e.target as Element)) {
        return;
      }

      if (e.key.toLowerCase() === hotkeys.stampWord.toLowerCase()) {
        e.preventDefault();
        if (syncMode === "line") {
          handleLineStamp();
        } else {
          handleWordStamp();
        }
      } else if (e.key.toLowerCase() === hotkeys.nextLine.toLowerCase() && syncMode === "word") {
        e.preventDefault();
        handleWordNextLine();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [syncMode, hotkeys, handleLineStamp, handleWordStamp, handleWordNextLine]);

  return { handleLineStamp, handleWordStamp, handleWordNextLine };
}
