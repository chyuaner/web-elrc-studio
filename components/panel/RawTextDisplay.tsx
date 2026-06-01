'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useEditor } from '@/components/base/EditorProvider';
import { exportLrc, exportSrt } from '@/lib/lyric-utils';
import { useI18n } from '@/hooks/useI18n';
import { KaraokePreview } from '@/components/panel/KaraokePreview';
import { useAutoScroll } from '@/components/base/useAutoScroll';
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

const RawLine = React.memo(({ 
  idx, 
  lineText, 
  mappedOriginalIdx, 
  activeLineIndex, 
  paragraphStarts, 
  linesLength 
}: any) => {
  const isHighlight = mappedOriginalIdx === activeLineIndex && linesLength > 0;
  const isParagraphStartColor = mappedOriginalIdx !== undefined && paragraphStarts[mappedOriginalIdx] && linesLength > 0 && !isHighlight;
  
  const rowClass = isHighlight 
      ? 'bg-[var(--app-accent)]/20 text-[var(--app-accent)]' 
      : isParagraphStartColor 
         ? 'bg-[#293B33]/40 text-[var(--app-text-secondary)] shadow-[inset_2px_0_0_0_rgba(65,168,125,0.5)] hover:bg-[#293B33]/60' 
         : 'text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)]';
         
  return (
      <div className={`flex px-2 py-0.5 transition-colors ${rowClass}`}>
          <div className="w-10 shrink-0 text-right pr-3 opacity-30 select-none text-xs leading-[1.4rem]">
              {idx + 1}
          </div>
          <div className="flex-1 leading-[1.4rem]" style={{ wordBreak: 'break-all' }}>
              {lineText || ' '}
          </div>
      </div>
  );
});
RawLine.displayName = 'RawLine';

export interface RawTextDisplayProps {
  customText?: string;
  customLeftControls?: React.ReactNode;
  customRightControls?: React.ReactNode;
  hideKaraokePreview?: boolean;
}

