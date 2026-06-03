"use client";

import { EditorView } from "@/components/layout/EditorView";
import { LeftPanelInfo } from "@/components/panel/LeftPanelInfo";
import { MediaPlayer } from "@/components/panel/MediaPlayer";
import React, { useEffect, useRef, useState } from "react";

export function ResizableLayout() {
  const [leftWidth, setLeftWidth] = useState(380);
  const [isMobile, setIsMobile] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const isDragging = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsTall(window.innerHeight > 1110);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startDragging = (e: React.PointerEvent) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.classList.add("is-dragging-resizer");
  };

  const stopDragging = (e?: globalThis.PointerEvent) => {
    isDragging.current = false;
    document.body.style.cursor = "default";
    document.body.classList.remove("is-dragging-resizer");
  };

  const onDrag = (e: globalThis.PointerEvent) => {
    if (!isDragging.current) return;
    const newWidth = e.clientX;
    if (newWidth > 200 && newWidth < window.innerWidth - 200) {
      setLeftWidth(newWidth);
    }
  };

  useEffect(() => {
    window.addEventListener("pointermove", onDrag);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  return (
    <div
      id="main-scroll-container"
      className={`flex-1 flex flex-col lg:flex-row lg:overflow-hidden border-t border-[var(--app-border-base)] relative ${isMobile && !isTall ? "overflow-y-auto custom-scrollbar" : "overflow-hidden"}`}
    >
      {/* Left side: Media Player Component and Info Tabs */}
      <div
        style={isMobile ? undefined : { width: `${leftWidth}px`, minWidth: `${leftWidth}px` }}
        className={
          isMobile && !isTall
            ? "contents"
            : "flex flex-col lg:border-r border-[var(--app-border-base)] bg-[var(--app-bg-panel-alt)] shrink-0 w-full lg:w-auto z-40 lg:h-full lg:overflow-visible relative"
        }
      >
        <div
          className={
            isMobile && !isTall
              ? "contents"
              : "bg-[var(--app-bg-input)] lg:border-b border-[var(--app-border-base)] p-0 flex flex-col justify-center shrink-0"
          }
        >
          <MediaPlayer />
        </div>
        {!isMobile && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <LeftPanelInfo />
          </div>
        )}
      </div>

      {/* Resizer */}
      {!isMobile && (
        <div
          onPointerDown={startDragging}
          className="w-[8px] bg-transparent hover:bg-[var(--app-accent)] cursor-col-resize z-50 flex items-center justify-center transition-colors group mx-[-4px] touch-none"
        >
          <div className="w-0.5 h-8 bg-[var(--app-border-base)] group-hover:bg-[var(--app-text-primary)] text-[var(--app-bg-base)] rounded-full" />
        </div>
      )}

      {/* Right side: Editor View */}
      <div
        className={
          isMobile && !isTall
            ? "contents"
            : "flex-1 h-full flex flex-col bg-[var(--app-bg-base)] overflow-hidden min-w-0 relative z-30 lg:w-auto w-full"
        }
      >
        <EditorView />
      </div>
    </div>
  );
}
