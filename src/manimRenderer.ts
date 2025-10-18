/**
 * Manim renderer for Obsidian preview.
 *
 * Usage:
 * - Code fences labelled `manim` will be sent to the local manim server.
 * - Info string may include `scene=SceneName` and `format=mp4|gif|png|svg` and `quality=low|medium|high`
 *
 * Example in markdown:
 * ```manim scene=MyScene format=mp4 quality=medium
 * from manim import *
 *
 * class MyScene(Scene):
 *     def construct(self):
 *         self.play(Write(Text("Hello Manim")))
 * ```
 * ```
 */

import { MarkdownRenderChild, MarkdownRenderer, TFile } from "obsidian";

interface RenderOptions {
  serverUrl: string;
  defaultFormat: string;
  defaultQuality: string;
}

export class ManimRenderer {
  private options: RenderOptions;

  constructor(options?: Partial<RenderOptions>) {
    this.options = {
      serverUrl: (options && options.serverUrl) || "http://localhost:8000",
      defaultFormat: (options && options.defaultFormat) || "mp4",
      defaultQuality: (options && options.defaultQuality) || "low",
    };
  }

  async renderCodeBlock(code: string, infoString: string, containerEl: HTMLElement) {
    // Parse info string for scene/format/quality
    const params = this.parseInfoString(infoString);
    const payload = {
      code: code,
      scene: params.scene || "Scene",
      format: params.format || this.options.defaultFormat,
      quality: params.quality || this.options.defaultQuality,
    };

    const status = document.createElement("div");
    status.textContent = "Rendering Manim…";
    status.style.fontStyle = "italic";
    containerEl.appendChild(status);

    try {
      const resp = await fetch(`${this.options.serverUrl.replace(/\/$/, "")}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        const errMessage = json && json.error ? json.error : `Server returned ${resp.status}`;
        status.textContent = `Render failed: ${errMessage}`;
        return;
      }

      const json = await resp.json();
      if (!json.success) {
        status.textContent = `Render failed: ${json.error || "unknown"}`;
        return;
      }

      const filename: string = json.filename;
      const data: string = json.data;
      const ext = filename.split('.').pop()?.toLowerCase();

      status.remove();

      const blob = this.base64ToBlob(data, this.extToMime(ext || payload.format));
      const url = URL.createObjectURL(blob);

      if (ext === "mp4" || ext === "webm") {
        const video = document.createElement("video");
        video.controls = true;
        video.src = url;
        video.style.maxWidth = "100%";
        containerEl.appendChild(video);
      } else if (ext === "gif" || ext === "png" || ext === "svg") {
        const img = document.createElement("img");
        img.src = url;
        img.style.maxWidth = "100%";
        containerEl.appendChild(img);
      } else {
        // fallback: provide a download link
        const a = document.createElement("a");
        a.href = url;
        a.textContent = `Download ${filename}`;
        a.download = filename;
        containerEl.appendChild(a);
      }
    } catch (e) {
      status.textContent = `Render error: ${String(e)}`;
    }
  }

  private parseInfoString(info: string) {
    // info: e.g. "manim scene=MyScene format=mp4 quality=medium"
    const result: any = {};
    if (!info) return result;
    const parts = info.split(/\s+/);
    for (const p of parts) {
      const kv = p.split("=");
      if (kv.length === 2) {
        const k = kv[0].trim();
        const v = kv[1].trim();
        if (k === "scene") result.scene = v;
        if (k === "format") result.format = v;
        if (k === "quality") result.quality = v;
      }
    }
    return result;
  }

  private base64ToBlob(b64Data: string, contentType = "", sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);

      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  private extToMime(ext: string) {
    if (!ext) return "application/octet-stream";
    switch (ext.toLowerCase()) {
      case "mp4": return "video/mp4";
      case "webm": return "video/webm";
      case "gif": return "image/gif";
      case "png": return "image/png";
      case "svg": return "image/svg+xml";
      default: return "application/octet-stream";
    }
  }
}