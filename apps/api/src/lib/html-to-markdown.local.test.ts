import { beforeEach, describe, expect, it, vi } from "vitest";
import { transformHtml } from "@mendable/firecrawl-rs";

const state = vi.hoisted(() => ({
  config: {
    HTML_TO_MARKDOWN_SERVICE_URL: undefined as string | undefined,
    USE_GO_MARKDOWN_PARSER: false,
  },
  http: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../config", () => ({ config: state.config }));
vi.mock("../services/sentry", () => ({}));
vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("./logger", () => ({ logger: state.logger }));
vi.mock("./html-to-markdown-client", () => ({
  convertHTMLToMarkdownWithHttpService: state.http,
}));
import { parseMarkdown } from "./html-to-markdown";
import { python, pythonHtml, jsx, jsxHtml, reactCodeMirror, reactCodeMirrorHtml } from "./__fixtures__/html-code-preservation";

const TurndownService = require("turndown");
const convertProtected = (html: string) => new TurndownService().turndown(html);

beforeEach(() => {
  vi.clearAllMocks();
  state.config.HTML_TO_MARKDOWN_SERVICE_URL = undefined;
  state.config.USE_GO_MARKDOWN_PARSER = false;
  state.http.mockImplementation(async (html: string) => convertProtected(html));
});

describe("every HTML-to-Markdown conversion path", () => {
  it.each(["Turndown", "Go", "HTTP"])(
    "preserves literal code after native postprocessing through %s",
    async (route) => {
      state.config.USE_GO_MARKDOWN_PARSER = route === "Go";
      state.config.HTML_TO_MARKDOWN_SERVICE_URL =
        route === "HTTP" ? "http://127.0.0.1:0" : undefined;
      const input =
        '<main><h1>Source examples</h1><a href="#skip">Skip to Content</a>' +
        pythonHtml +
        jsxHtml +
        reactCodeMirrorHtml +
        "<p>Use <code>a &lt; b &amp;&amp; n[0]</code>.</p></main>";
      // Exercise the same native HTML sanitizer that runs before parseMarkdown.
      const cleaned = await transformHtml({
        html: input,
        url: "https://example.com/docs",
        onlyMainContent: true,
        includeTags: [],
        excludeTags: [],
      });
      const result = await parseMarkdown(cleaned);
      expect(result).toContain("```python\n" + python + "```");
      expect(result).toContain("```jsx\n" + jsx + "\n```");
      expect(result).toContain("```javascript\n" + reactCodeMirror + "```");
      expect(result).toContain("`a < b && n[0]`");
      expect(result).not.toContain("\\\n");
      expect(result).toContain("Source examples");
      expect(state.logger.error).not.toHaveBeenCalled();
      expect(state.logger.warn).not.toHaveBeenCalled();
      if (route === "HTTP") {
        expect(state.http).toHaveBeenCalledTimes(1);
        expect(state.http.mock.calls[0][0]).not.toContain("values");
      }
    },
  );
  it("falls back when an HTTP converter silently omits source code", async () => {
    state.config.HTML_TO_MARKDOWN_SERVICE_URL = "http://127.0.0.1:0";
    state.http.mockResolvedValue("partial result");
    expect(await parseMarkdown(pythonHtml)).toContain(
      "```python\n" + python + "```",
    );
    expect(state.logger.error).toHaveBeenCalled();
  });
  it("does not remove skip-link-like strings that are source code", async () => {
    const result = await parseMarkdown(
      '<a href="#skip">Skip to Content</a><pre>[Skip to Content](#not-a-link-in-source)\nitems = [\n    1,\n]\n</pre>',
    );
    expect(result).toContain(
      "[Skip to Content](#not-a-link-in-source)\nitems = [\n    1,\n]\n",
    );
    expect(result).not.toContain("\\\n");
    expect(result.match(/\[Skip to Content\]/g)).toHaveLength(1);
  });
});
