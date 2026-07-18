"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { useSyncHotkeys } from "@/components/base/useSyncHotkeys";
import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { createEffectiveLines } from "@/lib/compute-styles";

export function KaraokePreview({ hideTouchUI = false }: { hideTouchUI?: boolean }) {
  const {
    lines: rawLines,
    activeLineIndex,
    activeWordIndex,
    trackAssignments,
    paragraphStarts,
    dualLineGapSec,
    syncMode,
    autoScrollEnabled,
    playerRef,
    isPlaying,
    touchUIMode,
  } = useEditor();
  const lines = React.useMemo(() => createEffectiveLines(rawLines), [rawLines]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const { handleLineStamp, handleWordStamp, handleWordNextLine } = useSyncHotkeys();

  const [isTall, setIsTall] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsTall(window.innerHeight > 1110);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let rafId: number;
    let lastTime = 0;
    const updateTime = (timestamp: number) => {
      if (timestamp - lastTime > 33) {
        // ~30fps throttle
        if (playerRef.current) {
          setCurrentTime(playerRef.current.currentTime);
        }
        lastTime = timestamp;
      }
      rafId = requestAnimationFrame(updateTime);
    };
    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [playerRef]);

  const getLineEndTime = React.useCallback((lineIdx: number) => {
    const line = lines[lineIdx];
    if (!line) return 0;

    const isNextParaStart = paragraphStarts[lineIdx + 1];
    const nextLine = lines[lineIdx + 1];
    const nextLineStart = nextLine?.start;

    if (isNextParaStart && nextLineStart !== null) {
      if (line.words && line.words.length > 0) {
        const lastWord = line.words[line.words.length - 1];
        if (lastWord?.end === nextLineStart || line.end === nextLineStart) {
          let baseStart = line.start ?? 0;
          for (let w = line.words.length - 1; w >= 0; w--) {
            if (line.words[w].start !== null) {
              baseStart = line.words[w].start!;
              break;
            }
          }
          const estEnd = baseStart + 1.5;
          return Math.min(estEnd, nextLineStart);
        }
        return lastWord?.end ?? lastWord?.start ?? line.start ?? 0;
      }
      return Math.min((line.start ?? 0) + 3.0, nextLineStart);
    }

    if (line.end !== null) return line.end;

    if (line.words && line.words.length > 0) {
      const lastWord = line.words[line.words.length - 1];
      return lastWord?.end ?? lastWord?.start ?? line.start ?? 0;
    }
    return line.start ?? 0;
  }, [lines, paragraphStarts]);

  const overlappingPairs = React.useMemo(() => {
    const pairs: Array<{ top: number; bottom: number; start: number; end: number }> = [];
    const processed = new Set<number>();

    for (let i = 0; i < lines.length - 1; i++) {
      if (processed.has(i)) continue;
      const start_i = lines[i].start;
      if (start_i === null) continue;
      const end_i = getLineEndTime(i);

      for (let j = i + 1; j < lines.length; j++) {
        const start_j = lines[j].start;
        if (start_j === null) continue;

        // If the next line starts after or at the end of the current line, we stop searching
        if (start_j >= end_i) break;

        // Overlap detected!
        const end_j = getLineEndTime(j);
        pairs.push({
          top: i,
          bottom: j,
          start: Math.min(start_i, start_j),
          end: Math.max(end_i, end_j),
        });
        processed.add(i);
        processed.add(j);
        break; // Only pair i with its direct overlapping partner
      }
    }
    return pairs;
  }, [lines, getLineEndTime]);

  let topIndex = -1;
  let bottomIndex = -1;
  let previewLineIndex = activeLineIndex;

  const firstStampedIndex = React.useMemo(() => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].start !== null) {
        return i;
      }
    }
    return -1;
  }, [lines]);

  const activePair = React.useMemo(() => {
    return overlappingPairs.find(
      (p) => currentTime >= p.start && currentTime < p.end
    );
  }, [overlappingPairs, currentTime]);

  if (activePair) {
    topIndex = activePair.top;
    bottomIndex = activePair.bottom;
  } else {
    if (lines.length > 0) {
      if (firstStampedIndex !== -1 && currentTime <= lines[firstStampedIndex].start!) {
        previewLineIndex = firstStampedIndex;
      } else if (activeLineIndex + 1 < lines.length) {
        const nextLine = lines[activeLineIndex + 1];
        const currentLineEndTime = getLineEndTime(activeLineIndex);
        if (
          paragraphStarts[activeLineIndex + 1] &&
          nextLine.start !== null &&
          currentTime >= currentLineEndTime
        ) {
          const gap = nextLine.start - currentTime;
          if (gap > 0 && gap <= dualLineGapSec) {
            previewLineIndex = activeLineIndex + 1;
          }
        }
      }
    }

    if (lines.length > 0) {
      let paraStart = previewLineIndex;
      while (paraStart > 0 && !paragraphStarts[paraStart]) paraStart--;

      let paraEnd = previewLineIndex + 1;
      while (paraEnd < lines.length && !paragraphStarts[paraEnd]) paraEnd++;

      const activeTrack = trackAssignments[previewLineIndex] || 0;

      if (activeTrack === 0) {
        const pairIndex = previewLineIndex + 1;
        if (pairIndex < paraEnd) {
          topIndex = previewLineIndex;
          bottomIndex = pairIndex;
        } else {
          topIndex = -1;
          bottomIndex = previewLineIndex;
        }
      } else {
        bottomIndex = previewLineIndex;
        const nextTop = previewLineIndex + 1;

        if (nextTop < paraEnd) {
          const nextTopIsAlone = nextTop + 1 >= paraEnd;
          if (nextTopIsAlone) {
            topIndex = previewLineIndex - 1;
          } else {
            topIndex = nextTop;
          }
        } else {
          topIndex = previewLineIndex - 1;
        }
      }
    }

    if (lines.length > 0 && lines[previewLineIndex]?.isSingleLine) {
      topIndex = -1;
      bottomIndex = previewLineIndex;
    }
  }

  const isTopOnly = topIndex !== -1 && bottomIndex === -1;
  const isBottomOnly = bottomIndex !== -1 && topIndex === -1;

  const isTopCentered = !!(lines[topIndex]?.isCenter || isTopOnly);
  const isBottomCentered = !!(lines[bottomIndex]?.isCenter || isBottomOnly);

  let countdownAlign = "left";
  if (lines.length > 0 && previewLineIndex >= 0 && previewLineIndex < lines.length) {
    let pStartIdx = previewLineIndex;
    while (pStartIdx > 0 && !paragraphStarts[pStartIdx]) {
      pStartIdx--;
    }
    let pEndIdx = pStartIdx + 1;
    while (pEndIdx < lines.length && !paragraphStarts[pEndIdx]) {
      pEndIdx++;
    }
    const pCount = pEndIdx - pStartIdx;
    if (pCount === 1) {
      countdownAlign = "center";
    } else {
      countdownAlign = lines[pStartIdx]?.isCenter ? "center" : "left";
    }
  }

  const topIsActive = topIndex === previewLineIndex || (
    topIndex !== -1 &&
    lines[topIndex]?.start !== null &&
    currentTime >= lines[topIndex].start! &&
    currentTime < getLineEndTime(topIndex)
  );

  const bottomIsActive = bottomIndex === previewLineIndex || (
    bottomIndex !== -1 &&
    lines[bottomIndex]?.start !== null &&
    currentTime >= lines[bottomIndex].start! &&
    currentTime < getLineEndTime(bottomIndex)
  );

  const [touchBtnWidth, setTouchBtnWidth] = useState(140);
  const dragRef = useRef(false);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      // We are dragging the left edge of the right panel, so window.innerWidth - clientX is the width.
      // But actually, we shouldn't rely on window.innerWidth strictly because of the left panel width.
      // Easiest is to measure delta from previous, or just e.clientX.
      // Right panel width = window.innerWidth - e.clientX
      // Let's constrain it between 80px and 70% of the screen width
      e.preventDefault();
      const newWidth = document.body.clientWidth - e.clientX - 16; // minus padding
      setTouchBtnWidth(Math.max(80, Math.min(document.body.clientWidth * 0.7, newWidth)));
    };

    const onPointerUp = () => {
      if (dragRef.current) {
        dragRef.current = false;
        document.body.style.cursor = "default";
        document.body.classList.remove("is-dragging-resizer");
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const isHexColor = (style?: string): boolean => {
    if (!style) return false;
    return /^#[0-9A-Fa-f]{6}$/.test(style);
  };

  const getStyleClasses = (style?: string) => {
    switch (style?.toUpperCase()) {
      case "B":
        return {
          past: "text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]",
          current: "text-blue-100 border-blue-500",
          future: "text-blue-500/40",
          wordBg: "bg-blue-500/20",
        };
      case "R":
        return {
          past: "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]",
          current: "text-red-100 border-red-500",
          future: "text-red-500/40",
          wordBg: "bg-red-500/20",
        };
      case "P":
        return {
          past: "text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]",
          current: "text-purple-100 border-purple-500",
          future: "text-purple-500/40",
          wordBg: "bg-purple-500/20",
        };
      case "G":
        return {
          past: "text-green-500 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]",
          current: "text-green-100 border-green-500",
          future: "text-green-500/40",
          wordBg: "bg-green-500/20",
        };
      case "T":
        return {
          past: "text-gray-500 drop-shadow-[0_0_8px_rgba(107,114,128,0.8)]",
          current: "text-gray-100 border-gray-500",
          future: "text-gray-500/40",
          wordBg: "bg-gray-500/20",
        };
      case "O":
        return {
          past: "text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]",
          current: "text-orange-100 border-orange-500",
          future: "text-orange-500/40",
          wordBg: "bg-orange-500/20",
        };
      default:
        return {
          past: "text-[var(--app-accent)] drop-shadow-[0_0_8px_rgba(242,125,38,0.8)]",
          current: "text-[var(--app-text-primary)] border-[var(--app-accent)]",
          future: "text-[var(--app-text-muted)]",
          wordBg: "bg-[var(--app-accent)]/20",
        };
    }
  };

  const getWordStyleAndClass = (lineIdx: number, wordIdx: number): { className: string; style?: React.CSSProperties } => {
    const line = lines[lineIdx];
    if (!line) return { className: "" };
    const word = line.words[wordIdx];
    const effectiveStyle = word?.style || line.style;
    const theme = getStyleClasses(effectiveStyle);
    const isHex = isHexColor(effectiveStyle);

    let status: "past" | "current" | "future" = "future";

    // Check if we are currently displaying an overlapping duet pair
    const inActivePair = !!activePair;

    if (inActivePair) {
      if (line.start === null) {
        status = "future";
      } else {
        const endTime = getLineEndTime(lineIdx);

        if (currentTime < line.start) {
          status = "future";
        } else if (currentTime >= endTime) {
          status = "past";
        } else {
          const isLineSynced = line.words.every((w: any) => w.start === null);
          if (syncMode === "line" || isLineSynced) {
            status = "current";
          } else {
            const word = line.words[wordIdx];
            if (word && word.start !== null && word.end !== null) {
              if (currentTime < word.start) {
                status = "future";
              } else if (currentTime >= word.start && currentTime < word.end) {
                status = "current";
              } else {
                status = "past";
              }
            } else {
              let foundWIndex = 0;
              for (let w = line.words.length - 1; w >= 0; w--) {
                const wStart = line.words[w].start;
                if (wStart !== null && wStart <= currentTime) {
                  foundWIndex = w;
                  break;
                }
              }

              if (wordIdx < foundWIndex) {
                status = "past";
              } else if (wordIdx === foundWIndex) {
                status = "current";
              } else {
                status = "future";
              }
            }
          }
        }
      }
    } else {
      // Fallback to original index-based highlighting when no duet overlap is active (perfect for standard stamping/editing)
      if (lineIdx < activeLineIndex) {
        status = "past";
      } else if (lineIdx === activeLineIndex) {
        const isLineSynced = lines[lineIdx].words.every((w: any) => w.start === null);
        if (syncMode === "line" || isLineSynced) {
          status = "current";
        } else if (wordIdx < activeWordIndex) {
          status = "past";
        } else if (wordIdx === activeWordIndex) {
          status = "current";
        } else {
          status = "future";
        }
      } else {
        status = "future";
      }
    }

    let baseClass = "";
    const inlineStyle: React.CSSProperties = {};

    if (status === "past") {
      baseClass = `border-b-4 border-transparent pb-1 transition-all`;
      if (isHex) {
        inlineStyle.color = effectiveStyle;
        inlineStyle.filter = `drop-shadow(0 0 8px ${effectiveStyle}CC)`;
      } else {
        baseClass += ` ${theme.past}`;
      }
    } else if (status === "current") {
      baseClass = `border-b-4 pb-1 transition-all relative transform scale-105 origin-bottom z-10`;
      if (isHex) {
        inlineStyle.color = "var(--app-text-primary)";
        inlineStyle.borderColor = effectiveStyle;
      } else {
        baseClass += ` ${theme.current}`;
      }
    } else {
      baseClass = `border-b-4 border-transparent pb-1 transition-colors`;
      if (isHex) {
        inlineStyle.color = `${effectiveStyle}66`; // ~40% opacity
      } else {
        baseClass += ` ${theme.future}`;
      }
    }

    return { className: baseClass, style: inlineStyle };
  };

  const getFilteredWords = (words: any[]) => {
    if (!words) return [];
    return words
      .map((w, originalIdx) => ({ w, originalIdx }))
      .filter(({ w, originalIdx }) => {
        if (!w.text) return false;
        if (w.text.trim() === "") {
          const isTrailing = words.slice(originalIdx).every(subW => !subW.text || subW.text.trim() === "");
          return !isTrailing;
        }
        return true;
      });
  };

  let dotsCount = 0;

  if (
    autoScrollEnabled &&
    lines.length > 0 &&
    lines[previewLineIndex]?.start !== null &&
    paragraphStarts[previewLineIndex]
  ) {
    let prevEnd = 0;
    if (previewLineIndex > 0) {
      prevEnd = getLineEndTime(previewLineIndex - 1);
    }

    const realGap = lines[previewLineIndex].start! - prevEnd;
    const isRealInterlude =
      previewLineIndex === 0
        ? lines[previewLineIndex].start! >= dualLineGapSec
        : realGap >= dualLineGapSec;

    if (isRealInterlude && currentTime >= prevEnd) {
      const start = lines[previewLineIndex].start!;
      const timeLeft = start - currentTime;
      if (timeLeft > 0) {
        dotsCount = Math.max(0, Math.min(4, Math.ceil(timeLeft - 1)));
      }
    }
  }

  const DotNode = (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      className="drop-shadow-sm overflow-visible inline-block align-text-bottom mx-1"
    >
      <circle
        cx="12"
        cy="12"
        r="15"
        fill="white"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: "var(--app-border-light)" }}
      />
    </svg>
  );

  return (
    <div
      className={`flex flex-col border-t border-b border-[var(--app-border-base)] bg-[var(--app-bg-panel-alt)] shrink-0 ${isTall ? "static shadow-none" : "sticky lg:static shadow-sm lg:shadow-none"} z-[35]`}
      style={{ top: isTall ? undefined : "calc(var(--media-controls-height, 0px))" }}
    >
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex justify-center items-center px-4 py-2 relative cursor-pointer select-none hover:bg-[var(--app-bg-hover)] transition-colors"
      >
        <span className="text-[10px] text-[var(--app-text-muted)] uppercase font-bold tracking-widest text-center">
          Karaoke Preview
        </span>
        <div className="absolute right-4 text-[var(--app-text-muted)] p-1">
          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex px-4 pb-4 gap-4 relative">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div
              className={`px-4 py-3 relative min-h-[4.5rem] flex items-center w-full ${isTopCentered ? "justify-center" : "justify-start"} ${topIsActive ? "" : "opacity-70"}`}
            >
              <div className="relative w-full">
                {lines[topIndex] ? (
                  <>
                    {topIsActive && dotsCount > 0 && (
                      <span
                        className={`absolute bottom-full mb-3 flex gap-2 ${countdownAlign === "center" ? "left-1/2 -translate-x-1/2" : "left-0"}`}
                      >
                        {[...Array(dotsCount)].map((_, i) => (
                          <React.Fragment key={i}>{DotNode}</React.Fragment>
                        ))}
                      </span>
                    )}
                    <div className="overflow-hidden w-full">
                      <p
                        className={`text-xl md:text-2xl font-bold tracking-wide flex gap-1 flex-nowrap whitespace-nowrap ${isTopCentered ? "justify-center text-center" : "justify-start text-left"}`}
                      >
                        {(() => {
                          const filtered = getFilteredWords(lines[topIndex].words);
                          if (filtered.length === 0) {
                            return <span className="opacity-40">⏎</span>;
                          }
                          return filtered.map(({ w, originalIdx }) => {
                            const { className, style } = getWordStyleAndClass(topIndex, originalIdx);
                            return (
                              <span key={originalIdx} className={className} style={style}>
                                {w.text}
                              </span>
                            );
                          });
                        })()}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {topIsActive && dotsCount > 0 && (
                      <span
                        className={`absolute bottom-full mb-3 flex gap-2 ${countdownAlign === "center" ? "left-1/2 -translate-x-1/2" : "left-0"}`}
                      >
                        {[...Array(dotsCount)].map((_, i) => (
                          <React.Fragment key={i}>{DotNode}</React.Fragment>
                        ))}
                      </span>
                    )}
                    <div className="overflow-hidden w-full">
                      <p className="text-xl md:text-2xl font-bold w-full h-full flex items-center justify-start flex-nowrap whitespace-nowrap">
                        &nbsp;
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className={`px-4 py-3 relative min-h-[4.5rem] flex items-center w-full ${isBottomCentered ? "justify-center" : "justify-end"} ${bottomIsActive ? "" : "opacity-70"}`}
            >
              <div className="relative w-full">
                {lines[bottomIndex] ? (
                  <>
                    {bottomIsActive && dotsCount > 0 && (
                      <span
                        className={`absolute bottom-full mb-3 flex gap-2 ${countdownAlign === "center" ? "left-1/2 -translate-x-1/2" : "right-0"}`}
                      >
                        {[...Array(dotsCount)].map((_, i) => (
                          <React.Fragment key={i}>{DotNode}</React.Fragment>
                        ))}
                      </span>
                    )}
                    <div className="overflow-hidden w-full">
                      <p
                        className={`text-xl md:text-2xl font-bold tracking-wide flex gap-1 flex-nowrap whitespace-nowrap ${isBottomCentered ? "justify-center text-center" : "justify-end text-right"}`}
                      >
                        {(() => {
                          const filtered = getFilteredWords(lines[bottomIndex].words);
                          if (filtered.length === 0) {
                            return <span className="opacity-40">⏎</span>;
                          }
                          return filtered.map(({ w, originalIdx }) => {
                            const { className, style } = getWordStyleAndClass(bottomIndex, originalIdx);
                            return (
                              <span key={originalIdx} className={className} style={style}>
                                {w.text}
                              </span>
                            );
                          });
                        })()}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {bottomIsActive && dotsCount > 0 && (
                      <span
                        className={`absolute bottom-full mb-3 flex gap-2 ${countdownAlign === "center" ? "left-1/2 -translate-x-1/2" : "right-0"}`}
                      >
                        {[...Array(dotsCount)].map((_, i) => (
                          <React.Fragment key={i}>{DotNode}</React.Fragment>
                        ))}
                      </span>
                    )}
                    <div className="overflow-hidden w-full">
                      <p
                        className={`text-xl md:text-2xl font-bold w-full h-full flex items-center flex-nowrap whitespace-nowrap ${isBottomCentered ? "justify-center" : "justify-end"}`}
                      >
                        &nbsp;
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {touchUIMode && !hideTouchUI && (
            <>
              <div
                className="w-4 -ml-2 -mr-2 cursor-col-resize flex justify-center items-center hover:bg-[var(--app-border-light)] hover:opacity-50 transition-colors z-10 touch-none"
                onPointerDown={(e) => {
                  dragRef.current = true;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  document.body.style.cursor = "col-resize";
                  document.body.classList.add("is-dragging-resizer");
                }}
              >
                <div className="w-1 h-8 rounded-full bg-[var(--app-text-muted)] opacity-30"></div>
              </div>
              <div style={{ width: touchBtnWidth }} className="shrink-0 flex flex-col gap-2">
                <button
                  autoFocus={false}
                  onClick={(e) => {
                    e.preventDefault();
                    e.currentTarget.blur();
                    syncMode === "line" ? handleLineStamp() : handleWordStamp();
                  }}
                  className="flex-1 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] active:bg-[var(--app-accent-hover)] text-black rounded-lg shadow font-extrabold text-xl md:text-3xl select-none transition-all flex items-center justify-center -outline-offset-2 touch-manipulation focus:outline-none"
                >
                  打點
                </button>
                {syncMode === "word" && (
                  <button
                    autoFocus={false}
                    onClick={(e) => {
                      e.preventDefault();
                      e.currentTarget.blur();
                      handleWordNextLine();
                    }}
                    className="h-[3rem] bg-[var(--app-bg-panel)] hover:bg-[var(--app-bg-hover)] active:bg-[var(--app-border-base)] text-[var(--app-text-primary)] rounded-lg shadow font-extrabold text-lg md:text-xl border border-[var(--app-border-base)] select-none transition-all flex items-center justify-center -outline-offset-2 touch-manipulation focus:outline-none"
                  >
                    換行
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
