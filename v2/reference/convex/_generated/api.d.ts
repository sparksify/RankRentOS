/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * NOTE: authored to match `npx convex codegen` output because this sandbox
 * cannot reach a Convex deployment; running codegen against a real
 * deployment regenerates this file identically.
 */
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as budget from "../budget.js";
import type * as importers_v0 from "../importers/v0.js";
import type * as observations from "../observations.js";
import type * as researchRuns from "../researchRuns.js";
import type * as research_autocomplete from "../research/autocomplete.js";
import type * as research_domains from "../research/domains.js";
import type * as research_keywords from "../research/keywords.js";
import type * as research_serp from "../research/serp.js";
import type * as research_trends from "../research/trends.js";
import type * as subjects from "../subjects.js";

declare const fullApi: ApiFromModules<{
  budget: typeof budget;
  "importers/v0": typeof importers_v0;
  observations: typeof observations;
  researchRuns: typeof researchRuns;
  "research/autocomplete": typeof research_autocomplete;
  "research/domains": typeof research_domains;
  "research/keywords": typeof research_keywords;
  "research/serp": typeof research_serp;
  "research/trends": typeof research_trends;
  subjects: typeof subjects;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
