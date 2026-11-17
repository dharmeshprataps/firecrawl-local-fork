import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { processPdf } from "@mendable/firecrawl-rs";

const fixture = join(process.cwd(), "src/scraper/scrapeURL/engines/pdf/__fixtures__/pdf-page-limits.pdf");
const marker = (page: number) => `pdf-limit-page-${String(page).padStart(2, "0")}-marker`;

describe("native PDF page-limit regression", () => {
  it("also bounds native extraction while retaining the original document length", async () => {
    const result = await processPdf(fixture, 2);
    expect(result.pageCount).toBe(9);
    expect(result.markdown).toContain(marker(1));
    expect(result.markdown).toContain(marker(2));
    for (let page = 3; page <= 9; page++)
      expect(result.markdown).not.toContain(marker(page));
  });

});
