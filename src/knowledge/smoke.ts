/**
 * Quick smoke test — exercises the retrieval path end-to-end against a live
 * OpenAI API. Not a real test (no assertions), just prints top-k for
 * representative queries so you can eyeball whether retrieval is grounded.
 *
 *   OPENAI_API_KEY=... npx ts-node --esm src/knowledge/smoke.ts
 */

import { existsSync } from "node:fs";
import dotenv from "dotenv";

if (existsSync(".env.local")) dotenv.config({ path: ".env.local" });

import { retrieveRelevant } from "./retrieve.js";

const QUERIES = [
	"What LLM or AI agent projects has Usman built?",
	"Tell me about his Shopify work",
	"Does he have experience with WordPress?",
	"What's his most recent project?",
	"Is there a metrics dashboard for the chatbot?", // Should return low similarity — this is the hallucination-triggering question from earlier
];

for (const q of QUERIES) {
	const hits = await retrieveRelevant(q, 3);
	console.log(`\nQ: ${q}`);
	if (hits.length === 0) {
		console.log(
			"  → no chunks above similarity floor (would answer without RAG)",
		);
	} else {
		for (const c of hits) console.log(`  → ${c.id} (${c.kind})`);
	}
}
