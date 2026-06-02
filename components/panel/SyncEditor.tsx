import React, { useEffect, useRef, memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '@/components/base/EditorProvider';
import { useSyncHotkeys } from '@/components/base/useSyncHotkeys';
import { formatTime } from '@/lib/lyric-utils';
import { KaraokePreview } from '@/components/panel/KaraokePreview';
import { Tooltip } from '@/components/common/Tooltip';
import { MultiSingerDialog } from '@/components/panel/MultiSingerDialog';
import { Edit2, Trash2, X, ArrowRight, MoreVertical, ArrowUpFromLine, Copy, Play, SplitSquareVertical, Clock, Scissors, Type, Plus, FileText, Eraser, SlidersHorizontal, Settings2 } from 'lucide-react';
import { BaseDialog } from '@/components/dialog/BaseDialog';

import { ContextMenu, ContextMenuItem, ContextMenuSeparator, ContextMenuSub } from '@/components/common/ContextMenu';
import { useAutoScroll } from '@/components/base/useAutoScroll';
import { useDialogs } from '@/components/dialog/DialogProvider';
import { useI18n } from '@/hooks/useI18n';
import { LyricCellContent } from '@/components/panel/LyricCell';

const SyncCell = memo(({ 
  data, isDual, isActive, isPassed, activeWordIndex, syncMode, paragraphStart, playerRef, i18n, 
  setActiveLineIndex, setActiveWordIndex, handleEditText, handleOffsetFromHere, handleClearTime, handleDeleteLine,
  onMergeToPrevious, onLineContextMenu, onWordContextMenu, onTimeContextMenu, openMoreMenu
}: any) => {
  if (!data) {
    return (
      <td className={`p-3 border-r border-[var(--app-border-base)] align-top bg-[var(--app-bg-input)]/30 text-center ${isDual ? 'w-1/2' : 'w-full'}`}>
        <span className="opacity-20 font-mono text-[10px] tracking-widest uppercase">Instrumental Break</span>
      </td>
    );
  }
  
  const { line, index: globalIndex } = data;

  return (
    <td 
      data-line-index={globalIndex}
      onClick={() => {
        setActiveLineIndex(globalIndex);
        setActiveWordIndex(0);
        const { current: player } = playerRef;
        if (player instanceof HTMLMediaElement && line.start !== null) {
            player.currentTime = line.start;
        }
      }}
      className={`p-0 align-top group cursor-pointer border-r border-[var(--app-border-base)] transition-colors relative ${isDual ? 'w-1/2' : 'w-full'}
        ${isActive ? 
          (line.isSingleLine ? 'bg-[var(--app-border-base)] text-[var(--app-text-primary)] shadow-[inset_3px_0_0_0_#a855f7]' : 
            (line.ktvsp != null ? 'bg-[var(--app-border-base)] text-[var(--app-text-primary)] shadow-[inset_3px_0_0_0_#22c55e]' : 'bg-[var(--app-border-base)] text-[var(--app-text-primary)] shadow-[inset_2px_0_0_0_var(--app-accent)]')) : 
          (line.isSingleLine ? 'bg-purple-500/10 dark:bg-purple-950/30 hover:bg-purple-500/20 dark:hover:bg-purple-950/50 text-[var(--app-text-muted)] shadow-[inset_2px_0_0_0_#a855f7]' :
            (line.ktvsp != null ? 'bg-green-500/10 dark:bg-green-950/30 hover:bg-green-500/20 dark:hover:bg-green-950/50 text-[var(--app-text-muted)] shadow-[inset_2px_0_0_0_#22c55e]' :
              (paragraphStart ? 'bg-[#293B33]/40 hover:bg-[#293B33]/60 text-[var(--app-text-muted)] shadow-[inset_2px_0_0_0_rgba(65,168,125,0.5)]' : 'hover:bg-[var(--app-bg-panel-alt)] text-[var(--app-text-muted)]')))}
        ${(!isActive && isPassed && !paragraphStart && !line.isSingleLine && line.ktvsp == null) ? ' opacity-60' : ''}`}
    >
      <LyricCellContent
        line={line}
        globalIndex={globalIndex}
        isActive={isActive}
        activeWordIndex={activeWordIndex}
        syncMode={syncMode}
        playerRef={playerRef}
        setActiveLineIndex={setActiveLineIndex}
        setActiveWordIndex={setActiveWordIndex}
        onLineContextMenu={onLineContextMenu}
        onWordContextMenu={onWordContextMenu}
        onTimeContextMenu={onTimeContextMenu}
        actions={
          <>
            <Tooltip title="編輯這行字RAW" delay={500}>
              <button onClick={(e) => { e.stopPropagation(); handleEditText(globalIndex); }} className={`p-1 px-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors ${isDual ? 'hidden 2xl:block' : 'hidden xl:block'}`}><Edit2 className="w-3.5 h-3.5" /></button>
            </Tooltip>
            {globalIndex > 0 && (
              <Tooltip title="合併到上一行" delay={500}>
                <button onClick={(e) => { e.stopPropagation(); onMergeToPrevious(globalIndex); }} className={`p-1 px-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors ${isDual ? 'hidden 2xl:block' : 'hidden xl:block'}`}><ArrowUpFromLine className="w-3.5 h-3.5" /></button>
              </Tooltip>
            )}
            <Tooltip title={i18n.clearTimestamps} delay={500}>
              <button onClick={(e) => { e.stopPropagation(); handleClearTime(globalIndex); }} className={`p-1 px-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-accent)] hover:bg-[var(--app-bg-hover)] rounded transition-colors ${isDual ? 'hidden 2xl:block' : 'hidden xl:block'}`}><X className="w-3.5 h-3.5" /></button>
            </Tooltip>
            <Tooltip title={i18n.deleteLine} delay={500}>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteLine(globalIndex); }} className="p-1 px-1.5 text-[var(--app-text-muted)] hover:text-red-500 hover:bg-[var(--app-bg-hover)] rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </Tooltip>
            <Tooltip title="其他選項" delay={500}>
              <button onClick={(e) => { e.stopPropagation(); openMoreMenu(e, globalIndex); }} className="p-1 px-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors"><MoreVertical className="w-3.5 h-3.5" /></button>
            </Tooltip>
          </>
        }
      />
    </td>
  );
}, (prevProps, nextProps) => {
  // Custom deep equality to prevent unnecessary React re-renders for every row
  if (!prevProps.data && !nextProps.data) return true;
  if (!prevProps.data || !nextProps.data) return false;
  
  return prevProps.data.line === nextProps.data.line &&
         prevProps.data.index === nextProps.data.index &&
         prevProps.isDual === nextProps.isDual &&
         prevProps.isActive === nextProps.isActive &&
         prevProps.isPassed === nextProps.isPassed &&
         prevProps.activeWordIndex === nextProps.activeWordIndex &&
         prevProps.syncMode === nextProps.syncMode &&
         prevProps.paragraphStart === nextProps.paragraphStart;
});
SyncCell.displayName = 'SyncCell';

