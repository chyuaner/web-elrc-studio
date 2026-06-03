"use client";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const invokeTauri = async (cmd: string, args?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && (window as any).__TAURI__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke(cmd, args);
    } catch (e) {
      console.error(e);
    }
  }
};

export interface BaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  className?: string;
  closeOnOverlayClick?: boolean;
}

export function BaseDialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-xl",
  className = "",
  closeOnOverlayClick = true,
}: BaseDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      invokeTauri("set_titlebar_buttons_enabled", { enabled: false });
    } else {
      invokeTauri("set_titlebar_buttons_enabled", { enabled: true });
    }
    return () => {
      invokeTauri("set_titlebar_buttons_enabled", { enabled: true });
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const dialogContent = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4 app-region-no-drag font-sans"
      style={{
        paddingLeft: "max(1rem, var(--app-safe-area-left))",
        paddingRight: "max(1rem, var(--app-safe-area-right))",
        paddingTop: "max(1rem, var(--app-safe-area-top))",
        paddingBottom: "max(1rem, var(--app-safe-area-bottom))",
      }}
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded-xl shadow-2xl w-full ${maxWidthClass} max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border-base)] bg-[var(--app-bg-panel-alt)] shrink-0 select-none">
          <div className="text-sm sm:text-base font-bold text-[var(--app-text-primary)] flex items-center gap-2">
            {title}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--app-text-muted)] hover:text-[var(--app-text-primary)] p-1.5 rounded-full hover:bg-[var(--app-bg-hover)] transition-colors"
            title="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0">{children}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-[var(--app-border-base)] flex justify-end shrink-0 gap-3 bg-[var(--app-bg-panel-alt)] rounded-b-xl select-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
}
