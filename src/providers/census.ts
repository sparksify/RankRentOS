// US Census ACS adapter — free demographic observations by place.
// Used to verify/refresh city population and household income.
import type { GeoObservation } from '../core/types.js';
import { evidenceChecksum } from '../core/hash.js';

const ACS_VARS = { population: 'B01003_001E', household_income: 'B19013_001E' } as const;

export class CensusProvider {
  readonly name = 'census_acs';
  constructor(private year = 2023) {}

  /** Fetch population + median household income for all places in a state (FIPS code). */
  async fetchStatePlaces(stateFips: string): Promise<{ name: string; observations: Omit<GeoObservation, 'geoId'>[] }[]> {
    const url = `https://api.census.gov/data/${this.year}/acs/acs5?get=NAME,${ACS_VARS.population},${ACS_VARS.household_income}&for=place:*&in=state:${stateFips}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Census ${res.status}`);
    const rows = (await res.json()) as string[][];
    const observedAt = new Date().toISOString();
    const out: { name: string; observations: Omit<GeoObservation, 'geoId'>[] }[] = [];
    for (const row of rows.slice(1)) {
      const [name, pop, income] = row;
      if (!name) continue;
      const cityName = name.replace(/ (city|town|CDP|village|borough),.*$/, '');
      const base = {
        geoType: 'city' as const, dataset: 'acs5', datasetYear: this.year,
        source: this.name, observedAt,
        evidenceChecksum: evidenceChecksum(this.name, 'acs5_place', { state: stateFips, name }, row),
      };
      out.push({
        name: cityName,
        observations: [
          { ...base, metric: 'population', valueNum: Number(pop) || undefined },
          { ...base, metric: 'household_income', valueNum: Number(income) || undefined },
        ],
      });
    }
    return out;
  }
}
