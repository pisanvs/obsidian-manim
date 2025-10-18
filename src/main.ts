// NOTE: This is an example integration snippet. Integrate into your plugin's onload where you register Markdown post processors / preview renderers.
// If your plugin already handles graphviz blocks, replace or extend that logic to call the ManimRenderer.

import { Plugin, MarkdownPostProcessorContext } from "obsidian";
import { ManimRenderer } from "./manimRenderer";

export default class ManimPlugin extends Plugin {
  private manimRenderer: ManimRenderer;

  async onload() {
    this.manimRenderer = new ManimRenderer({
      serverUrl: "http://localhost:8000",
      defaultFormat: "mp4",
      defaultQuality: "low",
    });

    // Register a markdown post processor for code fences labeled "manim"
    this.registerMarkdownCodeBlockProcessor("manim", async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      // `source` is the code block content; `ctx` has the info string accessible via ctx.getSectionInfo? If not, we parse via the plugin's API.
      // Obsidian's API for code block info string is not exposed to this callback; as a workaround, we look at el.dataset.language or the parent?
      // For simplicity, we'll attempt to read the info string from the pre > code element's class or data-language attributes if available.
      const infoAttr = (el.getAttribute("data-language") || "");
      await this.manimRenderer.renderCodeBlock(source, infoAttr, el);
    });
  }

  onunload() {
    // cleanup if needed
  }
}