export function RawTextDisplay({
  customText,
  customLeftControls,
  customRightControls,
  hideKaraokePreview
}: RawTextDisplayProps = {}) {
  const { lines, activeLineIndex, lrcMetadata, exportFormat, setExportFormat, setAutoScrollEnabled, dualLineGapSec, setDualLineGapSec, paragraphStarts, duration } = useEditor();
  const i18n = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [simpleIncludeInstrumental, setSimpleIncludeInstrumental] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [ignoreTimeTags, setIgnoreTimeTags] = useState(true);
  const [selectWholeLine, setSelectWholeLine] = useState(false);

  const visualParagraphStarts = useMemo(() => {
    const result = new Array(lines.length).fill(false);
    for (let i = 0; i < lines.length; i++) {
      if (paragraphStarts[i]) {
        if (i === 0) {
          result[i] = true;
        } else {
          const prevLine = lines[i - 1];
          let prevEnd = prevLine.end;
          if (prevEnd === null && prevLine.words?.length > 0) {
            const lastWordWithStart = [...prevLine.words].reverse().find(w => w.start !== null);
            if (lastWordWithStart) prevEnd = lastWordWithStart.start;
          }
          let gapSec = -1;
          const currentStart = lines[i].start;
          if (prevEnd !== null && currentStart !== null) {
            gapSec = currentStart - prevEnd;
          }
          const isPrevEmpty = prevLine.words?.every((w: any) => !w.text.trim());
          if (gapSec >= dualLineGapSec || isPrevEmpty || lines[i].ktvsp != null) {
            result[i] = true;
          }
        }
      }
    }
    return result;
  }, [lines, paragraphStarts, dualLineGapSec]);

  useAutoScroll();
  
  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [setAutoScrollEnabled]);
  
  let text = customText !== undefined ? customText : '';
  if (customText === undefined) {
      if (exportFormat === 'srt') {
          text = exportSrt(lines, duration);
      } else {
          text = exportLrc(lines, lrcMetadata, exportFormat === 'enhanced', exportFormat === 'simple', simpleIncludeInstrumental, paragraphStarts);
      }
  }
  const allLines = text.split('\n');

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
          for(let i = lastIndex; i < match.index; i++) {
             sourceText += text[i];
             mapping.push(i);
          }
          lastIndex = tagRegex.lastIndex;
       }
       for(let i = lastIndex; i < text.length; i++) {
          sourceText += text[i];
          mapping.push(i);
       }
       mapping.push(text.length);
    }
    
    const lowerSource = sourceText.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    const newMatches: {start: number, end: number}[] = [];
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
          while (tempEnd < text.length && text[tempEnd] !== '\n' && text[tempEnd] !== '\r') {
              if (text[tempEnd] !== ' ' && text[tempEnd] !== '\t') {
                  hasContentOnRight = true;
                  break;
              }
              tempEnd++;
          }

          while (finalStart > 0) {
              const charBefore = text[finalStart - 1];
              if (charBefore === '>' || charBefore === ']') {
                  const openChar = charBefore === '>' ? '<' : '[';
                  let tagStart = finalStart - 1;
                  while (tagStart >= 0 && text[tagStart] !== openChar) {
                      tagStart--;
                  }
                  if (tagStart >= 0) {
                      const tagText = text.substring(tagStart, finalStart);
                      if (/^[<\[]\d{2}:\d{2}(?:\.\d{2,3})?[>\]]$/.test(tagText)) {
                          if (openChar === '[' && hasContentOnRight) {
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
          while (finalStart > 0 && text[finalStart - 1] !== '\n') {
              finalStart--;
          }
          while (finalEnd < text.length && text[finalEnd] !== '\n') {
              finalEnd++;
          }
          if (finalEnd < text.length && text[finalEnd] === '\n') {
              finalEnd++;
          }
      }

      newMatches.push({ start: finalStart, end: finalEnd });
      startIndex = index + searchText.length;
    }

    const mergedMatches: { start: number, end: number }[] = [];
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
    const container = containerRef.current;
    if (!container) return;
    const match = matches[index];
    if (!match) return;

    let currentLen = 0;
    let startLineIndex = 0;
    let startOffset = 0;
    let endLineIndex = 0;
    let endOffset = 0;

    for (let i = 0; i < allLines.length; i++) {
        const lineLen = allLines[i].length;
        if (match.start <= currentLen + lineLen && startLineIndex === 0 && startOffset === 0) {
           startLineIndex = i;
           startOffset = match.start - currentLen;
        }
        if (match.end <= currentLen + lineLen) {
           endLineIndex = i;
           endOffset = match.end - currentLen;
           break;
        }
        currentLen += lineLen + 1;
    }
    
    // Safety check just in case it wasn't set, although it shouldn't happen
    if (startLineIndex === 0 && match.start > 0 && startOffset === 0 && allLines.length > 0) {
        startLineIndex = 0; 
        startOffset = match.start;
    }
    if (endLineIndex === 0 && match.end > 0 && endOffset === 0 && allLines.length > 0) {
        endLineIndex = Math.max(0, allLines.length - 1);
        endOffset = allLines[endLineIndex].length;
    }

    try {
        const startRow = container.children[startLineIndex] as HTMLElement;
        const endRow = container.children[endLineIndex] as HTMLElement;
        
        if (!startRow || !endRow) return;

        let startTextNode = startRow?.children[1]?.firstChild;
        if (!startTextNode) startTextNode = startRow?.children[1];
        
        let endTextNode = endRow?.children[1]?.firstChild;
        if (!endTextNode) endTextNode = endRow?.children[1];

        if (startTextNode && endTextNode) {
            const selection = window.getSelection();
            const range = document.createRange();

            const sOff = Math.min(startOffset, startTextNode.textContent?.length || 0);
            const eOff = Math.min(endOffset, endTextNode.textContent?.length || 0);

            if (startTextNode.nodeType === Node.TEXT_NODE) {
                range.setStart(startTextNode, sOff);
            } else {
                range.setStart(startTextNode, 0);
            }

            if (endTextNode.nodeType === Node.TEXT_NODE) {
                range.setEnd(endTextNode, eOff);
            } else {
                range.setEnd(endTextNode, 0);
            }

            selection?.removeAllRanges();
            selection?.addRange(range);

            (startRow as HTMLElement).scrollIntoView({ block: 'center', behavior: 'auto' });
        }
    } catch (err) {
        console.error("Failed to select match", err);
    }
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

  useEffect(() => {
    const searchHandler = (e: any) => {
      const selectedHtmlText = e.detail?.text || "";
      const shouldIgnoreTags = e.detail?.ignoreTimeTags;
      
      let searchTextToUse = selectedHtmlText;
      // check window selection
      if (!searchTextToUse) {
         const selText = window.getSelection()?.toString();
         if (selText) searchTextToUse = selText;
      }

      if (shouldIgnoreTags) {
         searchTextToUse = searchTextToUse.replace(/(?:\[\d{2}:\d{2}(?:\.\d{2,3})?\])|(?:<\d{2}:\d{2}(?:\.\d{2,3})?>)/g, "");
      }

      if (searchTextToUse) {
         setSearchText(searchTextToUse);
      }
      setIsSearchOpen(true);
      setTimeout(() => {
        document.getElementById("preview-search-input")?.focus();
      }, 50);
    };
    window.addEventListener("context-menu-search", searchHandler);
    return () => window.removeEventListener("context-menu-search", searchHandler);
  }, []);

  
  let currentRawIndex = 0;
  const rawIdxToLineIdx = new Map<number, number>();
  
  if (customText === undefined) {
      if (exportFormat === 'srt') {
          for (let i = 0; i < lines.length; i++) {
              const l = lines[i];
              if (l.start !== null && l.words.some(w => w.text.trim().length > 0)) {
                  rawIdxToLineIdx.set(currentRawIndex, i);
                  rawIdxToLineIdx.set(currentRawIndex + 1, i);
                  rawIdxToLineIdx.set(currentRawIndex + 2, i);
                  rawIdxToLineIdx.set(currentRawIndex + 3, i);
                  currentRawIndex += 4;
              }
          }
      } else {
          let metadataLinesCount = 0;
          if (exportFormat !== 'simple' && lrcMetadata) {
              if (lrcMetadata.klgno) {
                  const intervals = lrcMetadata.klgno.split(';');
                  for (const interval of intervals) {
                      if (interval.trim()) {
                          metadataLinesCount++;
                      }
                  }
              }
              for (const [key, value] of Object.entries(lrcMetadata)) {
                  if (value && key !== 'klgno') {
                      metadataLinesCount++;
                  }
              }
          }
          
          for (let i = 0; i < metadataLinesCount; i++) {
              currentRawIndex++;
          }
    
          let currentExportStyle: string | undefined = undefined;
          for (let i = 0; i < lines.length; i++) {
              if (exportFormat === 'simple' && simpleIncludeInstrumental && i > 0 && paragraphStarts[i]) {
                  currentRawIndex++; // Empty line
              }
              if (exportFormat !== 'simple') {
                  if (lines[i].isSingleLine) {
                      rawIdxToLineIdx.set(currentRawIndex, i);
                      currentRawIndex++;
                  }
                  if (lines[i].ktvsp != null) {
                      rawIdxToLineIdx.set(currentRawIndex, i);
                      currentRawIndex++;
                  }
                  if (lines[i].style && lines[i].style !== currentExportStyle) {
                      rawIdxToLineIdx.set(currentRawIndex, i);
                      currentRawIndex++;
                      currentExportStyle = lines[i].style;
                  }
              }
              rawIdxToLineIdx.set(currentRawIndex, i);
              currentRawIndex++;
          }
      }
  }

  const handleSelectAll = () => {
    const selection = window.getSelection();
    if (selection && containerRef.current) {
        const range = document.createRange();
        range.selectNodeContents(containerRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
    }
  };

  const handleCopyAll = async () => {
    try {
       await navigator.clipboard.writeText(text);
    } catch (err) {
       console.error("Failed to copy", err);
    }
  };

  return (
    <div className="contents lg:flex lg:flex-col lg:h-full lg:bg-[var(--app-bg-panel-alt)] lg:relative">
      {!hideKaraokePreview && <KaraokePreview hideTouchUI={true} />}
      
      <div className="p-3 bg-[var(--app-bg-panel)] border-b border-[var(--app-border-base)] flex flex-wrap gap-3 justify-between items-center shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
           {customLeftControls ? customLeftControls : (
             <>
               <button
                 onClick={() => setExportFormat('enhanced')}
                 className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors disabled:opacity-50 ${exportFormat === 'enhanced' ? 'bg-[var(--app-border-base)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-inner' : 'border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
               >
                 {i18n.exportEnhanced}
               </button>
               <button
                 onClick={() => setExportFormat('standard')}
                 className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors disabled:opacity-50 ${exportFormat === 'standard' ? 'bg-[var(--app-border-base)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-inner' : 'border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
               >
                 {i18n.exportStandard}
               </button>
               <button
                 onClick={() => setExportFormat('simple')}
                 className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors disabled:opacity-50 ${exportFormat === 'simple' ? 'bg-[var(--app-border-base)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-inner' : 'border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
               >
                 {i18n.exportSimple || '簡易歌詞 (無時間戳)'}
               </button>
               <button
                 onClick={() => setExportFormat('srt')}
                 className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded border transition-colors disabled:opacity-50 ${exportFormat === 'srt' ? 'bg-[var(--app-border-base)] border-[var(--app-accent)] text-[var(--app-accent)] shadow-inner' : 'border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
               >
                 .SRT
               </button>
               
               {exportFormat === 'simple' && (
                 <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors select-none">
                   <input 
                     type="checkbox" 
                     checked={simpleIncludeInstrumental} 
                     onChange={(e) => setSimpleIncludeInstrumental(e.target.checked)} 
                     className="rounded border-[var(--app-border-base)] bg-transparent accent-[var(--app-accent)] m-0 w-3.5 h-3.5"
                   />
                   輸出包含留空的間奏行
                 </label>
               )}
             </>
           )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`px-3 py-1.5 flex items-center text-[10px] font-bold uppercase tracking-widest rounded border transition-colors ${
              isSearchOpen
                ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                : "border-[var(--app-border-light)] text-[var(--app-text-muted)] hover:text-white"
            }`}
            title="搜尋 (Ctrl+F)"
          >
            <Search className="w-3 h-3 mr-1" />
            搜尋
          </button>
          
          {customRightControls}
          
          <div className="flex gap-2">
            <button 
               onClick={handleSelectAll}
               className="px-3 py-1 bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] text-[var(--app-text-secondary)] text-[10px] uppercase font-bold rounded border border-[var(--app-border-light)] transition-colors"
            >
               全選
            </button>
            <button 
               onClick={handleCopyAll}
               className="px-3 py-1 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black text-[10px] uppercase font-bold rounded transition-colors"
            >
               複製全部
            </button>
          </div>
        </div>
      </div>
      
      {isSearchOpen && (
        <div className="p-2 border-b border-[var(--app-border-base)] bg-[var(--app-bg-input)] flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[300px]">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
              <input
                id="preview-search-input"
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

            <label className="flex items-center gap-1.5 text-[10px] text-[var(--app-text-muted)] hover:text-white cursor-pointer mr-2 select-none">
              <input 
                type="checkbox" 
                checked={ignoreTimeTags} 
                onChange={(e) => {
                  setIgnoreTimeTags(e.target.checked);
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
                }} 
                className="w-3 h-3 rounded appearance-none border border-[var(--app-border-light)] checked:bg-blue-500 checked:border-blue-500 cursor-pointer" 
              />
              選取整行
            </label>

            <button
              onClick={() => {
                setIsSearchOpen(false);
              }}
              className="ml-auto p-1 text-[var(--app-text-muted)] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div 
        id="raw-editor-scroll-container" 
        className="flex-1 overflow-auto bg-[var(--app-bg-base)] text-sm font-mono py-4 select-text leading-relaxed outline-none border-t border-[var(--app-border-base)] shadow-inner" 
        style={{ whiteSpace: 'pre-wrap' }} 
        ref={containerRef} 
        data-context-menu="readonly"
        tabIndex={-1}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            setIsSearchOpen(true);
            setTimeout(() => {
              document.getElementById("preview-search-input")?.focus();
            }, 0);
          }
        }}
      >
          {allLines.map((lineText, idx) => (
              <RawLine
                  key={idx}
                  idx={idx}
                  lineText={lineText}
                  mappedOriginalIdx={rawIdxToLineIdx.get(idx)}
                  activeLineIndex={activeLineIndex}
                  paragraphStarts={visualParagraphStarts}
                  linesLength={lines.length}
              />
          ))}
      </div>
    </div>
  );
}
