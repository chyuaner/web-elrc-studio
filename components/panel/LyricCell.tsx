import React from 'react';
import { formatTime } from '@/lib/lyric-utils';
import { Tooltip } from '@/components/common/Tooltip';

const getCharWeight = (char: string): number => {
  // 英文字 [a-zA-Z] 或半角空格算 0.5 個字，其餘算 1.0 個字
  if (/^[a-zA-Z ]$/.test(char)) {
    return 0.5;
  }
  return 1.0;
};

const getWordWeightSum = (text: string): number => {
  let sum = 0;
  const t = text || '';
  for (let i = 0; i < t.length; i++) {
    sum += getCharWeight(t[i]);
  }
  return sum;
};

export function LyricCellContent({ 
  line, 
  globalIndex, 
  isActive, 
  activeWordIndex, 
  syncMode, 
  playerRef, 
  setActiveLineIndex, 
  setActiveWordIndex,
  actions,
  onLineContextMenu,
  onWordContextMenu,
  onTimeContextMenu
}: { 
  line: any, 
  globalIndex: number, 
  isActive: boolean, 
  activeWordIndex: number, 
  syncMode: 'line' | 'word', 
  playerRef: any,
  setActiveLineIndex: (idx: number) => void,
  setActiveWordIndex: (w: number) => void,
  actions?: React.ReactNode,
  onLineContextMenu?: (e: React.MouseEvent, globalIndex: number) => void,
  onWordContextMenu?: (e: React.MouseEvent, globalIndex: number, wordIndex: number) => void,
  onTimeContextMenu?: (e: React.MouseEvent, globalIndex: number) => void
}) {
  const isStamped = line.start !== null;

  return (
    <div className="flex w-full h-full p-2 gap-2 text-xs" onContextMenu={(e) => {
        if (onLineContextMenu) onLineContextMenu(e, globalIndex);
    }}>
      <div 
        className="w-16 font-mono text-[11px] hover:text-[var(--app-text-primary)] pt-1 shrink-0 cursor-pointer"
        onClick={(e) => {
           e.stopPropagation();
           const { current: player } = playerRef;
           if (player instanceof HTMLMediaElement && line.start !== null) {
              player.currentTime = line.start;
           }
        }}
        onContextMenu={(e) => {
           e.stopPropagation();
           if (onTimeContextMenu) onTimeContextMenu(e, globalIndex);
        }}
        title="Click to seek / Right click for options"
      >
        <span className={isStamped ? 'text-[var(--app-accent)]' : 'opacity-30'}>
           {isStamped ? formatTime(line.start) : '--:--.--'}
        </span>
      </div>
      
      <div className={`flex-1 leading-relaxed ${isActive ? 'font-medium' : ''}`}>
        {syncMode === 'line' ? (
          line.raw
         ) : (
          <div className="flex flex-wrap gap-x-1 gap-y-1">
            {(() => {
              let cumulativeLen = 0;
              return line.words && line.words.map((word: any, wIdx: number) => {
                const isWordActive = isActive && wIdx === activeWordIndex;
                const isWordStamped = word.start !== null;
                const wordLength = getWordWeightSum(word.text);
                const startsAtOrAfter15 = cumulativeLen >= 14;
                cumulativeLen += wordLength;
                
                const isRed = startsAtOrAfter15 && !isWordActive;

                return (
                  <Tooltip key={wIdx} title={word.start !== null ? formatTime(word.start) : 'Not synced'} delay={50}>
                    <span 
                      className={`
                        px-1 py-0.5 rounded transition-all select-none
                        ${isWordActive ? 'bg-[var(--app-accent)] text-black font-bold ring-2 ring-[var(--app-accent)]/50 cursor-pointer' : 'cursor-pointer'}
                        ${isWordStamped && !isWordActive ? (isRed ? 'text-red-500 font-bold bg-red-500/10 border border-red-500/30' : 'text-[var(--app-accent)] bg-[var(--app-border-base)]') : ''}
                        ${!isWordStamped && !isWordActive ? (isRed ? 'text-red-500 font-bold bg-red-500/10 border border-red-500/20' : 'text-[var(--app-text-muted)] bg-[var(--app-bg-panel)]') : ''}
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLineIndex(globalIndex);
                        setActiveWordIndex(wIdx);
                        const { current: player } = playerRef;
                        if (player instanceof HTMLMediaElement && word.start !== null) {
                           player.currentTime = word.start;
                        }
                      }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        if (onWordContextMenu) onWordContextMenu(e, globalIndex, wIdx);
                      }}
                    >
                      {word.text || '⏎'}
                    </span>
                  </Tooltip>
                )
              })
            })()}
          </div>
        )}
      </div>
      {actions && (
        <div 
          className="shrink-0 flex items-start justify-end gap-1 pt-1 opacity-70 hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
        >
           {actions}
        </div>
      )}
    </div>
  );
}
