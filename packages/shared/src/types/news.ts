export enum NewsSource {
  HackerNews = "hn",
  TechCrunch = "techcrunch",
  TheVerge = "theverge",
  ArsTechnica = "arstechnica",
  Bloomberg = "bloomberg",
  Reuters = "reuters",
  CoinDesk = "coindesk",
  Reddit = "reddit",
  Smashing = "smashing",
  Polygon = "polygon",
  Generic = "generic",
}

// MVP placeholder so the field validates. v1.1 adds Ai/Devtools/Startups/Career.
export enum NewsTopic {
  General = "general",
}

// Stable user-facing channel identifier.
export type ChannelKey = "tech" | "finance" | "crypto" | "ai-papers" | "design" | "gaming"
