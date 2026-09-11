/**
 * Knowledge-base types for the portfolio RAG index.
 *
 * The knowledge base is generated at build time from the portfolio snapshot
 * (see src/knowledge/build.ts) — a JSON export of the portfolio's projects,
 * experience, and contact data.
 */

export interface KnowledgeChunk {
	/** Stable id, e.g. `project:example-project` or `experience:acme-2020`. */
	id: string;
	/** Human-readable label for citation / debugging. */
	title: string;
	/** The chunk text that gets embedded and injected into the LLM system prompt. */
	text: string;
	/** OpenAI text-embedding-3-small vector (1536 dims). */
	embedding: number[];
	/** Group label so the model knows what kind of entry this is. */
	kind: "project" | "experience" | "site" | "skills";
}

export interface KnowledgeIndex {
	/** ISO timestamp when the index was built. */
	generatedAt: string;
	/** URL the corpus was fetched from at build time. */
	sourceUrl: string;
	/** Embedding model that produced the vectors — must match at query time. */
	embeddingModel: string;
	chunks: KnowledgeChunk[];
}
