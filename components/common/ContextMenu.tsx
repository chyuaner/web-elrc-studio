import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ContextMenu({ x, y, onClose, children, className = "" }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (el) {
      // Temporary style resets to get accurate auto-measurements
      el.style.maxHeight = '';
      el.style.overflowY = '';
      el.style.top = '0px';
      el.style.left = '0px';
      el.style.bottom = 'auto';
      el.style.right = 'auto';
      
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      let finalMaxHeight = '';
      let finalOverflowY = '';
      let menuHeight = rect.height;
      let menuWidth = rect.width;
      
      // If the menu height exceeds the viewport, constrain it so it's scrollable
      if (menuHeight > viewportHeight - 20) {
        finalMaxHeight = `${viewportHeight - 20}px`;
        finalOverflowY = 'auto';
        menuHeight = viewportHeight - 20;
      }
      
      // Calculate top
      let finalTop = y;
      if (y + menuHeight > viewportHeight - 10) {
        if (y - menuHeight >= 10) {
          finalTop = y - menuHeight;
        } else {
          // If it fits neither above nor below, find the position with the most space, 
          // or just clamp it to stay perfectly centered/bounded within viewport edges
          finalTop = Math.max(10, viewportHeight - menuHeight - 10);
        }
      }
      finalTop = Math.max(10, finalTop);
      
      // Calculate left
      let finalLeft = x;
      if (x + menuWidth > viewportWidth - 10) {
        if (x - menuWidth >= 10) {
          finalLeft = x - menuWidth;
        } else {
          finalLeft = Math.max(10, viewportWidth - menuWidth - 10);
        }
      }
      finalLeft = Math.max(10, finalLeft);
      
      // Apply styles
      if (finalMaxHeight) el.style.maxHeight = finalMaxHeight;
      if (finalOverflowY) el.style.overflowY = finalOverflowY;
      el.style.top = `${finalTop}px`;
      el.style.left = `${finalLeft}px`;
      el.style.visibility = 'visible';
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-[9999] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded-lg shadow-lg py-1 min-w-[200px] text-xs text-[var(--app-text-primary)] ${className}`}
      style={{ visibility: 'hidden' }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {children}
    </div>
  );
}

export interface ContextMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

export function ContextMenuItem({ icon, label, children, danger, rightElement, className = "", ...props }: ContextMenuItemProps) {
  return (
    <button
      {...props}
      className={`w-full text-left px-3 py-1.5 hover:bg-[var(--app-bg-hover)] transition-colors flex items-center justify-between gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'text-red-500' : ''} ${className}`}
    >
      <div className="flex items-center gap-2 max-w-full overflow-hidden">
        {icon}
        {label || children}
      </div>
      {rightElement}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="h-px bg-[var(--app-border-base)] my-1"></div>;
}

export function ContextMenuSub({ label, icon, children }: { label: React.ReactNode, icon?: React.ReactNode, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popDirection, setPopDirection] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const anticipatedRight = rect.right + 200; // estimated width of submenu (200px)
      if (anticipatedRight > window.innerWidth) {
        setPopDirection('left');
      } else {
        setPopDirection('right');
      }
    }
  }, [isOpen]);
  
  return (
    <div 
      ref={containerRef}
      className="w-full relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div
        className="w-full text-left px-3 py-1.5 hover:bg-[var(--app-bg-hover)] transition-colors flex items-center justify-between gap-2 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <div className="flex items-center gap-2 max-w-full overflow-hidden">
          {icon}
          {label}
        </div>
        <span className={`text-xs opacity-50 transition-transform md:rotate-0 ${isOpen ? 'rotate-90' : ''}`}>▶</span>
      </div>
      {isOpen && (
        <>
          {/* Mobile design: accordion-style fold */}
          <div className="md:hidden w-full bg-[var(--app-bg-hover)]/30 py-1 flex flex-col border-y border-[var(--app-border-base)]">
            {children}
          </div>
          
          {/* Desktop/Tablet design: elegant side-by-side flyout */}
          <div 
            className={`hidden md:flex absolute top-0 z-[10000] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded-lg shadow-lg py-1 min-w-[200px] flex-col ${
              popDirection === 'left' ? 'right-full mr-1' : 'left-full ml-1'
            }`}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
