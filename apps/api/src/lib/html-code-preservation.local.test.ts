import { describe, expect, it } from "vitest";
import { protectHtmlCode } from "./html-code-preservation";
import { python, pythonHtml, jsx, jsxHtml, reactCodeMirror, reactCodeMirrorHtml } from "./__fixtures__/html-code-preservation";

const TurndownService = require("turndown");
const convertProtected = (html: string) => new TurndownService().turndown(html);
const restore = (html: string) => {
  const code = protectHtmlCode(html);
  return code.restore(convertProtected(code.html));
};

describe("literal HTML code preservation", () => {
  it("preserves Sphinx syntax spans, operators, indentation and bracketed newlines", () => {
    expect(restore(pythonHtml)).toBe("```python\n" + python + "```");
  });
  it("separates React highlighted lines without joining their words", () => {
    expect(restore(jsxHtml)).toBe("```jsx\n" + jsx + "\n```");
  });
  it("retains blank highlighted lines and explicit br line breaks", () => {
    expect(
      restore(
        '<pre><code><span class="line">one</span><span class="line"></span><span class="line">  three</span></code></pre>',
      ),
    ).toBe("```\none\n\n  three\n```");
    expect(restore("<pre>one<br>  two</pre>")).toBe("```\none\n  two\n```");
  });
  it("preserves actual React CodeMirror lines with terminal BR exactly once", () => {
    expect(restore(reactCodeMirrorHtml)).toBe("```javascript\n" + reactCodeMirror + "```");
    expect(restore('<pre><code><div class="cm-line">one<br></div>\n<div class="cm-line"><br></div>\n<div class="cm-line">three<br></div></code></pre>'))
      .toBe("```\none\n\nthree\n```");
    expect(restore('<pre><code><div class="cm-line">one<br></div><div class="cm-line"></div><div class="cm-line">three</div></code></pre>'))
      .toBe("```\none\n\nthree\n```");
  });
  it("decodes entities once and preserves code-like literal entity text", () => {
    expect(
      restore("<pre>const text = &quot;&amp;lt;tag&amp;gt;&quot;;\n</pre>"),
    ).toBe('```\nconst text = "&lt;tag&gt;";\n```');
  });
  it("chooses fences longer than backticks inside source code", () => {
    expect(
      restore('<pre class="language-js">const ticks = "```";\n</pre>'),
    ).toBe('````js\nconst ticks = "```";\n````');
    expect(
      restore("<p>Use <code>`value` &lt; other &amp;&amp; n[0]</code>.</p>"),
    ).toBe("Use `` `value` < other && n[0] ``.");
  });
  it("does not mistake the document's human language for code language", () => {
    expect(
      restore('<html lang="en"><body><pre>hello</pre></body></html>'),
    ).toBe("```\nhello\n```");
  });
  it("preserves existing spaces in inline code with safe CommonMark padding", () => {
    expect(restore("<p><code> a &lt; b </code></p>")).toBe("`  a < b  `");
  });
  it("retains list/blockquote indentation around restored fences", () => {
    const code = protectHtmlCode("<pre>  nested</pre>");
    const token = code.html.match(/FCODE[a-f0-9]+ITEM0END/)![0];
    expect(code.restore("> " + token)).toBe("> ```\n>   nested\n> ```");
    expect(code.restore("- " + token)).toBe("- ```\n    nested\n  ```");
  });
  it("rejects a converter that discards protected code", () => {
    const code = protectHtmlCode(pythonHtml);
    expect(() => code.restore("partial document without source code")).toThrow(
      "discarded protected source code",
    );
  });
  it("leaves documents without code unchanged", () => {
    const original = "<p>Plain &amp; useful text.</p>";
    const code = protectHtmlCode(original);
    expect(code.html).toBe(original);
    expect(code.restore("Plain & useful text.")).toBe("Plain & useful text.");
  });
});
