"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { LineNumberedTextarea } from "@/components/common/LineNumberedTextarea";
import { useDialogs } from "@/components/dialog/DialogProvider";
import { useI18n } from "@/hooks/useI18n";
import { exportLrc, parseRawLyrics } from "@/lib/lyric-utils";
import { ChevronDown, ChevronUp, Replace, ReplaceAll, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export function TextEditor() {
  const {
    lines,
    setLines,
    commitLines,
    exportFormat,
    setActiveLineIndex,
    setActiveWordIndex,
    lrcMetadata,
    setLrcMetadata,
    activeLineIndex,
  } = useEditor();
  const [text, setText] = useState("");
  const isDirty = useRef(false);
  const i18n = useI18n();
  const dialogs = useDialogs();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search & Replace state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [ignoreTimeTags, setIgnoreTimeTags] = useState(true);
  const [selectWholeLine, setSelectWholeLine] = useState(false);
  const textRef = useRef("");

  const matches = useMemo(() => {
    if (!searchText) return [];

    let sourceText = text;
    let mapping: number[] | null = null;

    if (ignoreTimeTags) {
      mapping = [];
      sourceText = "";
      const tagRegex = /(?:\[\d{2}:\d{2}(?:\.\d{2,3})?\])|(?:<\d{2}:\d{2}(?:\.\d{2,3})?>)/g;
      let lastIndex = 0;
      let match;
      while ((match = tagRegex.exec(text)) !== null) {
        for (let i = lastIndex; i < match.index; i++) {
          sourceText += text[i];
          mapping.push(i);
        }
        lastIndex = tagRegex.lastIndex;
      }
      for (let i = lastIndex; i < text.length; i++) {
        sourceText += text[i];
        mapping.push(i);
      }
      mapping.push(text.length);
    }

    const lowerSource = sourceText.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    const newMatches: { start: number; end: number }[] = [];
    let startIndex = 0;
    while (true) {
      const index = lowerSource.indexOf(lowerSearch, startIndex);
      if (index === -1) break;

      const matchEnd = index + searchText.length;
      let finalStart = ignoreTimeTags && mapping ? mapping[index] : index;
      let finalEnd = ignoreTimeTags && mapping ? mapping[matchEnd] : matchEnd;

      if (ignoreTimeTags && !selectWholeLine) {
        let hasContentOnRight = false;
        let tempEnd = finalEnd;
        while (tempEnd < text.length && text[tempEnd] !== "\n" && text[tempEnd] !== "\r") {
          if (text[tempEnd] !== " " && text[tempEnd] !== "\t") {
            hasContentOnRight = true;
            break;
          }
          tempEnd++;
        }

        while (finalStart > 0) {
          const charBefore = text[finalStart - 1];
          if (charBefore === ">" || charBefore === "]") {
            const openChar = charBefore === ">" ? "<" : "[";
            let tagStart = finalStart - 1;
            while (tagStart >= 0 && text[tagStart] !== openChar) {
              tagStart--;
            }
            if (tagStart >= 0) {
              const tagText = text.substring(tagStart, finalStart);
              if (/^[<\[]\d{2}:\d{2}(?:\.\d{2,3})?[>\]]$/.test(tagText)) {
                if (openChar === "[" && hasContentOnRight) {
                  break;
                }
                finalStart = tagStart;
                continue;
              }
            }
          }
          break;
        }
      }

      if (selectWholeLine) {
        while (finalStart > 0 && text[finalStart - 1] !== "\n") {
          finalStart--;
        }
        while (finalEnd < text.length && text[finalEnd] !== "\n") {
          finalEnd++;
        }
        if (finalEnd < text.length && text[finalEnd] === "\n") {
          finalEnd++;
        }
      }

      newMatches.push({ start: finalStart, end: finalEnd });
      startIndex = index + searchText.length;
    }

    const mergedMatches: { start: number; end: number }[] = [];
    for (const match of newMatches) {
      if (mergedMatches.length === 0) {
        mergedMatches.push(match);
      } else {
        const lastMatch = mergedMatches[mergedMatches.length - 1];
        if (match.start <= lastMatch.end) {
          lastMatch.end = Math.max(lastMatch.end, match.end);
        } else {
          mergedMatches.push(match);
        }
      }
    }
    return mergedMatches;
  }, [text, searchText, ignoreTimeTags, selectWholeLine]);

  useEffect(() => {
    if (matches.length > 0) {
      if (currentMatchIndex >= matches.length) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentMatchIndex(matches.length - 1);
      }
    } else {
      setCurrentMatchIndex(0);
    }
  }, [matches.length, currentMatchIndex]);

  const scrollToMatch = (index: number) => {
    if (!textareaRef.current) return;
    const match = matches[index];
    if (!match) return;
    const textarea = textareaRef.current;

    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);

    // approximate scroll
    const textUpToMatch = text.substring(0, match.start);
    const targetRow = textUpToMatch.split("\n").length - 1;

    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight || "24") || 24;
    textarea.scrollTop = Math.max(0, targetRow * lineHeight - textarea.clientHeight / 2);
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    scrollToMatch(nextIndex);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIndex);
    scrollToMatch(prevIndex);
  };

  const handleReplace = () => {
    if (matches.length === 0) return;
    const match = matches[currentMatchIndex];
    if (!match) return;

    const newText = text.substring(0, match.start) + replaceText + text.substring(match.end);
    setText(newText);
    textRef.current = newText;
    isDirty.current = true;
    saveChanges(newText);

    // It will auto-recalculate matches.
  };

  const handleReplaceAll = () => {
    if (matches.length === 0) return;
    // Replace from end to start to avoid index shifting
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i];
      newText = newText.substring(0, match.start) + replaceText + newText.substring(match.end);
    }
    setText(newText);
    textRef.current = newText;
    isDirty.current = true;
    saveChanges(newText);
  };

  useEffect(() => {
    // Sync from lines to text if not dirty OR if the textarea does not have focus
    const isFocused =
      typeof document !== "undefined" && document.activeElement === textareaRef.current;
    if (!isDirty.current || !isFocused) {
      let newText = exportLrc(lines, lrcMetadata, true, false); // force ELRC

      if (text !== newText) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(newText || "");
        textRef.current = newText || "";
        isDirty.current = false; // Reset dirty state since we cleanly synchronized
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, exportFormat, lrcMetadata]);

  useEffect(() => {
    const handler = (e: any) => {
      const lineIndex = e.detail?.lineIndex;
      if (lineIndex !== undefined && textareaRef.current) {
        // Strip tags in the exactly same way as parseRawLyrics, but preserving \n
        let cleanTextForIndex = text.replace(
          /\[([^:：\]]+)[:：]((?:\\.|[^\]])*)\]/g,
          (match, rawKey) => {
            let trimmedKey = rawKey.trim();
            if (/^\d+$/.test(trimmedKey)) return match;
            if (trimmedKey.toLowerCase() === "ktv" || trimmedKey.toLowerCase() === "ktvsp")
              return match;
            // Return only newlines to keep line count synced
            return match.replace(/[^\n]/g, "");
          },
        );

        const splitLines = cleanTextForIndex.split("\n");
        const originalLines = text.split("\n");

        let currentLineIndex = -1;
        let targetRow = -1;

        for (let i = 0; i < splitLines.length; i++) {
          const lineText = splitLines[i];
          if (!lineText.trim()) continue;

          if (/^\[ktv\s*:\s*singleline\]$/i.test(lineText.trim())) continue;
          if (/^\[ktvsp\s*:\s*(\d+:\d+(?:\.\d+)?)\]$/i.exec(lineText.trim())) continue;

          currentLineIndex++;
          if (currentLineIndex === lineIndex) {
            targetRow = i;
            break;
          }
        }

        if (targetRow === -1) return;

        let pos = 0;
        for (let i = 0; i < targetRow; i++) {
          pos += originalLines[i].length + 1;
        }

        const textarea = textareaRef.current;
        textarea.focus();
        textarea.setSelectionRange(pos, pos + (originalLines[targetRow]?.length || 0));

        // Hack to scroll into view
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight || "24") || 24;
        textarea.scrollTop = Math.max(0, targetRow * lineHeight - textarea.clientHeight / 2);
      }
    };
    window.addEventListener("focus-raw-text-line", handler);
    return () => window.removeEventListener("focus-raw-text-line", handler);
  }, [text, lrcMetadata]);

  useEffect(() => {
    const searchHandler = (e: any) => {
      const selectedHtmlText = e.detail?.text || "";
      const shouldIgnoreTags = e.detail?.ignoreTimeTags;

      let searchTextToUse = selectedHtmlText;
      // also check if textarea has selection, if it was directly selected
      if (!searchTextToUse && textareaRef.current) {
        const t = textareaRef.current;
        if (t.selectionStart !== t.selectionEnd) {
          searchTextToUse = t.value.substring(t.selectionStart, t.selectionEnd);
        }
      }

      if (shouldIgnoreTags) {
        searchTextToUse = searchTextToUse.replace(
          /(?:\[\d{2}:\d{2}(?:\.\d{2,3})?\])|(?:<\d{2}:\d{2}(?:\.\d{2,3})?>)/g,
          "",
        );
      }

      if (searchTextToUse) {
        setSearchText(searchTextToUse);
      }
      setIsSearchOpen(true);
      setTimeout(() => {
        document.getElementById("search-input")?.focus();
      }, 50);
    };
    window.addEventListener("context-menu-search", searchHandler);
    return () => window.removeEventListener("context-menu-search", searchHandler);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    textRef.current = e.target.value; // Sync ref immediately
    isDirty.current = true;
  };

  const saveChanges = (forceText?: string) => {
    if (!isDirty.current && forceText === undefined) return;

    const textToParse = forceText !== undefined ? forceText : textRef.current;
    const parsed = parseRawLyrics(textToParse);
    let resultLines = parsed.lines;
    commitLines(resultLines, "Edit Raw Lyrics", parsed.metadata);

    // Auto-detect if all timestamps are cleared, if so, reset the active index to 0
    const hasAnyTimestamps = resultLines.some(
      (l) => l.start !== null || l.words.some((w) => w.start !== null),
    );
    if (!hasAnyTimestamps) {
      setActiveLineIndex(0);
      setActiveWordIndex(0);
    }

    isDirty.current = false;
  };

  const handleTextBlur = () => {
    saveChanges();
  };

  const saveChangesRef = useRef(saveChanges);

  useEffect(() => {
    saveChangesRef.current = saveChanges;
  }, [saveChanges]);

  useEffect(() => {
    return () => {
      // Auto-save on unmount if dirty
      if (isDirty.current) {
        saveChangesRef.current(textRef.current);
      }
    };
  }, []);

  const [isResponsiveTall, setIsResponsiveTall] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsResponsiveTall(window.innerWidth >= 1024 || window.innerHeight > 1110);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`flex flex-col flex-1 ${isResponsiveTall ? "min-h-0 h-full" : "min-h-[50vh]"} bg-[var(--app-bg-panel-alt)]`}
    >
      <div className="p-2 bg-[var(--app-bg-panel)] border-b border-[var(--app-border-base)] flex flex-wrap gap-2 items-center justify-between shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 bg-[var(--app-border-base)] rounded text-[10px] font-bold uppercase tracking-widest border border-[var(--app-border-light)] text-[var(--app-text-secondary)]">
            WITH TIMESTAMPS (ELRC)
          </span>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`px-3 py-1 flex items-center text-[10px] font-bold uppercase tracking-widest rounded border transition-colors ${
              isSearchOpen
                ? "border-[var(--app-accent)]/50 text-[var(--app-accent)] bg-[var(--app-accent)]/10"
                : "border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)]"
            }`}
            title="Search & Replace (Ctrl+F)"
          >
            <Search className="w-3 h-3 mr-1" />
            搜尋 / 取代
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isDirty.current) saveChanges();
            }}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300"
          >
            套用變更
          </button>

          <div className="w-px bg-[var(--app-border-light)] opacity-50 my-1 mx-1"></div>

          <button
            onClick={async () => {
              const { convertToTraditional } = await import("@/lib/chinese-conv");
              setText((t) => {
                const next = convertToTraditional(t);
                isDirty.current = true;
                setTimeout(() => saveChanges(next), 0);
                return next;
              });
            }}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] transition-colors"
          >
            轉成繁體
          </button>
          <button
            onClick={async () => {
              const { convertToSimplified } = await import("@/lib/chinese-conv");
              setText((t) => {
                const next = convertToSimplified(t);
                isDirty.current = true;
                setTimeout(() => saveChanges(next), 0);
                return next;
              });
            }}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] transition-colors"
          >
            轉成簡體
          </button>

          <div className="w-px bg-[var(--app-border-light)] opacity-50 my-1 mx-1"></div>

          <button
            onClick={() => {
              setText((t) => {
                const parsed = parseRawLyrics(t);
                const next = exportLrc(parsed.lines, parsed.metadata, false, false);
                isDirty.current = true;
                setTimeout(() => saveChanges(next), 0);
                return next;
              });
            }}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] transition-colors"
          >
            轉成 標準LRC (逐行同步)
          </button>
          <button
            onClick={() => {
              setText((t) => {
                const parsed = parseRawLyrics(t);
                let metaStr = "";
                for (const [key, value] of Object.entries(parsed.metadata)) {
                  if (value) metaStr += `[${key}:${value}]\n`;
                }
                const next =
                  metaStr + parsed.lines.map((l) => l.words.map((w) => w.text).join("")).join("\n");
                isDirty.current = true;
                setTimeout(() => saveChanges(next), 0);
                return next;
              });
            }}
            className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded border border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-accent)] transition-colors"
          >
            轉成 簡易歌詞 (無時間戳)
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div className="p-2 border-b border-[var(--app-border-base)] bg-[var(--app-bg-input)] flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[300px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                id="search-input"
                type="text"
                placeholder="搜尋文字..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-[var(--app-bg-panel-alt)] border border-[var(--app-border-base)] rounded px-8 py-1 text-sm text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-border-light)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  }
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    textareaRef.current?.focus();
                  }
                }}
              />
              {matches.length > 0 && (
                <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-[var(--app-text-muted)]">
                  {currentMatchIndex + 1} / {matches.length}
                </span>
              )}
            </div>

            <button
              onClick={handlePrevMatch}
              disabled={matches.length === 0}
              className="p-1.5 text-[var(--app-text-muted)] hover:text-white hover:bg-[var(--app-bg-panel-hover)] rounded disabled:opacity-50 disabled:hover:bg-transparent"
              title="上一處 (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={matches.length === 0}
              className="p-1.5 text-[var(--app-text-muted)] hover:text-white hover:bg-[var(--app-bg-panel-hover)] rounded disabled:opacity-50 disabled:hover:bg-transparent"
              title="下一處 (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            <div className="w-px h-4 bg-[var(--app-border-light)] mx-1 opacity-50"></div>

            <button
              onClick={() => {
                setIsSearchOpen(false);
                textareaRef.current?.focus();
              }}
              className="ml-auto p-1 text-[var(--app-text-muted)] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)] hover:text-white cursor-pointer mr-2 select-none">
              <input
                type="checkbox"
                checked={ignoreTimeTags}
                onChange={(e) => {
                  setIgnoreTimeTags(e.target.checked);
                  textareaRef.current?.focus();
                }}
                className="w-3 h-3 rounded appearance-none border border-[var(--app-border-light)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
              />
              無視時間標籤 (ELRC)
            </label>

            <label className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)] hover:text-white cursor-pointer mr-2 select-none">
              <input
                type="checkbox"
                checked={selectWholeLine}
                onChange={(e) => {
                  setSelectWholeLine(e.target.checked);
                  textareaRef.current?.focus();
                }}
                className="w-3 h-3 rounded appearance-none border border-[var(--app-border-light)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
              />
              選取整行
            </label>

            <div className="relative flex-1 max-w-[300px]">
              <Replace className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                type="text"
                placeholder="取代為..."
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                className="w-full bg-[var(--app-bg-panel-alt)] border border-[var(--app-border-base)] rounded px-8 py-1 text-sm text-[var(--app-text-primary)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:border-[var(--app-border-light)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleReplace();
                  }
                  if (e.key === "Escape") {
                    setIsSearchOpen(false);
                    textareaRef.current?.focus();
                  }
                }}
              />
            </div>

            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="px-3 py-1 bg-[var(--app-bg-panel-alt)] border border-[var(--app-border-base)] hover:border-blue-500/50 hover:text-blue-400 rounded text-xs text-[var(--app-text-secondary)] disabled:opacity-50 transition-colors"
            >
              取代
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-3 py-1 bg-[var(--app-bg-panel-alt)] border border-[var(--app-border-base)] hover:border-blue-500/50 hover:text-blue-400 rounded text-xs text-[var(--app-text-secondary)] disabled:opacity-50 transition-colors"
              title="全部取代"
            >
              <ReplaceAll className="w-3 h-3 inline-block mr-1 -mt-0.5" />
              全部取代
            </button>
          </div>
        </div>
      )}

      <LineNumberedTextarea
        ref={textareaRef}
        className="flex-1 rounded-none border-0 border-t border-[var(--app-border-base)] shadow-inner text-[var(--app-text-secondary)]"
        placeholder="Paste your raw LRC with timestamps here..."
        value={text}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            setIsSearchOpen(true);
            setTimeout(() => {
              document.getElementById("search-input")?.focus();
            }, 0);
          }
        }}
        startLineNumber={1}
      />
    </div>
  );
}
