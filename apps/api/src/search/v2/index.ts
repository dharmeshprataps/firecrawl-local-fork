import { SearchV2Response, SearchResultType } from "../../lib/entities";
import { config } from "../../config";
import { fire_engine_search_v2 } from "./fireEngine-v2";
import { searxng_search } from "./searxng";
import { ddgSearch } from "./ddgsearch";
import { Logger } from "winston";
import { SearchCapabilityError } from "../searxngClient";
import { UsOnlyUnavailableError } from "../../scraper/scrapeURL/error";
import type { TeamPlanClass } from "../../lib/team-plan-class";

export async function search({
  query,
  logger,
  requestId,
  advanced = false,
  num_results = 5,
  tbs = undefined,
  filter = undefined,
  lang = "en",
  country = "us",
  location = undefined,
  safe = undefined,
  proxy = undefined,
  sleep_interval = 0,
  timeout = 5000,
  type = undefined,
  enterprise = undefined,
  includeDomains = undefined,
  excludeDomains = undefined,
  usOnly = false,
  teamPlanClass = undefined,
}: {
  query: string;
  logger: Logger;
  requestId?: string;
  advanced?: boolean;
  num_results?: number;
  tbs?: string;
  filter?: string;
  lang?: string;
  country?: string;
  location?: string;
  safe?: boolean;
  proxy?: string;
  sleep_interval?: number;
  timeout?: number;
  type?: SearchResultType | SearchResultType[];
  enterprise?: ("default" | "anon" | "zdr")[];
  includeDomains?: string[];
  excludeDomains?: string[];
  usOnly?: boolean;
  /** The team's plan class, when the caller knows it. Omitted, nothing is stated. */
  teamPlanClass?: TeamPlanClass;
}): Promise<SearchV2Response> {
  if (config.SEARXNG_ENDPOINT) {
    if (usOnly) {
      throw new UsOnlyUnavailableError("The configured local search provider cannot guarantee US-only processing.");
    }
    const requested = type === undefined ? ["web"] : Array.isArray(type) ? type : [type];
    if (requested.some(source => source !== "web")) {
      throw new SearchCapabilityError("Local search supports web results only; image and news search require another provider.");
    }
    if (enterprise?.some(mode => mode !== "default")) {
      throw new SearchCapabilityError("The configured local search provider does not implement anonymous or zero-data-retention routing.");
    }
    logger.info("Using configured local SearXNG search");
    return searxng_search(query, { num_results, tbs, filter, lang, country, location, safe });
  }
  // The fallback backends below take no US-only routing.
  if (usOnly && !config.FIRE_ENGINE_BETA_URL) {
    throw new UsOnlyUnavailableError(
      "Search is not available for teams restricted to US-only processing on this deployment.",
    );
  }
  try {
    if (config.FIRE_ENGINE_BETA_URL) {
      logger.info("Using fire engine search");
      const results = await fire_engine_search_v2(query, {
        requestId,
        numResults: num_results,
        tbs,
        filter,
        lang,
        country,
        location,
        safe,
        type,
        enterprise,
        includeDomains,
        excludeDomains,
        usOnly,
        teamPlanClass,
      });

      return results;
    }

    logger.info("Using DuckDuckGo search");
    const ddgResults = await ddgSearch(query, num_results, {
      tbs,
      lang,
      country,
      proxy,
      timeout,
    });
    if (ddgResults.web && ddgResults.web.length > 0) return ddgResults;

    // Fallback to empty response
    return {};
  } catch (error) {
    logger.error(`Error in search function`, { error });
    return {};
  }
}
