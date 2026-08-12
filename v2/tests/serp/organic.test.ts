import { test, expect, describe } from "vitest";
import { organicRankability, classifySlot, localPackEvidence } from "../../lib/serp/organic";

const L = (link: string, title: string) => ({ link, title });

describe("organic-only rankability (organic-v1)", () => {
  test("a weak map pack CANNOT rescue a brutal organic SERP", () => {
    // top 5 all real local specialists targeting the city, deep old content
    const brutal = organicRankability({
      geo: "Plano",
      organic: [
        L("https://planopools.com/", "Plano Pool Builders"),
        L("https://elitepoolsplano.com/", "Pool Builder in Plano TX"),
        L("https://texaspoolpros.com/plano", "Plano Custom Pools"),
        L("https://bluewaterplano.com/", "Plano Pools"),
        L("https://poolcraftplano.com/", "Custom Pools Plano"),
      ],
      competitorAvgWords: 3000, competitorAvgDomainAgeYears: 22,
    });
    expect(brutal.verdict).toBe("ORGANIC-BRUTAL");
    // the pack being weak is recorded but is NOT part of the score
    const pack = localPackEvidence(3, 11, 2);
    expect(pack.interpretation).toMatch(/NOT to organic difficulty/);
    expect(Object.keys(brutal)).not.toContain("mapPackSize");
  });

  test("directory-heavy organic is viable for a purpose-built page", () => {
    const soft = organicRankability({
      geo: "Celina",
      organic: [
        L("https://www.yelp.com/search?find=pool", "Best Pool Builders in Celina - Yelp"),
        L("https://www.angi.com/companylist/celina/pools.htm", "Pool Builders Celina"),
        L("https://www.houzz.com/professionals/celina", "Celina Pool Contractors"),
        L("https://www.facebook.com/somepage", "Pools Celina"),
        L("https://realpoolco.com/", "Real Pool Co"),
      ],
      competitorAvgWords: 600, competitorAvgDomainAgeYears: 4,
    });
    expect(soft.verdict).toBe("ORGANIC-VIABLE");
    expect(soft.displaceableTop5).toBe(4);
    expect(soft.hardLocalTop3).toBe(0);
  });

  test("classification separates soft slots from real local competitors", () => {
    expect(classifySlot("https://www.yelp.com/x", "t", "Plano", 1)!.displaceable).toBe(true);
    expect(classifySlot("https://reddit.com/r/x", "t", "Plano", 2)!.displaceable).toBe(true);
    expect(classifySlot("https://joespools.com/", "Joe's Pools", "Plano", 3)!.displaceable).toBe(false);
  });

  test("competitors targeting the exact geography are penalised", () => {
    const base = { geo: "Arvada", competitorAvgWords: 1000, competitorAvgDomainAgeYears: 8 };
    const targeted = organicRankability({ ...base, organic: [
      L("https://a.com/", "Arvada Bathroom Remodeling"), L("https://b.com/", "Bathroom Remodel Arvada"),
      L("https://c.com/", "Arvada Remodelers"), L("https://d.com/", "Bath Pros Arvada"), L("https://e.com/", "Arvada Baths"),
    ] });
    const generic = organicRankability({ ...base, organic: [
      L("https://a.com/", "Bathroom Remodeling"), L("https://b.com/", "Bath Remodel Company"),
      L("https://c.com/", "Remodelers"), L("https://d.com/", "Bath Pros"), L("https://e.com/", "Baths"),
    ] });
    expect(targeted.score!).toBeLessThan(generic.score!);
    expect(targeted.geoTargetedCompetitorsTop5).toBe(5);
  });

  test("missing content evidence is reported, never imputed", () => {
    const r = organicRankability({ geo: "Frisco", organic: [L("https://x.com/", "Pools")] });
    expect(r.missing).toContain("serp.competitor.avgwords");
    expect(r.missing).toContain("serp.competitor.domainageyears");
  });

  test("deterministic", () => {
    const i = { geo: "Frisco", organic: [L("https://www.yelp.com/a", "Yelp"), L("https://p.com/", "Pools")], competitorAvgWords: 900, competitorAvgDomainAgeYears: 5 };
    expect(JSON.stringify(organicRankability(i))).toBe(JSON.stringify(organicRankability(i)));
  });
});

