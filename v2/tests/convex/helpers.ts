import { convexTest } from "convex-test";
import schema from "../../convex/schema";

// convex-test needs the function modules; import.meta.glob is provided by vitest.
export const modules = import.meta.glob("../../convex/**/*.ts");

export function testConvex() {
  return convexTest(schema, modules);
}

/** Create the minimal subject spine (service, city geography, opportunity). */
export async function seedSubjects(t: ReturnType<typeof testConvex>) {
  const { api } = await import("../../convex/_generated/api");
  const service = await t.mutation(api.subjects.createService, {
    name: "Epoxy Garage Floors",
    slug: "epoxy-garage-floors",
    synonyms: ["epoxy flooring"],
    discoveryType: "SEED",
  });
  const geography = await t.mutation(api.subjects.createGeography, {
    kind: "city",
    name: "Prosper",
    state: "TX",
    slug: "prosper-tx",
    region: "DFW-north",
    discoveryType: "SEED",
  });
  const opportunity = await t.mutation(api.subjects.createOpportunity, {
    serviceId: service.id,
    geographyId: geography.id,
    type: "general",
    discoveryType: "SEED",
    primaryKeyword: "epoxy flooring prosper",
  });
  return { serviceId: service.id, geographyId: geography.id, opportunityId: opportunity.id };
}
