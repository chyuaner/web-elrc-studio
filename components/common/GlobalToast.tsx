"use client";
import { useEditor } from "@/components/base/EditorProvider";
import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function GlobalToast() {
  const { toastMessage } = useEditor();

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none p-4">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="bg-black/75 dark:bg-black/85 backdrop-blur-xl text-white min-w-[200px] max-w-[320px] px-8 py-6 min-h-[160px] rounded-[24px] shadow-2xl pointer-events-auto flex flex-col items-center justify-center gap-4"
          >
            <Check className="w-10 h-10" />
            <span className="text-[14px] font-medium tracking-wide text-center leading-snug">
              {toastMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
