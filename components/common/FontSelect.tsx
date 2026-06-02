'use client';
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Download, Info } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface FontInfo {
  id: string;
  displayName: string;
  systemName: string;
  filename: string;
  license: string;
  officialUrl: string;
  disabled?: boolean;
  sizeOffset?: number;
}

interface FontSelectProps {
  value: string;
  onChange: (value: string, font?: FontInfo) => void;
  className?: string;
}

export function FontSelect({ value, onChange, className }: FontSelectProps) {
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [infoModalFont, setInfoModalFont] = useState<FontInfo | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    fetch('/api/fonts')
      .then(r => r.json())
      .then(data => setFonts(data))
      .catch(e => console.error("Could not load fonts from API", e));
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideInput = containerRef.current && containerRef.current.contains(target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      if (!isInsideInput && !isInsideDropdown) {
         setIsOpen(false);
      }
    };
    if (isOpen) {
       document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
        });
      }
    };

    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-[120px] ${className || ''}`}>
       {/* Dynamic Style for offline preview */}
       {mounted && fonts.length > 0 && (
         <style>{
           fonts.filter(f => f.filename).map(f => `
             @font-face {
               font-family: '${f.systemName}';
               src: url('/fonts/${f.filename}');
               font-display: swap;
             }
           `).join('\n')
         }</style>
       )}

       <div className="flex relative items-center h-full">
          <input
             type="text"
             value={value}
             onChange={e => {
                 const newFamily = e.target.value;
                 const matchedFont = fonts.find(f => f.systemName === newFamily);
                 onChange(newFamily, matchedFont);
             }}
             onFocus={() => setIsOpen(true)}
             placeholder="輸入系統字體或選擇"
             className="w-full bg-[var(--app-bg-panel)] border border-[var(--app-border-input)] rounded px-2 py-1 pr-6 focus:outline-none focus:border-[var(--app-accent)] text-xs h-full"
          />
          <button
             type="button"
             onClick={() => setIsOpen(!isOpen)}
             className="absolute right-1 p-0.5 text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] transition-colors"
             title="選擇提供字體"
          >
             <ChevronDown size={14} />
          </button>
       </div>

       {isOpen && mounted && createPortal(
         <div 
           ref={dropdownRef}
           className="fixed max-h-60 overflow-y-auto bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[99999] flex flex-col py-1 text-xs outline outline-1 outline-[rgba(0,0,0,0.1)] font-sans animate-in fade-in duration-100"
           style={{
             top: `${coords.top}px`,
             left: `${coords.left}px`,
             width: `${coords.width}px`,
           }}
         >
            {fonts.filter(font => !font.disabled).map(font => (
              <div key={font.id}
                   className="flex items-center justify-between px-2 py-2 hover:bg-[var(--app-hover-active)] transition-colors cursor-pointer group animate-in fade-in duration-75"
                   onClick={() => {
                      onChange(font.systemName, font);
                      setIsOpen(false);
                   }}
              >
                 <div className="flex flex-col flex-1 truncate pr-1">
                    {/* 預覽: fallback sans-serif 保底 */}
                    <span style={{ fontFamily: '"' + font.systemName + '", sans-serif' }} className="text-[13px] truncate mb-0.5 select-none flex items-center gap-1.5" title={font.displayName}>
                       {font.displayName}
                       {font.filename ? (
                           <span className="text-[8px] bg-[var(--app-accent)]/10 text-[var(--app-accent)] px-1 py-0.5 rounded leading-none">內建/可下載</span>
                       ) : (
                           <span className="text-[8px] bg-[var(--app-text-muted)]/10 text-[var(--app-text-secondary)] px-1 py-0.5 rounded leading-none">系統字體</span>
                       )}
                    </span>
                    <span className="text-[9px] text-[var(--app-text-muted)] truncate">{font.systemName}</span>
                 </div>

                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                    {/* Details button (Info Modal) */}
                    <button
                      type="button"
                      title="詳細資訊"
                      onClick={e => {
                         e.stopPropagation();
                         setInfoModalFont(font);
                      }}
                      className="p-1 text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-bg-hover)] rounded">
                      <Info size={14} />
                    </button>
                    {/* Download button */}
                    {font.filename && (
                      <a href={'/fonts/' + font.filename} download title="下載本機字體檔"
                         onClick={e => e.stopPropagation()}
                         className="p-1 text-[var(--app-text-secondary)] hover:text-[var(--app-accent)] hover:bg-[var(--app-bg-hover)] rounded flex items-center justify-center">
                         <Download size={14} />
                      </a>
                    )}
                 </div>
              </div>
            ))}
            {fonts.length === 0 && (
              <div className="px-2 py-4 text-[10px] text-[var(--app-text-muted)] text-center">
                 沒有讀取到字體
              </div>
            )}
         </div>,
         document.body
       )}

       {/* Info Modal Portal */}
       {mounted && infoModalFont && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 font-sans" onClick={() => setInfoModalFont(null)}>
             <div className="bg-[var(--app-bg-base)] p-5 rounded-lg shadow-2xl max-w-[320px] w-full flex flex-col gap-4 border border-[var(--app-border-light)]" onClick={e => e.stopPropagation()}>
                 <div className="flex items-center gap-2 mb-1">
                    <Info size={18} className="text-[var(--app-accent)]" />
                    <h3 className="text-sm font-semibold text-[var(--app-text-primary)]">字體詳細資訊</h3>
                 </div>
                 <div className="flex flex-col gap-2 text-xs">
                     <div className="flex"><span className="text-[var(--app-text-muted)] w-[65px] shrink-0">顯示名稱:</span> <span className="text-[var(--app-text-primary)] font-medium break-all">{infoModalFont.displayName}</span></div>
                     <div className="flex"><span className="text-[var(--app-text-muted)] w-[65px] shrink-0">系統名稱:</span> <span className="text-[var(--app-text-primary)] font-mono break-all">{infoModalFont.systemName}</span></div>
                     {infoModalFont.filename ? (
                        <div className="flex"><span className="text-[var(--app-text-muted)] w-[65px] shrink-0">預期檔名:</span> <span className="text-[var(--app-text-primary)] break-all">{infoModalFont.filename}</span></div>
                     ) : (
                        <div className="flex"><span className="text(--app-text-muted)] w-[65px] shrink-0">標籤屬性:</span> <span className="text-[var(--app-text-primary)] break-all">作業系統內置字體</span></div>
                     )}
                     <div className="flex"><span className="text-[var(--app-text-muted)] w-[65px] shrink-0">授權方式:</span> <span className="text-[var(--app-text-primary)] break-all">{infoModalFont.license}</span></div>
                 </div>
                 <div className="flex justify-end gap-2 mt-2">
                     {infoModalFont.officialUrl && (
                          <a href={infoModalFont.officialUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-medium text-[var(--app-text-primary)] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded hover:bg-[var(--app-active)] transition-colors">
                              字體來源
                          </a>
                     )}
                     <button onClick={() => setInfoModalFont(null)} className="px-3 py-1.5 text-xs font-medium bg-[var(--app-accent)] text-white rounded hover:opacity-90 transition-opacity">
                          確認關閉
                     </button>
                 </div>
             </div>
          </div>,
          document.body
       )}
    </div>
  )
}
