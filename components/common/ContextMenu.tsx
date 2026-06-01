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
        const rect = el.getBoundingClientRect();
        if (y + rect.height > window.innerHeight) {
            el.style.top = 'auto';
            el.style.bottom = `${window.innerHeight - y}px`;
        } else {
            el.style.top = `${y}px`;
            el.style.bottom = 'auto';
        }
        if (x + rect.width > window.innerWidth) {
            el.style.left = 'auto';
            el.style.right = '10px';
        } else {
            el.style.left = `${x}px`;
            el.style.right = 'auto';
        }
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-[9999] bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded-lg shadow-lg py-1 min-w-[200px] text-xs text-[var(--app-text-primary)] ${className}`}
      style={{ visibility: 'visible', left: x, top: y }}
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
