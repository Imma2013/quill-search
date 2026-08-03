export type EvidenceQuote = {
  id: string;
  verbatimQuote: string;
  sourceUrl: string;
  authorOrPublisher: string;
  qualityScore: number;
};

export type Source = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  quoteCount: number;
};

export type SearchMetadata = {
  sources: Source[];
  quotes: EvidenceQuote[];
  cached: boolean;
  modelUsed?: string;
};
