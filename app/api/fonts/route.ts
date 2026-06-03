import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";

export const dynamic = "force-static";

export async function GET() {
  try {
    const fontsDir = path.join(process.cwd(), "public", "fonts");
    let indexData: any[] = [];

    const indexPath = path.join(fontsDir, "index.json");
    if (fs.existsSync(indexPath)) {
      indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    }

    let actualFiles: string[] = [];
    if (fs.existsSync(fontsDir)) {
      actualFiles = fs
        .readdirSync(fontsDir)
        .filter(
          (f) =>
            f.endsWith(".ttf") || f.endsWith(".otf") || f.endsWith(".woff") || f.endsWith(".woff2"),
        );
    }

    // Map files from JSON
    const registeredFiles = new Set(indexData.map((f) => f.filename).filter(Boolean));

    // Find orphaned files
    const orphanedFiles = actualFiles.filter((f) => !registeredFiles.has(f));

    const fonts = [...indexData];

    for (const file of orphanedFiles) {
      const sysName = file.replace(/\.(ttf|otf|woff2?)$/i, "");
      fonts.push({
        id: sysName.toLowerCase().replace(/\s+/g, "-"),
        displayName: sysName,
        systemName: sysName,
        filename: file,
        license: "未知 / 使用者提供",
        officialUrl: "",
      });
    }

    return NextResponse.json(fonts);
  } catch (error) {
    console.error("Failed to read fonts directory:", error);
    return NextResponse.json([]);
  }
}
