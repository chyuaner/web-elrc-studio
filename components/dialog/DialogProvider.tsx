"use client";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { BaseDialog } from "./BaseDialog";

type DialogContextType = {
  alert: (msg: string) => Promise<void>;
  confirm: (msg: string) => Promise<boolean>;
  prompt: (msg: string, defaultVal?: string) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextType | null>(null);

// Safely call Tauri's invoke only in a Tauri context
const invokeTauri = async (cmd: string, args?: Record<string, unknown>) => {
  if (typeof window === "undefined") return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(cmd, args);
  } catch {
    // Not in Tauri context or command not found — silently ignore
  }
};

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialogs must be used within DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{ msg: string; resolve: () => void } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    msg: string;
    resolve: (val: boolean) => void;
  } | null>(null);
  const [promptState, setPromptState] = useState<{
    msg: string;
    defaultVal: string;
    resolve: (val: string | null) => void;
  } | null>(null);
  const [promptInput, setPromptInput] = useState("");

  // Whenever a dialog opens or closes, sync the Linux GTK titlebar button sensitivity.
  // On non-Linux or non-Tauri platforms this is a no-op (invokeTauri handles that gracefully).
  useEffect(() => {
    const dialogOpen = alertState !== null || confirmState !== null || promptState !== null;
    invokeTauri("set_titlebar_buttons_enabled", { enabled: !dialogOpen });
  }, [alertState, confirmState, promptState]);

  const alert = (msg: string) => {
    return new Promise<void>((resolve) => {
      setAlertState({ msg, resolve });
    });
  };

  const confirm = (msg: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ msg, resolve });
    });
  };

  const prompt = (msg: string, defaultVal = "") => {
    return new Promise<string | null>((resolve) => {
      setPromptInput(defaultVal);
      setPromptState({ msg, defaultVal, resolve });
    });
  };

  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve();
      setAlertState(null);
    }
  };

  const handleConfirmClose = (val: boolean) => {
    if (confirmState) {
      confirmState.resolve(val);
      setConfirmState(null);
    }
  };

  const handlePromptClose = (submit: boolean) => {
    if (promptState) {
      promptState.resolve(submit ? promptInput : null);
      setPromptState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}

      {/* Alert Modal */}
      <BaseDialog
        isOpen={alertState !== null}
        onClose={handleAlertClose}
        title="系統提示"
        maxWidthClass="max-w-sm"
        closeOnOverlayClick={false}
      >
        <p className="text-[var(--app-text-secondary)] mb-6 whitespace-pre-wrap text-sm leading-relaxed">
          {alertState?.msg}
        </p>
        <div className="flex justify-end">
          <button
            onClick={handleAlertClose}
            className="px-5 py-2 rounded bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black font-semibold text-xs transition-colors"
          >
            確定
          </button>
        </div>
      </BaseDialog>

      {/* Confirm Modal */}
      <BaseDialog
        isOpen={confirmState !== null}
        onClose={() => handleConfirmClose(false)}
        title="確認動作"
        maxWidthClass="max-w-sm"
        closeOnOverlayClick={false}
      >
        <p className="text-[var(--app-text-secondary)] mb-6 whitespace-pre-wrap text-sm leading-relaxed">
          {confirmState?.msg}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handleConfirmClose(false)}
            className="px-4 py-2 rounded text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-border-base)] font-semibold transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => handleConfirmClose(true)}
            className="px-5 py-2 rounded bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black font-semibold text-xs transition-colors"
          >
            確認
          </button>
        </div>
      </BaseDialog>

      {/* Prompt Modal */}
      <BaseDialog
        isOpen={promptState !== null}
        onClose={() => handlePromptClose(false)}
        title="請輸入"
        maxWidthClass="max-w-sm"
        closeOnOverlayClick={false}
      >
        <p className="text-[var(--app-text-secondary)] mb-4 text-sm leading-relaxed">
          {promptState?.msg}
        </p>
        <input
          type="text"
          autoFocus
          className="w-full bg-[var(--app-bg-base)] border border-[var(--app-border-base)] rounded p-2 text-[var(--app-text-primary)] mb-6 outline-none focus:border-[var(--app-accent)] transition-colors font-mono text-xs"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handlePromptClose(true);
            if (e.key === "Escape") handlePromptClose(false);
          }}
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handlePromptClose(false)}
            className="px-4 py-2 rounded text-xs text-[var(--app-text-secondary)] hover:bg-[var(--app-border-base)] font-semibold transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => handlePromptClose(true)}
            className="px-5 py-2 rounded bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)] text-black font-semibold text-xs transition-colors"
          >
            確認
          </button>
        </div>
      </BaseDialog>
    </DialogContext.Provider>
  );
}
