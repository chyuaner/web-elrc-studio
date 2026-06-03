import { useEditor } from "@/components/base/EditorProvider";
import { useEffect, useRef } from "react";

export function useAutoScroll() {
  const {
    lines,
    isPlaying,
    autoScrollEnabled,
    activeLineIndex,
    activeWordIndex,
    setActiveLineIndex,
    setActiveWordIndex,
    playerRef,
  } = useEditor();

  const stateRef = useRef({ activeLineIndex, activeWordIndex });
  useEffect(() => {
    stateRef.current = { activeLineIndex, activeWordIndex };
  }, [activeLineIndex, activeWordIndex]);

  useEffect(() => {
    if (!autoScrollEnabled || !isPlaying) return;

    let rafId: number;
    const updateScroll = () => {
      const currentTime = playerRef.current ? playerRef.current.currentTime : 0;
      let foundIndex = -1;

      // Binary search for performance instead of full reverse loop
      let left = 0;
      let right = lines.length - 1;
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const start = lines[mid].start;
        if (start === null) {
          // Fallback for lines without timestamps: find closest previous stamped line
          let prevStamped = -1;
          for (let k = mid - 1; k >= 0; k--) {
            if (lines[k].start !== null) {
              prevStamped = k;
              break;
            }
          }
          if (prevStamped !== -1 && lines[prevStamped].start! <= currentTime) {
            left = mid + 1;
            foundIndex = prevStamped;
          } else {
            right = mid - 1;
          }
        } else if (start <= currentTime) {
          foundIndex = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      // We still need to handle unstamped lines interspersed with stamped lines.
      // So if foundIndex is stamped, check if there are unstamped lines after it
      // that we should conceptually be "on" based on activeLineIndex progression?
      // Actually, standard behavior is to highlight the last stamped line.
      // So foundIndex is correct.

      const { activeLineIndex, activeWordIndex } = stateRef.current;

      if (foundIndex !== -1 && foundIndex !== activeLineIndex) {
        setActiveLineIndex(foundIndex);

        let foundWIndex = 0;
        const line = lines[foundIndex];
        if (line && line.words) {
          for (let w = line.words.length - 1; w >= 0; w--) {
            const wStart = line.words[w].start;
            if (wStart !== null && wStart <= currentTime) {
              foundWIndex = w;
              break;
            }
          }
        }
        if (foundWIndex !== activeWordIndex) {
          setActiveWordIndex(foundWIndex);
        }
      } else if (foundIndex === activeLineIndex && foundIndex !== -1) {
        let foundWIndex = 0;
        const line = lines[foundIndex];
        if (line && line.words) {
          for (let w = line.words.length - 1; w >= 0; w--) {
            const wStart = line.words[w].start;
            if (wStart !== null && wStart <= currentTime) {
              foundWIndex = w;
              break;
            }
          }
        }
        if (foundWIndex !== activeWordIndex) {
          setActiveWordIndex(foundWIndex);
        }
      }

      rafId = requestAnimationFrame(updateScroll);
    };

    rafId = requestAnimationFrame(updateScroll);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, autoScrollEnabled, lines, playerRef, setActiveLineIndex, setActiveWordIndex]);
}
