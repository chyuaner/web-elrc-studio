'use client';

import { useEffect } from 'react';
import { parseRawLyrics, parseSeconds } from '@/lib/lyric-utils';
import { generateAss } from '@/lib/ass-generator';
import { getDefaultAssOptions } from '../panel/KtvAssExport';

export function CliExportHandler() {
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !electronAPI.getCliExportArgs) return;

    let isCancelled = false;

    async function checkAndRun() {
      const data = await electronAPI.getCliExportArgs();
      if (!data || isCancelled) return;
      
      const { files, exportAssValue } = data;
      
      console.log(`Starting export for ${files.length} files`);
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        console.log(`Processing file ${i + 1}/${files.length}: ${filePath}`);
        try {
          const text = await electronAPI.fsReadFileText(filePath);
          const parsed = parseRawLyrics(text);
          const lines = parsed.lines;
          const lrcMetadata = parsed.metadata;

          // Default options matching UI, overlaid with metadata overrides
          const options = {
            ...getDefaultAssOptions(lrcMetadata),
            
            // These should come specifically from the file's metadata/lrc context or command-line context
            interludeThreshold: parseFloat(lrcMetadata.kth || "6") || 6,
            fadeInOutTime: 0.5,
          };

          console.log(`Finished loading options. Checking for associated media...`);
          // Search for associated media to get videoWidth and videoHeight
          const parsedPath = await electronAPI.pathParse(filePath);
          const exts = ['.mp4', '.flac', '.m4a', '.mp3', '.wav', '.webm', '.mkv'];
          let mediaPath = null;
          let foundMediaName = '';
          for (const ext of exts) {
            const p = await electronAPI.pathJoin(parsedPath.dir, parsedPath.name + ext);
            if (await electronAPI.fsExists(p)) {
              mediaPath = p;
              const mediaParsed = await electronAPI.pathParse(p);
              foundMediaName = mediaParsed.name;
              break;
            }
          }

          if (mediaPath && (mediaPath.endsWith('.mp4') || mediaPath.endsWith('.webm') || mediaPath.endsWith('.mkv'))) {
             console.log(`Found video media: ${mediaPath}. Attempting to extract dimensions...`);
             // Extract dimensions using a hidden video element
             await new Promise<void>((resolve) => {
               const video = document.createElement('video');
               video.src = 'file://' + mediaPath;
               let resolved = false;
               const onLoaded = (event: Event) => {
                 if (resolved) return;
                 resolved = true;
                 if (video.videoWidth > 0 && video.videoHeight > 0) {
                   console.log(`Extracted video dimensions: ${video.videoWidth}x${video.videoHeight}`);
                   options.playResX = video.videoWidth;
                   options.playResY = video.videoHeight;
                 } else {
                   console.log(`Video metadata loaded but dimensions are invalid (Event: ${event.type})`);
                 }
                 resolve();
               };
               video.addEventListener('loadedmetadata', onLoaded);
               video.addEventListener('error', onLoaded);
               setTimeout(() => {
                 if (!resolved) {
                   console.log(`Video dimension extraction timed out after 3 seconds.`);
                   resolved = true;
                   resolve();
                 }
               }, 3000); // 3s timeout
             });
          } else if (mediaPath) {
             console.log(`Found audio media: ${mediaPath}. No dimensions to extract.`);
          } else {
             console.log(`No associated media found.`);
          }

          console.log(`Generating ASS content...`);
          const assContent = generateAss(lines, lrcMetadata, options);
          
          let outPath = '';
          if (exportAssValue && files.length === 1) {
            const exportParsed = await electronAPI.pathParse(exportAssValue);
            if (exportParsed.dir) {
               outPath = exportAssValue;
            } else {
               outPath = await electronAPI.pathJoin(parsedPath.dir, exportAssValue);
            }
          } else {
            outPath = await electronAPI.pathJoin(parsedPath.dir, (foundMediaName || parsedPath.name) + '.ass');
          }

          console.log(`Writing ASS to: ${outPath}`);
          await electronAPI.fsWriteFileText(outPath, assContent);
          console.log(`Done processing ${filePath}`);

        } catch (e) {
          console.error(`Failed to process ${filePath}`, e);
        }
      }

      electronAPI.cliExportAssDone();
    }
    
    checkAndRun();

    return () => {
      isCancelled = true;
    };
  }, []);

  return null;
}
