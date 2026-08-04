// Canonical domain types for the Discovery MVP.
// Layer A = RawEvidence, Layer B = *Observation, Layer C = Score/Blueprint/Selection.

export type UUID = string;

export interface RawEvidence {
  id?: UUID;
  provider: string;
  requestType: string;
  requestParams: Record<string, unknown>;
  sourceId?: string;
  observedAt: string; // ISO
  checksum: string;
  payload: unknown;
  costUsd?: number;
  jobId?: UUID;
  taskId?: UUID;
  executionId?: UUID;
}

export interface NicheAttrs {
  query: string;
  acQuery: string;
  domainTerms: string[];
  ticketLow: number;
  ticketHigh: number;
  margin: number;
  seasonal: boolean;
  peRisk: 'low' | 'medium' | 'high';
  archetype: string;
  need: boolean;
}

export interface Niche {
  id: UUID;
  name: string;
  slug: string;
  active: boolean;
  attrs: NicheAttrs;
}

export interface City {
  id: UUID;
  name: string;
  state: string;
  region?: string;
  lat?: number;
  lng?: number;
}

export interface GeoObservation {
  geoType: 'city' | 'neighborhood' | 'territory';
  geoId: UUID;
  metric: 'population' | 'household_income' | 'growth' | 'housing_age' | 'home_value';
  valueNum?: number;
  valueText?: string;
  dataset?: string;
  datasetYear?: number;
  source: string;
  observedAt: string;
  evidenceChecksum?: string;
}

export interface Market {
  id: UUID;
  nicheId: UUID;
  geoType: 'city' | 'neighborhood' | 'territory';
  geoId: UUID;
  researchState: 'unresearched' | 'qualified' | 'rejected' | 'deep_researched';
}

export interface KeywordObservation {
  keywordTerm: string;
  volume: number | null;
  cpc: number | null;
  competition: number | null;
  provider: string;
  observedAt: string;
  evidenceChecksum?: string;
}

export interface SerpResultItem {
  position: number;
  resultType: 'organic' | 'local_pack' | 'ad';
  url?: string;
  domain?: string;
  title?: string;
  snippet?: string;
  isDirectory?: boolean;
  isFranchise?: boolean;
  isEmd?: boolean;
  isInnerPage?: boolean;
}

export interface SerpSnapshot {
  query: string;
  engine: string;
  device: string;
  geoParams: Record<string, unknown>;
  provider: string;
  observedAt: string;
  results: SerpResultItem[];
  evidenceChecksum?: string;
  costUsd?: number;
}

export interface DomainObservation {
  domain: string;
  available: boolean | null;
  regPrice?: number | null;
  premiumPrice?: number | null;
  registrar?: string;
  provider: string;
  observedAt: string;
  evidenceChecksum?: string;
}

export interface BusinessIdentity {
  canonicalName: string;
  rootDomain?: string;
  primaryPhone?: string;
  placeId?: string;
}

export type QualificationResult = 'passed' | 'failed' | 'needs_research';

export interface QualificationReason {
  gate: string;
  outcome: 'pass' | 'fail' | 'warn' | 'info';
  detail: string;
}

export interface Qualification {
  marketKey: string; // `${nicheSlug}|${city}|${state}`
  version: string;
  result: QualificationResult;
  reasons: QualificationReason[];
  confidence: number;
  inputHash: string;
  preliminaryScore: number; // 0-100, cheap-evidence score used for ranking candidates
}

export interface Subscores {
  demand: number;        // /20
  competition: number;   // /25
  monetization: number;  // /15
  domain: number;        // /10
  operatorBench: number; // /10
  geoEconomics: number;  // /10
  buildability: number;  // /10
}

export interface LensScore {
  lens: string;
  lensVersion: string;
  weightsVersion: string;
  overall: number;
  subscores: Subscores;
  confidence: number;
  reasons: string[];
  inputHash: string;
  computedAt: string;
}

export interface DeepResearchEvidence {
  marketKey: string;
  nicheSlug: string;
  city: string;
  state: string;
  collectedAt: string;
  serp: SerpSnapshot | null;
  competitors: CompetitorEvidence[];
  operatorCandidates: OperatorCandidateEvidence[];
  domains: DomainObservation[];
  notes?: string[];
}

export interface CompetitorEvidence {
  name: string;
  domain: string;
  url?: string;
  position?: number;
  kind: 'local_business' | 'franchise' | 'directory' | 'out_of_town' | 'national' | 'other';
  signals: {
    cityInTitle?: boolean;
    innerPage?: boolean;
    dedicatedLocalSite?: boolean;
    contentDepthWords?: number | null;
    reviewCount?: number | null;
    notes?: string;
  };
}

export interface OperatorCandidateEvidence {
  name: string;
  domain?: string;
  phone?: string;
  whyCandidate: string;
  source: string;
}

export interface BlueprintLite {
  marketKey: string;
  niche: string;
  geography: string;
  recommendedDomain: string | null;
  altDomains: string[];
  domainCheckedAt: string | null;
  primaryServices: string[];
  primaryKeywords: { term: string; volume: number | null; cpc: number | null }[];
  sitemap: string[];
  contentPlan: string[];
  primaryCompetitors: string[];
  whyBeatable: string[];
  authorityAssumptions: Record<string, unknown>;
  operatorSummary: string;
  estCost: [number, number];
  estRankMonths: [number, number];
  estLeadsMo: [number, number];
  estRevenueMo: [number, number];
  assumptions: string[];
  risks: string[];
  missingEvidence: string[];
  confidence: number;
  nextAction: string;
}

export interface SelectionEntry {
  marketKey: string;
  rank: number;
  role: 'primary' | 'alternate';
  position: number;
  inclusionReasons: string[];
}
