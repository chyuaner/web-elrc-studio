"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Tooltip({
  children,
  title,
  delay = 500,
}: {
  children: ReactNode;
  title: ReactNode;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        setCoords({
          top: rect.top,
          left: rect.left + rect.width / 2,
        });
        setIsVisible(true);
        // Auto dismiss after 5 seconds
        setTimeout(() => {
          setIsVisible(false);
        }, 5000);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={targetRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible &&
        createPortal(
          <div
            className="fixed z-[9999] px-2 py-1 text-[10px] uppercase font-mono font-bold rounded shadow-xl whitespace-nowrap pointer-events-none pointer-events-none -translate-x-1/2 -translate-y-[calc(100%+8px)]"
            style={{
              top: coords.top,
              left: coords.left,
              backgroundColor: "var(--app-text-primary)",
              color: "var(--app-bg-base)",
            }}
          >
            {title}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
              style={{ borderTopColor: "var(--app-text-primary)" }}
            ></div>
          </div>,
          document.body,
        )}
    </div>
  );
}
