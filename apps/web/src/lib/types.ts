export type EvidenceQuote = {
  id: string;
  sourceId: string;
  verbatimQuote: string;
  sourceUrl: string;
  authorOrPublisher: string;
  qualityScore: number;
};

export type Source = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publisher: string;
  faviconUrl?: string;
  snippet: string;
  quoteCount: number;
};

export type SearchMetadata = {
  sources: Source[];
  quotes: EvidenceQuote[];
  cached: boolean;
  modelUsed?: string;
};

export type ArticleParagraph = {
  text: string;
  sourceIds: string[];
};

export type EvidenceArticle = {
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs: ArticleParagraph[];
    quoteIds: string[];
  }>;
};

export type SearchResponse = SearchMetadata & {
  article: EvidenceArticle;
};
