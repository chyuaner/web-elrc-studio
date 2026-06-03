import { CliExportHandler } from "@/components/base/CliExportHandler";
import { EditorProvider } from "@/components/base/EditorProvider";
import { OpenAssociatedFileHandler } from "@/components/base/OpenAssociatedFileHandler";
import { WebSystemIntegration } from "@/components/base/WebSystemIntegration";
import { GlobalToast } from "@/components/common/GlobalToast";
import { TextContextMenu } from "@/components/common/TextContextMenu";
import { DialogProvider } from "@/components/dialog/DialogProvider";
import { ResizableLayout } from "@/components/layout/ResizableLayout";
import { TopToolbar } from "@/components/layout/TopToolbar";

export default function Page() {
  return (
    <DialogProvider>
      <WebSystemIntegration />
      <CliExportHandler />
      <EditorProvider>
        <OpenAssociatedFileHandler />
        <TextContextMenu />
        <main
          className="h-[100dvh] w-full bg-[var(--app-bg-base)] text-[var(--app-text-secondary)] font-sans flex flex-col overflow-hidden selection:bg-[var(--app-accent)]/30"
          style={{
            paddingTop: "0px",
            paddingBottom: "var(--app-safe-area-bottom)",
            paddingLeft: "var(--app-safe-area-left)",
            paddingRight: "var(--app-safe-area-right)",
          }}
        >
          <div
            className="flex flex-col flex-1 overflow-hidden relative"
            style={{
              borderBottom: "1px solid var(--app-border-base)",
              borderRight: "1px solid var(--app-border-base)",
              borderLeft: "1px solid var(--app-border-base)",
            }}
          >
            <TopToolbar />
            <ResizableLayout />
            <GlobalToast />
          </div>
        </main>
      </EditorProvider>
    </DialogProvider>
  );
}
