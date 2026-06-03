"use client";
import { LrcMetadataEditor } from "@/components/panel/LrcMetadataEditor";
import { BaseDialog } from "./BaseDialog";

export function LrcMetadataDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <BaseDialog
      isOpen={isOpen}
      onClose={onClose}
      title="LRC屬性 (LRC Metadata)"
      maxWidthClass="max-w-xl"
    >
      <div className="overflow-hidden flex-1 flex flex-col">
        <LrcMetadataEditor onClose={onClose} />
      </div>
    </BaseDialog>
  );
}
