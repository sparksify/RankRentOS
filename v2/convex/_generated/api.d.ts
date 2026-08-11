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
import type * as observations from "../observations.js";
import type * as researchRuns from "../researchRuns.js";
import type * as subjects from "../subjects.js";

declare const fullApi: ApiFromModules<{
  observations: typeof observations;
  researchRuns: typeof researchRuns;
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