const getLineRawText = (line: any) => {
    let result = '';
    if (line?.style) {
        result += `[kstyle:${line.style}] `;
    }
    if (line?.start !== null) {
        result += `[${formatTime(line.start, true)}]`;
    }
    if (line?.words) {
        result += line.words.map((w: any) => {
            let p = '';
            if (w.style) p += `<kstyle:${w.style}>`;
            if (w.start !== null) p += `<${formatTime(w.start, true)}>`;
            p += w.text;
            return p;
        }).join('');
    }
    return result;
};

const getLineText = (line: any) => {
    if (!line?.words) return '';
    return line.words.map((w: any) => w.text).join('');
};

import { createEffectiveLines } from '@/lib/compute-styles';

export function SyncEditor() {
  const {
    mode, lines, activeLineIndex, setActiveLineIndex,
    activeWordIndex, setActiveWordIndex,
    syncMode, setSyncMode, setMode, hotkeys, commitLines, playerRef,
    dualLineGapSec, setDualLineGapSec,
    autoScrollEnabled, setAutoScrollEnabled, trackAssignments, paragraphStarts, shiftTimeFromIndex,
    shiftTime, touchUIMode
  } = useEditor();
  
  const dialogs = useDialogs();
  const { handleLineStamp, handleWordStamp, handleWordNextLine } = useSyncHotkeys();
  useAutoScroll();
  const i18n = useI18n();

  const effectiveLines = React.useMemo(() => createEffectiveLines(lines), [lines]);

  const visualParagraphStarts = React.useMemo(() => {
    const result = new Array(lines.length).fill(false);
    for (let i = 0; i < lines.length; i++) {
      if (paragraphStarts[i]) {
        if (i === 0) {
          result[i] = true;
        } else {
          const prevLine = lines[i - 1];
          let prevEnd = prevLine.end;
          if (prevEnd === null && prevLine.words?.length > 0) {
            const lastWordWithStart = [...prevLine.words].reverse().find((w: any) => w.start !== null);
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
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isTall, setIsTall] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsTall(window.innerHeight > 1110);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (containerRef.current && autoScrollEnabled) {
      const activeEl = containerRef.current.querySelector(`[data-line-index="${activeLineIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeLineIndex, autoScrollEnabled]);

  const [ctxMenu, setCtxMenu] = React.useState<{
    x: number; y: number; type: 'line' | 'word' | 'time'; globalIndex: number; wordIndex?: number;
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setCtxMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const [editingText, setEditingText] = useState<{ globalIndex: number, text: string, type: 'raw' | 'text' } | null>(null);
  const [ktvspDialog, setKtvspDialog] = useState<{ globalIndex: number, text: string } | null>(null);
  const [multiSingerDialogOpen, setMultiSingerDialogOpen] = useState(false);

  const handleEditRawText = useCallback((globalIndex: number) => {
    const defaultRaw = getLineRawText(lines[globalIndex]);
    setEditingText({ globalIndex, text: defaultRaw, type: 'raw' });
  }, [lines]);

  const handleEditTextOnly = useCallback((globalIndex: number) => {
     const textOnly = getLineText(lines[globalIndex]);
     setEditingText({ globalIndex, text: textOnly, type: 'text' });
  }, [lines]);

  const handleOffsetFromHere = useCallback(async (globalIndex: number) => {
    const val = await dialogs.prompt(i18n.promptShiftTime, '0');
    if (val !== null) {
      const sec = parseFloat(val);
      if (!isNaN(sec) && sec !== 0) {
        shiftTimeFromIndex(globalIndex, sec);
      }
    }
  }, [dialogs, i18n, shiftTimeFromIndex]);

  const handleClearTime = useCallback((globalIndex: number) => {
    commitLines(prev => {
      const newLines = [...prev];
      newLines[globalIndex] = { ...newLines[globalIndex], start: null };
      if (newLines[globalIndex].words) {
          newLines[globalIndex].words = newLines[globalIndex].words.map((w: any) => ({...w, start: null, end: null}));
      }
      return newLines;
    }, 'Reset Time');
  }, [commitLines]);

  const handleDeleteLine = useCallback((globalIndex: number) => {
    commitLines(prev => prev.filter((_, i) => i !== globalIndex), 'Delete Line');
  }, [commitLines]);

  const handleSetLineStyle = useCallback((globalIndex: number, styleId: string) => {
    commitLines(prev => {
      const newLines = [...prev];
      const currentObj = { ...newLines[globalIndex] };
      currentObj.style = currentObj.style === styleId ? undefined : styleId;
      newLines[globalIndex] = currentObj;
      return newLines;
    }, 'Toggle Line Style');
  }, [commitLines]);

  const handleSetWordStyle = useCallback((globalIndex: number, wordIndex: number, styleId: string) => {
    commitLines(prev => {
      const newLines = [...prev];
      const newWords = [...newLines[globalIndex].words];
      newWords[wordIndex] = { ...newWords[wordIndex], style: newWords[wordIndex].style === styleId ? undefined : styleId };
      newLines[globalIndex] = { ...newLines[globalIndex], words: newWords };
      return newLines;
    }, 'Toggle Word Style');
  }, [commitLines]);

  const handleMergeToPrevious = useCallback((globalIndex: number) => {
      if (globalIndex === 0) return;
      commitLines(prev => {
          const newLines = [...prev];
          const curr = newLines[globalIndex];
          const prevLine = newLines[globalIndex - 1];
          const newWords = [...prevLine.words];
          
          if (newWords.length > 0 && !newWords[newWords.length - 1].text.match(/\s$/)) {
              newWords.push({ text: ' ', start: null, end: null });
          }
          newWords.push(...curr.words);
          
          const { formatTime } = require('@/lib/lyric-utils');
          const newRaw = newWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
          
          newLines[globalIndex - 1] = { ...prevLine, raw: newRaw, words: newWords };
          newLines.splice(globalIndex, 1);
          return newLines;
      }, 'Merge to Previous Line');
  }, [commitLines]);

  const handleEditTimeOnly = useCallback(async (globalIndex: number) => {
      const line = lines[globalIndex];
      const val = await dialogs.prompt('Edit timestamp (ss.xx or mm:ss.xx):', line.start !== null ? formatTime(line.start, true) : '');
      if (val !== null) {
         const { parseSeconds } = require('@/lib/lyric-utils');
         const num = parseSeconds(val);
         if (!isNaN(num)) {
            commitLines(prev => {
               const newLines = [...prev];
               newLines[globalIndex] = { ...newLines[globalIndex], start: num };
               return newLines;
            }, 'Edit Time');
         }
      }
  }, [lines, dialogs, commitLines]);

  const handleJumpTo = useCallback((globalIndex: number, wordIndex?: number) => {
      const line = lines[globalIndex];
      if (!line) return;
      const { current: player } = playerRef;
      if (player instanceof HTMLMediaElement) {
          let t = line.start;
          if (wordIndex !== undefined && line.words[wordIndex]?.start !== null) {
               t = line.words[wordIndex].start;
          }
          if (t !== null) player.currentTime = t;
      }
  }, [lines, playerRef]);

  const handleSplitWordToNextLine = useCallback((globalIndex: number, wordIndex: number) => {
      commitLines(prev => {
          const newLines = [...prev];
          const line = newLines[globalIndex];
          const words = line.words;
          const lineHasEndStamp = words.length > 0 && words[words.length - 1].text === '' && words[words.length - 1].start !== null;

          const leftWords = words.slice(0, wordIndex);
          const rightWords = words.slice(wordIndex);
          const rightStart = rightWords[0]?.start || null;

          if (lineHasEndStamp) {
              if (leftWords.length === 0 || leftWords[leftWords.length - 1].text !== '') {
                  leftWords.push({ text: '', start: rightStart, end: null });
              }
          }

          const leftRaw = leftWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
          const leftStart = leftWords.find(w => w.start !== null)?.start || line.start;
          const rightRaw = rightWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
          
          const { generateId } = require('@/lib/lyric-utils');
  
          newLines[globalIndex] = { ...line, words: leftWords, raw: leftRaw, start: leftStart };
          newLines.splice(globalIndex + 1, 0, {
              id: generateId(),
              start: rightStart,
              end: null,
              words: rightWords,
              raw: rightRaw
          });
          return newLines;
      }, 'Split Line');
  }, [commitLines]);

  const handleToggleSingleLine = useCallback((globalIndex: number) => {
      commitLines(prev => {
          return prev.map((line, i) => {
              if (i !== globalIndex) return line;
              return { ...line, isSingleLine: !line.isSingleLine };
          });
      }, 'Toggle Single Line');
  }, [commitLines]);

  const handleDeleteWord = useCallback((globalIndex: number, wordIndex: number) => {
      commitLines(prev => {
          const newLines = [...prev];
          const line = newLines[globalIndex];
          const newWords = [...line.words];
          newWords.splice(wordIndex, 1);
          const newRaw = newWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
          newLines[globalIndex] = { ...line, words: newWords, raw: newRaw };
          return newLines;
      }, 'Delete Word');
  }, [commitLines]);

  const handleInsertLineBefore = useCallback((globalIndex: number) => {
      commitLines(prev => {
          const newLines = [...prev];
          const { generateId } = require('@/lib/lyric-utils');
          newLines.splice(globalIndex, 0, { id: generateId(), start: null, end: null, words: [], raw: '' });
          return newLines;
      }, 'Insert Line Before');
  }, [commitLines]);

  const handleInsertLineAfter = useCallback((globalIndex: number) => {
      commitLines(prev => {
          const newLines = [...prev];
          const { generateId } = require('@/lib/lyric-utils');
          newLines.splice(globalIndex + 1, 0, { id: generateId(), start: null, end: null, words: [], raw: '' });
          return newLines;
      }, 'Insert Line After');
  }, [commitLines]);

  const handleEditWordRaw = useCallback(async (globalIndex: number, wordIndex: number) => {
      const line = lines[globalIndex];
      const word = line.words[wordIndex];
      const currentText = word.start !== null ? `<${formatTime(word.start, true)}>${word.text}` : word.text;
      const val = await dialogs.prompt('Edit word RAW:', currentText);
      if (val !== null && val !== currentText) {
          commitLines(prev => {
              const newLines = [...prev];
              const newWords = [...newLines[globalIndex].words];
              const { parseRawLyrics } = require('@/lib/lyric-utils');
              const parsedWordLine = parseRawLyrics(val).lines[0];
              const resultWords = parsedWordLine ? parsedWordLine.words : [{text: val, start: null, end: null}];
              newWords.splice(wordIndex, 1, ...resultWords);
              const newRaw = newWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
              newLines[globalIndex] = { ...newLines[globalIndex], words: newWords, raw: newRaw };
              return newLines;
          }, 'Edit Word RAW');
      }
  }, [lines, dialogs, commitLines]);

  const handleEditWordText = useCallback(async (globalIndex: number, wordIndex: number) => {
      const line = lines[globalIndex];
      const word = line.words[wordIndex];
      const val = await dialogs.prompt('Edit word text:', word.text);
      if (val !== null && val !== word.text) {
          commitLines(prev => {
              const newLines = [...prev];
              const newWords = [...newLines[globalIndex].words];
              newWords[wordIndex] = { ...newWords[wordIndex], text: val };
              const newRaw = newWords.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
              newLines[globalIndex] = { ...newLines[globalIndex], words: newWords, raw: newRaw };
              return newLines;
          }, 'Edit Word');
      }
  }, [lines, dialogs, commitLines]);

  const renderCellWrapper = (data: { line: any, index: number } | null, isDual: boolean) => {
    return (
      <SyncCell 
        key={data ? data.index : 'empty'}
        data={data}
        isDual={isDual}
        isActive={data ? data.index === activeLineIndex : false}
        isPassed={data ? data.index < activeLineIndex : false}
        activeWordIndex={data?.index === activeLineIndex ? activeWordIndex : 0}
        syncMode={syncMode}
        paragraphStart={data ? visualParagraphStarts[data.index] : false}
        playerRef={playerRef}
        i18n={i18n}
        setActiveLineIndex={setActiveLineIndex}
        setActiveWordIndex={setActiveWordIndex}
        handleEditText={handleEditRawText}
        handleOffsetFromHere={handleOffsetFromHere}
        handleClearTime={handleClearTime}
        handleDeleteLine={handleDeleteLine}
        onMergeToPrevious={handleMergeToPrevious}
        onLineContextMenu={(e: React.MouseEvent, globalIndex: number) => {
            e.preventDefault();
            setCtxMenu({ type: 'line', x: e.clientX, y: e.clientY, globalIndex });
        }}
        onWordContextMenu={(e: React.MouseEvent, globalIndex: number, wordIndex: number) => {
            e.preventDefault();
            setCtxMenu({ type: 'word', x: e.clientX, y: e.clientY, globalIndex, wordIndex });
        }}
        onTimeContextMenu={(e: React.MouseEvent, globalIndex: number) => {
            e.preventDefault();
            setCtxMenu({ type: 'time', x: e.clientX, y: e.clientY, globalIndex });
        }}
        openMoreMenu={(e: React.MouseEvent, globalIndex: number) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setActiveLineIndex(globalIndex);
            setActiveWordIndex(0);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = Math.min(rect.left, window.innerWidth - 250);
            const y = Math.min(rect.bottom, window.innerHeight - 300);
            setTimeout(() => {
                setCtxMenu({ type: 'line', x, y, globalIndex });
            }, 0);
        }}
      />
    );
  };

  const isDual = mode === 'dual-sync';
  const uiRows: ({ left: { line: any, index: number } | null, right?: { line: any, index: number } | null })[] = [];
  
  if (isDual) {
    let currentPair: { left: { line: any, index: number } | null, right: { line: any, index: number } | null } = { left: null, right: null };
    const currentPairEmpty = () => currentPair.left === null && currentPair.right === null;

    effectiveLines.forEach((line, i) => {
       const track = trackAssignments[i] || 0;
       if (track === 0) {
          if (!currentPairEmpty()) uiRows.push(currentPair);
          currentPair = { left: { line, index: i }, right: null };
       } else {
          currentPair.right = { line, index: i };
          uiRows.push(currentPair);
          currentPair = { left: null, right: null };
       }
    });
    if (!currentPairEmpty()) uiRows.push(currentPair);
  } else {
    effectiveLines.forEach((line, i) => {
       uiRows.push({ left: { line, index: i } });
    });
  }

  const handleLineConvertToTraditional = async (globalIndex: number) => {
    const { convertToTraditional } = await import('@/lib/chinese-conv');
    commitLines(prev => {
      const newLines = [...prev];
      newLines[globalIndex] = {
        ...newLines[globalIndex],
        words: newLines[globalIndex].words.map(w => ({ ...w, text: convertToTraditional(w.text) }))
      };
      newLines[globalIndex].raw = newLines[globalIndex].words.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
      return newLines;
    }, '這行字轉繁體');
  };

  const handleLineConvertToSimplified = async (globalIndex: number) => {
    const { convertToSimplified } = await import('@/lib/chinese-conv');
    commitLines(prev => {
      const newLines = [...prev];
      newLines[globalIndex] = {
        ...newLines[globalIndex],
        words: newLines[globalIndex].words.map(w => ({ ...w, text: convertToSimplified(w.text) }))
      };
      newLines[globalIndex].raw = newLines[globalIndex].words.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
      return newLines;
    }, '這行字轉簡體');
  };

  const handleWordConvertToTraditional = async (globalIndex: number, wordIndex: number) => {
    const { convertToTraditional } = await import('@/lib/chinese-conv');
    commitLines(prev => {
      const newLines = [...prev];
      const newWords = [...newLines[globalIndex].words];
      newWords[wordIndex] = { ...newWords[wordIndex], text: convertToTraditional(newWords[wordIndex].text) };
      newLines[globalIndex] = { ...newLines[globalIndex], words: newWords };
      newLines[globalIndex].raw = newLines[globalIndex].words.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
      return newLines;
    }, '這段字轉繁體');
  };

  const handleWordConvertToSimplified = async (globalIndex: number, wordIndex: number) => {
    const { convertToSimplified } = await import('@/lib/chinese-conv');
    commitLines(prev => {
      const newLines = [...prev];
      const newWords = [...newLines[globalIndex].words];
      newWords[wordIndex] = { ...newWords[wordIndex], text: convertToSimplified(newWords[wordIndex].text) };
      newLines[globalIndex] = { ...newLines[globalIndex], words: newWords };
      newLines[globalIndex].raw = newLines[globalIndex].words.map(w => w.start !== null ? `<${formatTime(w.start, true)}>${w.text}` : w.text).join('');
      return newLines;
    }, '這段字轉簡體');
  };

  return (
    <div className="contents lg:flex lg:flex-col lg:h-full lg:bg-[var(--app-bg-base)]">
      <div className="p-3 bg-[var(--app-bg-panel-alt)] flex flex-wrap items-center justify-between shrink-0 gap-2 lg:static z-20">
        <div className="flex bg-[var(--app-bg-input)] p-1 rounded-md border border-[var(--app-border-base)] shadow-inner">
          <button
            onClick={() => {
              setSyncMode('line');
              setActiveWordIndex(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${syncMode === 'line' ? 'bg-[var(--app-bg-panel)] text-[var(--app-accent)] shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
          >
            {i18n.lineByLine}
          </button>
          <button
            onClick={() => setSyncMode('word')}
             className={`px-3 py-1 text-xs font-medium rounded transition-all ${syncMode === 'word' ? 'bg-[var(--app-bg-panel)] text-[var(--app-accent)] shadow-sm' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text-secondary)]'}`}
          >
            {i18n.wordByWord}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[10px] text-[var(--app-text-muted)]">
          <Tooltip title={<span className="text-xs font-mono">移除所有時間戳</span>}>
            <button
              onClick={async () => {
                const confirmed = await dialogs.confirm('確定要移除所有時間戳嗎？');
                if (confirmed) {
                    const newLines = lines.map(line => ({
                        ...line,
                        start: null,
                        words: line.words.map(w => ({ ...w, start: null, end: null }))
                    }));
                    commitLines(newLines, '移除所有時間戳');
                }
              }}
              className="px-3 py-1.5 bg-[var(--app-bg-panel)] hover:bg-[var(--app-bg-hover)] hover:text-red-400 rounded shadow-sm border border-[var(--app-border-light)] flex items-center text-[var(--app-text-secondary)] transition-colors h-[30px]"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip title={<span className="text-xs font-mono">多人對唱 / 隱藏式標記</span>}>
            <button
              onClick={() => setMultiSingerDialogOpen(true)}
              className="px-3 py-1.5 bg-[var(--app-bg-panel)] hover:bg-[var(--app-bg-hover)] hover:text-[var(--app-accent)] rounded shadow-sm border border-[var(--app-border-light)] flex items-center text-[var(--app-text-secondary)] transition-colors h-[30px]"
            >
              <span className="font-bold text-[10px]">多人對唱</span>
            </button>
          </Tooltip>
          
          <div className="flex items-center shadow-sm rounded border border-[var(--app-border-light)] h-[30px] overflow-hidden bg-[var(--app-bg-panel)]">
            <Tooltip title={<span className="text-xs font-mono">將所有時間提前 0.1 秒</span>}>
              <button
                onClick={() => shiftTime(-0.1)}
                className="px-2 h-full hover:bg-[var(--app-bg-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors border-r border-[var(--app-border-light)] font-mono text-xs"
              >
                -0.1s
              </button>
            </Tooltip>
            <Tooltip title={<span className="text-xs font-mono">整份歌詞時間平移 (輸入數值)</span>}>
              <button
                onClick={async () => {
                  const val = await dialogs.prompt(i18n.promptShiftTime, '0');
                  if (val && !isNaN(parseFloat(val))) {
                     shiftTime(parseFloat(val));
                  }
                }}
                className="px-3 h-full hover:bg-[var(--app-bg-hover)] flex items-center text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip title={<span className="text-xs font-mono">將所有時間延後 0.1 秒</span>}>
              <button
                onClick={() => shiftTime(0.1)}
                className="px-2 h-full hover:bg-[var(--app-bg-hover)] text-[var(--app-text-secondary)] hover:text-[var(--app-text-primary)] transition-colors border-l border-[var(--app-border-light)] font-mono text-xs"
              >
                +0.1s
              </button>
            </Tooltip>
          </div>

          <label className="flex items-center gap-2 cursor-pointer hover:text-[var(--app-text-primary)] transition-colors">
            <input 
              type="checkbox" 
              checked={autoScrollEnabled} 
              onChange={(e) => setAutoScrollEnabled(e.target.checked)}
              className="accent-[var(--app-accent)]"
            />
            <span className="uppercase font-bold tracking-widest">{i18n.autoScroll}</span>
          </label>

          <div className="flex items-center gap-2 bg-[var(--app-bg-panel)] p-1.5 rounded border border-[var(--app-border-base)] shadow-sm">
             <span className="uppercase">{i18n.gapToggledAt}</span>
             <input 
               type="number"
               min="1" max="60"
               value={dualLineGapSec}
               onChange={(e) => setDualLineGapSec(Number(e.target.value) || 6)}
               className={`bg-[var(--app-border-base)] px-1 w-12 py-0.5 rounded outline-none border border-[var(--app-border-light)] text-center ${dualLineGapSec < 5.5 ? 'text-red-500' : 'text-[var(--app-accent)]'}`}
             />
             <span>{i18n.sec}</span>
          </div>

          <button onFocus={(e) => e.target.blur()} onClick={() => syncMode === 'line' ? handleLineStamp() : handleWordStamp()} className="bg-[var(--app-bg-panel)] hover:bg-[var(--app-border-base)] transition-colors p-1.5 rounded border border-[var(--app-border-base)] flex items-center gap-2 shadow-sm cursor-pointer select-none text-xs h-[30px]">
              <span className="uppercase">{i18n.timestampWords}</span>
              <kbd className="bg-[var(--app-bg-base)] text-[var(--app-accent)] px-1.5 py-0.5 rounded font-mono border border-[var(--app-border-light)]">{hotkeys.stampWord === ' ' ? 'SPACE' : hotkeys.stampWord}</kbd>
          </button>
          
          {syncMode === 'word' && (
            <button onFocus={(e) => e.target.blur()} onClick={() => handleWordNextLine()} className="bg-[var(--app-bg-panel)] hover:bg-[var(--app-border-base)] transition-colors p-1.5 rounded border border-[var(--app-border-base)] flex items-center gap-2 shadow-sm cursor-pointer select-none text-xs h-[30px]">
                <span className="uppercase">{i18n.nextLine}</span>
                <kbd className="bg-[var(--app-bg-base)] text-[var(--app-accent)] px-1.5 py-0.5 rounded font-mono border border-[var(--app-border-light)]">{hotkeys.nextLine.toUpperCase()}</kbd>
            </button>
          )}
        </div>
      </div>

      <KaraokePreview />

      <div 
        ref={containerRef}
        id="sync-editor-scroll-container"
        className={`flex-1 w-full custom-scrollbar ${(!isMobile || isTall) ? 'overflow-y-auto' : ''}`}
      >
        <table className="w-full text-left text-xs border-collapse table-fixed">
          <thead className={`${(!isMobile || isTall) ? 'sticky top-0' : ''} bg-[var(--app-bg-panel)] text-[var(--app-text-muted)] z-10 text-[10px] uppercase tracking-widest font-bold outline outline-1 outline-b-[var(--app-border-base)]`}>
            <tr>
              {isDual ? (
                <>
                  <th className="p-3 w-1/2 border-r border-[var(--app-border-base)]">{i18n.leftTrack}</th>
                  <th className="p-3 w-1/2">{i18n.rightTrack}</th>
                </>
              ) : (
                <th className="p-3 w-full border-r border-[var(--app-border-base)]">{i18n.lyricsContentEnhanced}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262D]">
            {uiRows.map((row, idx) => (
              <tr key={idx} className="border-b border-[var(--app-border-base)]/50">
                {renderCellWrapper(row.left, isDual)}
                {isDual && renderCellWrapper(row.right || null, true)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          className="max-h-[85vh] overflow-y-auto md:max-h-none md:overflow-visible"
        >
          {ctxMenu.type === 'line' && (
            <>
              <ContextMenuItem icon={<Play className="w-3.5 h-3.5" />} label="歌曲跳轉至該行開頭" onClick={() => { handleJumpTo(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Copy className="w-3.5 h-3.5" />} label="複製這行字" onClick={() => { navigator.clipboard.writeText(getLineText(lines[ctxMenu.globalIndex])); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Clock className="w-3.5 h-3.5" />} label="複製時間戳" onClick={() => { navigator.clipboard.writeText(lines[ctxMenu.globalIndex]?.start !== null ? formatTime(lines[ctxMenu.globalIndex].start!) : ''); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Copy className="w-3.5 h-3.5 opacity-70" />} label="複製這行字RAW（含時間戳）" onClick={() => { navigator.clipboard.writeText(getLineRawText(lines[ctxMenu.globalIndex])); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<Type className="w-3.5 h-3.5" />} label="編輯這行字" onClick={() => { handleEditTextOnly(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Edit2 className="w-3.5 h-3.5" />} label="編輯這行字RAW（含時間戳）" onClick={() => { handleEditRawText(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuSub icon={<span className="w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] bg-gradient-to-br from-blue-500 to-red-500 text-white">🎨</span>} label="顏色標記">
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'B' ? 'text-white bg-blue-500' : 'text-blue-500'}`}>B</span>} label={lines[ctxMenu.globalIndex]?.style === 'B' ? "✓ 取消標記藍色" : "設為藍色B (男 or 第一人)"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'B'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'R' ? 'text-white bg-red-500' : 'text-red-500'}`}>R</span>} label={lines[ctxMenu.globalIndex]?.style === 'R' ? "✓ 取消標記紅色" : "設為紅色R (女 or 第二人)"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'R'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'P' ? 'text-white bg-purple-500' : 'text-purple-500'}`}>P</span>} label={lines[ctxMenu.globalIndex]?.style === 'P' ? "✓ 取消標記紫色" : "設為紫色P (第三人)"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'P'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'G' ? 'text-white bg-green-500' : 'text-green-500'}`}>G</span>} label={lines[ctxMenu.globalIndex]?.style === 'G' ? "✓ 取消標記綠色" : "設為綠色G (合唱)"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'G'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'T' ? 'text-white bg-gray-500' : 'text-gray-500'}`}>T</span>} label={lines[ctxMenu.globalIndex]?.style === 'T' ? "✓ 取消標記灰色" : "設為灰色T (旁白 or 隱藏)"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'T'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.style === 'N' ? 'text-white bg-[var(--app-accent)]' : 'text-[var(--app-accent)]'}`}>N</span>} label={lines[ctxMenu.globalIndex]?.style === 'N' ? "✓ 取消回歸預設" : "設為回歸預設N"} onClick={() => { handleSetLineStyle(ctxMenu.globalIndex, 'N'); setCtxMenu(null); }} />
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">繁</span>} label="這行字轉繁體" onClick={() => { handleLineConvertToTraditional(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">簡</span>} label="這行字轉簡體" onClick={() => { handleLineConvertToSimplified(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-semibold text-[10px] text-purple-500">3</span>} label={lines[ctxMenu.globalIndex]?.isSingleLine ? "✓ 算做第三句 (已啟用)" : "算做第三句（強制單行）"} onClick={() => { handleToggleSingleLine(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px] text-green-500">SP</span>} label={lines[ctxMenu.globalIndex]?.ktvsp != null ? `✓ 特殊作為段落開始 (${formatTime(lines[ctxMenu.globalIndex].ktvsp!)})` : "特殊作為段落開始 (ktvsp)"} onClick={() => { 
                const line = lines[ctxMenu.globalIndex];
                const defSec = line.start !== null ? Math.max(0, line.start - 5.5) : 0;
                setKtvspDialog({ globalIndex: ctxMenu.globalIndex, text: line.ktvsp != null ? formatTime(line.ktvsp, true) : formatTime(defSec, true) });
                setCtxMenu(null); 
              }} />
              <ContextMenuItem icon={<FileText className="w-3.5 h-3.5" />} label="到編輯原始文字" onClick={() => { 
                const targetIndex = ctxMenu.globalIndex;
                setCtxMenu(null);
                setMode('text');
                setTimeout(() => window.dispatchEvent(new CustomEvent('focus-raw-text-line', { detail: { lineIndex: targetIndex } })), 50);
              }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<Plus className="w-3.5 h-3.5" />} label="插入上一行" onClick={() => { handleInsertLineBefore(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Plus className="w-3.5 h-3.5" />} label="插入下一行" onClick={() => { handleInsertLineAfter(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<ArrowUpFromLine className="w-3.5 h-3.5" />} label="合併到上一行" onClick={() => { handleMergeToPrevious(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<ArrowRight className="w-3.5 h-3.5" />} label="平移後續時間" onClick={() => { handleOffsetFromHere(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem danger icon={<X className="w-3.5 h-3.5" />} label="清除時間戳" onClick={() => { handleClearTime(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem danger icon={<Trash2 className="w-3.5 h-3.5" />} label="刪除行" onClick={() => { handleDeleteLine(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <div className="px-3 py-2 flex flex-col gap-0.5 border-t border-[var(--app-border-base)]/50 mb-1 pointer-events-none">
                 <div className="flex items-center justify-between gap-4">
                     <span className="text-[10px] text-[var(--app-text-muted)] font-bold uppercase tracking-widest">目前選擇的行</span>
                     <span className="text-[11px] font-mono text-[var(--app-text-muted)] opacity-60">
                         {lines[ctxMenu.globalIndex]?.start !== null ? formatTime(lines[ctxMenu.globalIndex].start!) : '--:--.--'}
                     </span>
                 </div>
                 <span className="text-sm font-bold text-[var(--app-text-primary)] truncate max-w-[200px]">{getLineText(lines[ctxMenu.globalIndex]) || '(空白行)'}</span>
              </div>
            </>
          )}

          {ctxMenu.type === 'word' && ctxMenu.wordIndex !== undefined && (
            <>
              <ContextMenuItem icon={<Play className="w-3.5 h-3.5" />} label="歌曲跳轉至該字" onClick={() => { handleJumpTo(ctxMenu.globalIndex, ctxMenu.wordIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Copy className="w-3.5 h-3.5" />} label="複製這字" onClick={() => { navigator.clipboard.writeText(lines[ctxMenu.globalIndex].words[ctxMenu.wordIndex!].text); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Clock className="w-3.5 h-3.5" />} label="複製字的時間戳" onClick={() => { const word = lines[ctxMenu.globalIndex].words[ctxMenu.wordIndex!]; navigator.clipboard.writeText(word.start !== null ? formatTime(word.start, true) : ''); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Copy className="w-3.5 h-3.5 opacity-70" />} label="複製這字RAW（含時間戳）" onClick={() => { const word = lines[ctxMenu.globalIndex].words[ctxMenu.wordIndex!]; navigator.clipboard.writeText(word.start !== null ? `<${formatTime(word.start, true)}>${word.text}` : word.text); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<Type className="w-3.5 h-3.5" />} label="編輯這段字" onClick={() => { handleEditWordText(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Edit2 className="w-3.5 h-3.5" />} label="編輯這段字RAW（含時間戳）" onClick={() => { handleEditWordRaw(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuSub icon={<span className="w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] bg-gradient-to-br from-blue-500 to-red-500 text-white">🎨</span>} label="顏色標記">
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'B' ? 'text-white bg-blue-500' : 'text-blue-500'}`}>B</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'B' ? "✓ 取消標記藍色" : "設為藍色B (男 or 第一人)"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'B'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'R' ? 'text-white bg-red-500' : 'text-red-500'}`}>R</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'R' ? "✓ 取消標記紅色" : "設為紅色R (女 or 第二人)"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'R'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'P' ? 'text-white bg-purple-500' : 'text-purple-500'}`}>P</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'P' ? "✓ 取消標記紫色" : "設為紫色P (第三人)"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'P'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'G' ? 'text-white bg-green-500' : 'text-green-500'}`}>G</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'G' ? "✓ 取消標記綠色" : "設為綠色G (合唱)"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'G'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'T' ? 'text-white bg-gray-500' : 'text-gray-500'}`}>T</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'T' ? "✓ 取消標記灰色" : "設為灰色T (旁白 or 隱藏)"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'T'); setCtxMenu(null); }} />
                <ContextMenuItem icon={<span className={`w-3.5 h-3.5 rounded flex items-center justify-center font-bold text-[10px] ${lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'N' ? 'text-white bg-[var(--app-accent)]' : 'text-[var(--app-accent)]'}`}>N</span>} label={lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.style === 'N' ? "✓ 取消回歸預設" : "設為回歸預設N"} onClick={() => { handleSetWordStyle(ctxMenu.globalIndex, ctxMenu.wordIndex!, 'N'); setCtxMenu(null); }} />
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">繁</span>} label="這段字轉繁體" onClick={() => { handleWordConvertToTraditional(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <ContextMenuItem icon={<span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">簡</span>} label="這段字轉簡體" onClick={() => { handleWordConvertToSimplified(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<SplitSquareVertical className="w-3.5 h-3.5" />} label="從該字分割斷行到下一行" onClick={() => { handleSplitWordToNextLine(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <ContextMenuItem icon={<ArrowRight className="w-3.5 h-3.5" />} label="平移後續時間" onClick={() => { handleOffsetFromHere(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem danger icon={<Scissors className="w-3.5 h-3.5" />} label="刪除該段字" onClick={() => { handleDeleteWord(ctxMenu.globalIndex, ctxMenu.wordIndex!); setCtxMenu(null); }} />
              <div className="px-3 py-2 flex flex-col gap-0.5 border-t border-[var(--app-border-base)]/50 mb-1 pointer-events-none">
                 <div className="flex items-center justify-between gap-4">
                     <span className="text-[10px] text-[var(--app-text-muted)] font-bold uppercase tracking-widest">目前選擇的字</span>
                     <span className="text-[11px] font-mono text-[var(--app-text-muted)] opacity-60">
                         {lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.start !== null ? formatTime(lines[ctxMenu.globalIndex].words[ctxMenu.wordIndex!].start!, true) : '--:--.--'}
                     </span>
                 </div>
                 <span className="text-sm font-bold text-[var(--app-text-primary)] truncate max-w-[200px]">{lines[ctxMenu.globalIndex]?.words[ctxMenu.wordIndex!]?.text || '(無)'}</span>
              </div>
            </>
          )}

          {ctxMenu.type === 'time' && (
            <>
              <ContextMenuItem icon={<Play className="w-3.5 h-3.5" />} label="歌曲跳轉至該行開頭" onClick={() => { handleJumpTo(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<Clock className="w-3.5 h-3.5" />} label="複製時間戳" onClick={() => { navigator.clipboard.writeText(lines[ctxMenu.globalIndex].start !== null ? formatTime(lines[ctxMenu.globalIndex].start!) : ''); setCtxMenu(null); }} />
              <ContextMenuSeparator />
              <ContextMenuItem icon={<Edit2 className="w-3.5 h-3.5" />} label="編輯這行時間戳（手打輸入）" onClick={() => { handleEditTimeOnly(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <ContextMenuItem icon={<ArrowRight className="w-3.5 h-3.5" />} label="平移後續時間" onClick={() => { handleOffsetFromHere(ctxMenu.globalIndex); setCtxMenu(null); }} />
              <div className="px-3 py-2 flex flex-col gap-0.5 border-t border-[var(--app-border-base)]/50 mb-1 pointer-events-none">
                 <div className="flex items-center justify-between gap-4">
                     <span className="text-[10px] text-[var(--app-text-muted)] font-bold uppercase tracking-widest">時間戳操作</span>
                     <span className="text-[11px] font-mono text-[var(--app-text-muted)] opacity-60">
                         {lines[ctxMenu.globalIndex]?.start !== null ? formatTime(lines[ctxMenu.globalIndex].start!) : '--:--.--'}
                     </span>
                 </div>
              </div>
            </>
          )}
        </ContextMenu>
      )}

      <BaseDialog
        isOpen={editingText !== null}
        onClose={() => setEditingText(null)}
        title={editingText?.type === 'raw' ? '編輯這行字 RAW (含時間戳)' : '編輯這行字'}
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button 
              onClick={() => setEditingText(null)} 
              className="px-4 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors font-semibold"
            >
              取消
            </button>
            <button 
              onClick={() => {
                if (!editingText) return;
                commitLines(prev => {
                    const newLines = [...prev];
                    const currentLine = newLines[editingText.globalIndex];
                    const { parseRawLyrics, splitWordsAegisub } = require('@/lib/lyric-utils');
                    if (editingText.type === 'raw') {
                        const parsed = parseRawLyrics(editingText.text).lines[0];
                        newLines[editingText.globalIndex] = { ...currentLine, raw: editingText.text, words: parsed ? parsed.words : [] };
                    } else {
                        newLines[editingText.globalIndex] = { ...currentLine, raw: editingText.text, words: splitWordsAegisub(editingText.text), start: null };
                    }
                    return newLines;
                }, 'Edit Text');
                setEditingText(null);
              }}
              className="px-5 py-2 bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black rounded font-semibold text-xs transition-colors shadow-sm"
            >
              儲存
            </button>
          </>
        }
      >
        {editingText && (
          <div className="flex flex-col gap-3">
            <textarea 
              autoFocus
              style={{ fieldSizing: 'content' }}
              className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded-lg p-3 text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] min-h-[100px] resize-none font-mono text-sm leading-relaxed"
              value={editingText.text}
              onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
            />
            <div className="text-xs text-[var(--app-text-muted)] font-bold uppercase tracking-widest mt-2 px-1">拆字預覽</div>
            <div className="flex flex-wrap gap-1 p-3 bg-[var(--app-bg-input)] rounded-lg border border-[var(--app-border-light)] min-h-[3rem] items-center">
              {(() => {
                 const { parseRawLyrics, splitWordsAegisub } = require('@/lib/lyric-utils');
                 const words = editingText.type === 'raw' 
                     ? (parseRawLyrics(editingText.text).lines[0]?.words || [])
                     : splitWordsAegisub(editingText.text);
                 
                 if (words.length === 0) return <span className="opacity-50 text-xs text-[var(--app-text-muted)]">無內容</span>;
                 
                 return words.map((w: any, i: number) => (
                     <span key={i} className="px-2 py-0.5 bg-[var(--app-bg-panel-alt)] border border-[var(--app-border-dark)] rounded text-xs text-[var(--app-text-primary)] group relative font-mono">
                         {w.text || '⏎'}
                         {w.start !== null && <span className="absolute -top-2 -right-2 text-[8px] bg-[var(--app-accent)] text-black px-1 rounded font-bold">{formatTime(w.start, true)}</span>}
                     </span>
                 ));
              })()}
            </div>
          </div>
        )}
      </BaseDialog>

      <BaseDialog
        isOpen={ktvspDialog !== null}
        onClose={() => setKtvspDialog(null)}
        title="特殊作為段落開始 (ktvsp)"
        maxWidthClass="max-w-sm"
        footer={
          <>
            <button 
              onClick={() => {
                if (!ktvspDialog) return;
                commitLines(prev => {
                    const newLines = [...prev];
                    newLines[ktvspDialog.globalIndex] = { ...newLines[ktvspDialog.globalIndex], ktvsp: undefined };
                    return newLines;
                }, '清除 ktvsp');
                setKtvspDialog(null);
              }}
              className="px-4 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors mr-auto border border-[var(--app-border-base)]"
            >
              恢復預設 (清除)
            </button>
            <button 
              onClick={() => setKtvspDialog(null)} 
              className="px-4 py-2 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-bg-hover)] rounded transition-colors font-semibold"
            >
              取消
            </button>
            <button 
              onClick={() => {
                if (!ktvspDialog) return;
                const { parseSeconds } = require('@/lib/lyric-utils');
                const pSec = parseSeconds(ktvspDialog.text);
                if (typeof pSec === 'number' && !isNaN(pSec)) {
                    commitLines(prev => {
                        const newLines = [...prev];
                        newLines[ktvspDialog.globalIndex] = { ...newLines[ktvspDialog.globalIndex], ktvsp: pSec };
                        return newLines;
                    }, '設定 ktvsp');
                }
                setKtvspDialog(null);
              }}
              className="px-4 py-2 text-xs bg-[var(--app-accent)] text-black hover:bg-[var(--app-accent-hover)] rounded shadow-sm transition-colors font-semibold"
            >
              確定
            </button>
          </>
        }
      >
        {ktvspDialog && (
          <div className="flex flex-col gap-3">
             <p className="text-xs text-[var(--app-text-muted)]">
                 該段落將會強制作為新的段落顯示（無論上一句是何時），並於您指定的時間點提早開始淡入顯示。
             </p>
             <label className="text-xs font-bold text-[var(--app-text-secondary)]">提前顯示時間戳 (mm:ss.xx)</label>
             <input
               autoFocus
               type="text"
               className="w-full bg-[var(--app-bg-input)] border border-[var(--app-border-base)] rounded-lg p-2 text-[var(--app-text-primary)] outline-none focus:border-[var(--app-accent)] font-mono text-sm uppercase"
               value={ktvspDialog.text}
               onChange={(e) => setKtvspDialog({ ...ktvspDialog, text: e.target.value })}
               placeholder="例如: 01:23.45"
             />
          </div>
        )}
      </BaseDialog>

      <MultiSingerDialog isOpen={multiSingerDialogOpen} onClose={() => setMultiSingerDialogOpen(false)} />
    </div>
  );
}
