import React, { useEffect, useRef } from "react";

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  startLineNumber?: number;
}

export const LineNumberedTextarea = React.forwardRef<HTMLTextAreaElement, Props>(
  ({ value, className, onChange, startLineNumber = 1, ...props }, ref) => {
    const lineNumRef = useRef<HTMLDivElement>(null);
    const internalRef = useRef<HTMLTextAreaElement>(null);

    const linesCount = value.split("\n").length;
    const linesArr = Array.from({ length: Math.max(1, linesCount) }, (_, i) => i + startLineNumber);

    const handleScroll = () => {
      if (internalRef.current && lineNumRef.current) {
        lineNumRef.current.scrollTop = internalRef.current.scrollTop;
      }
    };

    const [isResponsiveTall, setIsResponsiveTall] = React.useState(false);

    useEffect(() => {
      const handleResize = () => {
        setIsResponsiveTall(window.innerWidth >= 1024 || window.innerHeight > 1110);
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
      if (internalRef.current) {
        if (!isResponsiveTall) {
          // Auto-resize textarea to prevent inner scrollbars on mobile tall screens
          internalRef.current.style.height = "auto";
          internalRef.current.style.height = `${internalRef.current.scrollHeight}px`;
        } else {
          // Restore default height
          internalRef.current.style.height = "100%";
        }
      }
    }, [value, isResponsiveTall]);

    const setRefs = (el: HTMLTextAreaElement) => {
      internalRef.current = el;
      if (typeof ref === "function") {
        ref(el);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement>).current = el;
      }
    };

    return (
      <div
        className={`flex w-full relative overflow-hidden bg-[var(--app-bg-input)] rounded border border-[var(--app-border-light)] ${isResponsiveTall ? "h-full flex-1" : ""} ${className}`}
      >
        <div
          ref={lineNumRef}
          className="w-12 shrink-0 py-4 select-none flex flex-col items-end px-2 sm:px-3 text-sm font-mono text-[var(--app-text-muted)] bg-[var(--app-bg-panel-alt)] border-r border-[var(--app-border-base)] overflow-hidden"
        >
          {/* We add extra padding-bottom to match the textarea scroll height padding if needed */}
          <div style={{ paddingBottom: "20vh" }}>
            {linesArr.map((num) => (
              <div key={num} className="leading-relaxed opacity-60">
                {num}
              </div>
            ))}
          </div>
        </div>
        <textarea
          ref={setRefs}
          value={value}
          onChange={onChange}
          onScroll={handleScroll}
          className="flex-1 w-full py-4 px-4 bg-transparent outline-none font-mono text-sm leading-relaxed resize-none custom-scrollbar whitespace-pre"
          wrap="off"
          {...props}
        />
      </div>
    );
  },
);

LineNumberedTextarea.displayName = "LineNumberedTextarea";