describe("classification defects found in the Wave-1 audit (regressions)", () => {
  test("substring host matching must not misclassify: paintedtreetx.com is NOT x.com", () => {
    const s = classifySlot("https://paintedtreetx.com/", "Painted Tree Community", "Painted Tree", 1, ["pool"]);
    expect(s!.slotClass).not.toBe("social");
  });
  test("a result that never names the service is adjacent, not a competing specialist", () => {
    // community site and home builder ranking for "pool builder" are not pool competitors
    const comm = classifySlot("https://windsongranchliving.com/", "Windsong Ranch: Master Planned Community", "Windsong Ranch", 3, ["pool"]);
    expect(comm!.slotClass).toBe("adjacent-not-this-service");
    expect(comm!.displaceable).toBe(true);
    const builder = classifySlot("https://coventryhomes.com/", "New Homes in Painted Tree", "Painted Tree", 2, ["pool"]);
    expect(builder!.displaceable).toBe(true);
  });
  test("a real local competitor naming the service stays hard", () => {
    const s = classifySlot("https://prestigepp.com/", "Pool Builder & Pool Service in Prosper, TX", "Prosper", 1, ["pool"]);
    expect(s!.slotClass).toBe("local-specialist");
    expect(s!.displaceable).toBe(false);
  });
  test("national brands and national content are not independent local operators", () => {
    expect(classifySlot("https://rebath.com/kirkland", "Re-Bath Kirkland", "Kirkland", 2, ["bathroom", "remodel"])!.slotClass).toBe("national-brand");
    expect(classifySlot("https://ecowatch.com/best-windows", "Best Window Companies", "Amarillo", 4, ["window"])!.slotClass).toBe("national-content");
    expect(classifySlot("https://ecowatch.com/x", "t", "Amarillo", 4, ["window"])!.displaceable).toBe(true);
  });
});

describe("sanity audit fixes (organic-v1.1)", () => {
  test("multiple results from ONE host count as one competitor, not several", () => {
    // Painted Tree scored 82 because 3 of its 5 slots were all paintedtreetx.com
    const inflated = organicRankability({
      geo: "Painted Tree", serviceTerms: ["pool"],
      organic: [
        { link: "https://paintedtreetx.com/a", title: "Painted Tree" },
        { link: "https://coventryhomes.com/", title: "New Homes" },
        { link: "https://paintedtreetx.com/b", title: "Painted Tree Living" },
        { link: "https://bloomfieldhomes.com/", title: "New Homes" },
        { link: "https://paintedtreetx.com/c", title: "Painted Tree Amenities" },
      ],
      competitorAvgWords: 1435, competitorAvgDomainAgeYears: 13.8,
    });
    expect(inflated.distinctHostsTop5).toBe(3);        // not 5
    expect(inflated.displaceableTop5).toBeLessThanOrEqual(3);
  });
  test("an unknown domain naming the service in its DOMAIN is a real competitor", () => {
    const s = classifySlot("https://haukcustompools.com/", "Hauk Custom", "Sandbrock Ranch", 2, ["pool"]);
    expect(s!.slotClass).toBe("local-specialist");
    expect(s!.displaceable).toBe(false);
    const k = classifySlot("https://kitchenrefresh.net/", "Refresh Your Space", "Rochester", 3, ["kitchen", "remodel"]);
    expect(k!.displaceable).toBe(false);
  });
  test("an unknown domain with no service evidence is still NOT assumed a strong competitor", () => {
    const s = classifySlot("https://sandbrockranch.com/", "Sandbrock Ranch Community", "Sandbrock Ranch", 1, ["pool"]);
    expect(s!.slotClass).toBe("adjacent-not-this-service");
  });
});

describe("sanity audit 2 (organic-v1.2)", () => {
  test("national retailers and multi-state franchises are not local operators", () => {
    expect(classifySlot("https://www.ikea.com/us/en/rooms/bathroom/", "Bathroom Remodel Ideas", "Conroe", 1, ["bath", "remodel"])!.slotClass).toBe("national-brand");
    expect(classifySlot("https://www.groupon.com/deals/house-cleaning", "House Cleaning Deals", "Orlando", 2, ["clean"])!.displaceable).toBe(true);
    expect(classifySlot("https://ramjack.com/naperville", "Ram Jack Basement Waterproofing", "Naperville", 3, ["basement", "waterproof"])!.slotClass).toBe("national-brand");
  });
  test("a community/developer domain is not a service competitor even if its page mentions the service", () => {
    const s = classifySlot("https://www.unionparkbyhillwood.com/amenities", "Union Park | Pools & Parks", "Union Park", 1, ["pool"], "community");
    expect(s!.slotClass).toBe("adjacent-not-this-service");
    expect(s!.displaceable).toBe(true);
  });
  test("a genuine local operator with the city in its domain is still a hard competitor", () => {
    // contains the service token in the domain, so the community-site rule must not fire
    const s = classifySlot("https://friscopoolbuilders.com/", "Frisco Pool Builders", "Frisco", 1, ["pool"], "community");
    expect(s!.slotClass).toBe("local-specialist");
    expect(s!.displaceable).toBe(false);
  });
  test("the community-site rule must NOT fire for city geographies", () => {
    // "bluewaterplano.com" is plausibly a real Plano pool company, not a community site
    const s = classifySlot("https://bluewaterplano.com/", "Plano Pools", "Plano", 4, ["pool"], "city");
    expect(s!.slotClass).toBe("local-specialist");
  });
});
