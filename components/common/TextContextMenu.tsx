"use client";

import { useEditor } from "@/components/base/EditorProvider";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/common/ContextMenu";
import { ClipboardPaste, Copy, ListChecks, Scissors, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function TextContextMenu() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isReadOnly, setIsReadOnly] = useState(false);
  const targetElementRef = useRef<HTMLElement | null>(null);
  const { touchUIMode, mode } = useEditor();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // 在觸控模式或行動裝置下，不攔截原生的長按選單
      if (touchUIMode || window.matchMedia("(pointer: coarse)").matches) {
        return;
      }

      const target = e.target as HTMLElement;

      // 當在非觸控模式時，阻擋預設的右鍵選單
      e.preventDefault();

      const isReadonlyElement =
        target.closest('[data-context-menu="readonly"]') !== null ||
        (target.tagName === "TEXTAREA" && (target as HTMLTextAreaElement).readOnly) ||
        (target.tagName === "INPUT" && (target as HTMLInputElement).readOnly);

      const isEditableInput =
        !isReadonlyElement &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            ((target as HTMLInputElement).type === "text" ||
              (target as HTMLInputElement).type === "number")) ||
          target.isContentEditable);

      if (isEditableInput || target.closest('[data-context-menu="readonly"]')) {
        targetElementRef.current = (target.closest('[data-context-menu="readonly"]') ||
          target) as HTMLElement;
        setIsReadOnly(isReadonlyElement);

        let x = e.clientX;
        let y = e.clientY;

        // Ensure menu doesn't go off-screen
        if (x + 150 > window.innerWidth) x = window.innerWidth - 150;
        if (y + 150 > window.innerHeight) y = window.innerHeight - 150;

        setPosition({ x, y });
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [touchUIMode]);

  const handleAction = async (
    action:
      | "cut"
      | "copy"
      | "paste"
      | "selectAll"
      | "toTraditional"
      | "toSimplified"
      | "search"
      | "searchIgnoreTags",
  ) => {
    setVisible(false);

    if (action === "search" || action === "searchIgnoreTags") {
      const selectedText = window.getSelection()?.toString() || "";
      const event = new CustomEvent("context-menu-search", {
        detail: { text: selectedText, ignoreTimeTags: action === "searchIgnoreTags" },
      });
      window.dispatchEvent(event);
      return;
    }

    const targetElement = targetElementRef.current;
    if (!targetElement) return;

    targetElement.focus();

    try {
      if (action === "toTraditional" || action === "toSimplified") {
        const el = targetElement as HTMLInputElement | HTMLTextAreaElement;
        const { convertToTraditional, convertToSimplified } = await import("@/lib/chinese-conv");
        const isInputOrTextarea =
          targetElement.tagName === "TEXTAREA" || targetElement.tagName === "INPUT";

        if (isInputOrTextarea) {
          const start = el.selectionStart || 0;
          const end = el.selectionEnd || 0;
          const val = el.value;
          let textToConvert = val;
          let convertAll = false;

          if (start === end) {
            textToConvert = val;
            convertAll = true;
            el.select(); // Select all so execCommand replaces everything
          } else {
            textToConvert = val.slice(start, end);
          }

          const convertedText =
            action === "toTraditional"
              ? convertToTraditional(textToConvert)
              : convertToSimplified(textToConvert);

          if (!document.execCommand("insertText", false, convertedText)) {
            if (convertAll) {
              el.value = convertedText;
              el.selectionStart = el.selectionEnd = convertedText.length;
            } else {
              el.value = val.slice(0, start) + convertedText + val.slice(end);
              el.selectionStart = el.selectionEnd = start + convertedText.length;
            }
            const event = new Event("input", { bubbles: true });
            el.dispatchEvent(event);
          }
        }
      } else if (action === "cut") {
        const selectedText = window.getSelection()?.toString();
        if (selectedText) {
          await navigator.clipboard.writeText(selectedText);
          document.execCommand("delete"); // fallback for removing text if cut not supported
        } else {
          document.execCommand("cut");
        }
      } else if (action === "copy") {
        const selectedText = window.getSelection()?.toString();
        if (selectedText) {
          await navigator.clipboard.writeText(selectedText);
        } else {
          document.execCommand("copy");
        }
      } else if (action === "paste") {
        const text = await navigator.clipboard.readText();
        if (text) {
          // If we have text, we use execCommand to preserve undo/redo history
          if (!document.execCommand("insertText", false, text)) {
            // Fallback for some browsers where execCommand is restricted
            if (targetElement.tagName === "TEXTAREA" || targetElement.tagName === "INPUT") {
              const el = targetElement as HTMLInputElement | HTMLTextAreaElement;
              const start = el.selectionStart || 0;
              const end = el.selectionEnd || 0;
              const val = el.value;
              el.value = val.slice(0, start) + text + val.slice(end);
              el.selectionStart = el.selectionEnd = start + text.length;

              // Dispatch input event to notify React
              const event = new Event("input", { bubbles: true });
              el.dispatchEvent(event);
            }
          }
        }
      } else if (action === "selectAll") {
        if (targetElement.tagName === "TEXTAREA" || targetElement.tagName === "INPUT") {
          (targetElement as HTMLInputElement | HTMLTextAreaElement).select();
        } else {
          const range = document.createRange();
          range.selectNodeContents(targetElement);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
    } catch (e) {
      // Fallback for execution restrictions
      console.error("Clipboard action failed", e);
    }
  };

  if (!visible) return null;

  return (
    <ContextMenu x={position.x} y={position.y} onClose={() => setVisible(false)}>
      <ContextMenuItem
        onClick={() => handleAction("cut")}
        disabled={isReadOnly}
        icon={<Scissors className="w-3.5 h-3.5" />}
        label="剪下"
      />
      <ContextMenuItem
        onClick={() => handleAction("copy")}
        icon={<Copy className="w-3.5 h-3.5" />}
        label="複製"
      />
      <ContextMenuItem
        onClick={() => handleAction("paste")}
        disabled={isReadOnly}
        icon={<ClipboardPaste className="w-3.5 h-3.5" />}
        label="貼上"
      />
      {(mode === "text" || mode === "raw") && (
        <>
          <ContextMenuItem
            onClick={() => handleAction("search")}
            icon={<Search className="w-3.5 h-3.5" />}
            label="搜尋"
          />
          <ContextMenuItem
            onClick={() => handleAction("searchIgnoreTags")}
            icon={<Search className="w-3.5 h-3.5" />}
            label="搜尋 (無視時間標籤)"
          />
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => handleAction("selectAll")}
        icon={<ListChecks className="w-3.5 h-3.5" />}
        label="全選"
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => handleAction("toTraditional")}
        disabled={isReadOnly}
        icon={
          <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">
            繁
          </span>
        }
        label="轉成繁體"
      />
      <ContextMenuItem
        onClick={() => handleAction("toSimplified")}
        disabled={isReadOnly}
        icon={
          <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">
            簡
          </span>
        }
        label="轉成簡體"
      />
    </ContextMenu>
  );
}
