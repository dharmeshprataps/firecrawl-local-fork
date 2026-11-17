vi.mock("../config", () => ({ config: { SEARXNG_ENDPOINT: "http://searxng:8080", FIRE_ENGINE_BETA_URL: "https://cloud.invalid" } }));
vi.mock("./searxng", () => ({ searxng_search: vi.fn() }));
vi.mock("./v2/searxng", () => ({ searxng_search: vi.fn() }));
vi.mock("./fireEngine", () => ({ fire_engine_search: vi.fn() }));
vi.mock("./v2/fireEngine-v2", () => ({ fire_engine_search_v2: vi.fn() }));
vi.mock("./v2/ddgsearch", () => ({ ddgSearch: vi.fn() }));
import { search as v1search } from "./index";
import { search as v2search } from "./v2/index";
import { searxng_search as localV1 } from "./searxng";
import { searxng_search as localV2 } from "./v2/searxng";
import { fire_engine_search } from "./fireEngine";
import { fire_engine_search_v2 } from "./v2/fireEngine-v2";
import { ddgSearch } from "./v2/ddgsearch";
import { SearchProviderError } from "./searxngClient";
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  expect(fire_engine_search).not.toHaveBeenCalled(); expect(fire_engine_search_v2).not.toHaveBeenCalled(); expect(ddgSearch).not.toHaveBeenCalled();
});
it("keeps successful empty searches local in both API versions", async () => {
  vi.mocked(localV1).mockResolvedValue([]); vi.mocked(localV2).mockResolvedValue({ web: [] });
  await expect(v1search({ query: "empty", logger })).resolves.toEqual([]);
  await expect(v2search({ query: "empty", logger })).resolves.toEqual({ web: [] });
});
it("propagates a provider outage instead of silently switching services", async () => {
  vi.mocked(localV1).mockRejectedValue(new SearchProviderError()); vi.mocked(localV2).mockRejectedValue(new SearchProviderError());
  await expect(v1search({ query: "outage", logger })).rejects.toBeInstanceOf(SearchProviderError);
  await expect(v2search({ query: "outage", logger })).rejects.toBeInstanceOf(SearchProviderError);
});
it.each(["images", "news"] as const)("rejects unsupported %s before contacting any provider", async type => {
  await expect(v2search({ query: "query", logger, type })).rejects.toMatchObject({ status: 501, code: "SEARCH_CAPABILITY_UNAVAILABLE" });
  expect(localV2).not.toHaveBeenCalled();
});

it("preserves US-only restrictions instead of sending a query to the configured local provider", async () => {
  await expect(v1search({ query: "private query", logger, usOnly: true })).rejects.toMatchObject({ code: "US_ONLY_UNAVAILABLE" });
  await expect(v2search({ query: "private query", logger, usOnly: true })).rejects.toMatchObject({ code: "US_ONLY_UNAVAILABLE" });
  expect(localV1).not.toHaveBeenCalled(); expect(localV2).not.toHaveBeenCalled();
});
it.each(["anon", "zdr"] as const)("does not silently downgrade upstream %s processing guarantees", async mode => {
  await expect(v1search({ query: "private query", logger, enterprise: [mode] })).rejects.toMatchObject({ code: "SEARCH_CAPABILITY_UNAVAILABLE" });
  await expect(v2search({ query: "private query", logger, enterprise: [mode] })).rejects.toMatchObject({ code: "SEARCH_CAPABILITY_UNAVAILABLE" });
  expect(localV1).not.toHaveBeenCalled(); expect(localV2).not.toHaveBeenCalled();
});
it("forwards the current upstream strict safe-search setting", async () => {
  vi.mocked(localV2).mockResolvedValue({ web: [] });
  await v2search({ query: "query", logger, safe: true });
  expect(localV2).toHaveBeenCalledWith("query", expect.objectContaining({ safe: true }));
});
