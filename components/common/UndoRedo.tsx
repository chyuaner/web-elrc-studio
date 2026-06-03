"use client";

import { useEditor } from "@/components/base/EditorProvider";
import { ChevronDown, Redo2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function UndoRedoDropdown({
  label,
  icon: Icon,
  action,
  count,
  type,
  actionsList,
}: {
  label: string;
  icon: any;
  action: (n: number) => void;
  count: number;
  type: "undo" | "redo";
  actionsList: { action: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center h-full" ref={ref}>
      <button
        type="button"
        className="px-2 h-full bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-l text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-[var(--app-border-base)] border border-[var(--app-border-light)] border-r-0 flex items-center justify-center transition-colors"
        onClick={() => {
          action(1);
          setOpen(false);
        }}
        disabled={count === 0}
        title={label}
      >
        <Icon className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="px-1 h-full bg-[var(--app-border-base)] hover:bg-[var(--app-bg-hover)] rounded-r text-[var(--app-text-secondary)] disabled:opacity-30 disabled:hover:bg-[var(--app-border-base)] border border-[var(--app-border-light)] flex items-center justify-center transition-colors"
        onClick={() => setOpen(!open)}
        disabled={count === 0}
      >
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--app-bg-panel)] border border-[var(--app-border-base)] rounded shadow-xl z-[9999] overflow-hidden py-1">
          {Array.from({ length: Math.min(count, 15) }, (_, i) => i + 1).map((n) => {
            // For undo, list from latest to earliest (end of array backwards)
            // For redo, list from earliest to latest (start of array forwards)
            const item = type === "undo" ? actionsList[actionsList.length - n] : actionsList[n - 1];
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  action(n);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-accent)] hover:text-black transition-colors flex justify-between gap-2"
              >
                <span className="truncate flex-1">
                  {type === "undo" ? "Undo" : "Redo"} {item?.action}
                </span>
                <span className="font-mono text-[10px] opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function UndoRedoControls() {
  const { undo, redo, pastCount, futureCount, pastActions, futureActions } = useEditor();

  return (
    <div className="flex items-center gap-1 h-[30px]">
      <UndoRedoDropdown
        label="Undo (Ctrl+Z)"
        icon={Undo2}
        action={undo}
        count={pastCount}
        type="undo"
        actionsList={pastActions}
      />
      <UndoRedoDropdown
        label="Redo (Ctrl+Y)"
        icon={Redo2}
        action={redo}
        count={futureCount}
        type="redo"
        actionsList={futureActions}
      />
    </div>
  );
}
