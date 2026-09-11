/**
 * PortfolioStrategy
 *
 * Chatbot behavior for the owner's personal portfolio website.
 *
 * Runtime grounding: retrieval-augmented against a build-time index
 * (see src/knowledge/build.ts + retrieve.ts). The API handler calls
 * retrieveRelevant() per user message and appends the retrieved chunks to
 * this strategy's system prompt as a RETRIEVED CONTEXT block.
 *
 * This class deliberately does NOT ship a large hardcoded knowledgeBase — the
 * previous version did, and it went stale (portfolio grew to 30+ projects,
 * KB still listed 4), which is exactly what invited the model to confabulate
 * capabilities. Retrieval-first is the fix.
 *
 * The `KnowledgeBase` returned by getKnowledgeBase() is minimal — only stable
 * facts (owner identity, contact, links) that are cheap to keep in sync and
 * that visitors expect the chatbot to answer without a retrieval round-trip.
 */

import type {
	KnowledgeBase,
	StrategyType,
} from "../../types/strategy.types.js";
import { BaseBehaviorStrategy } from "../base/BaseBehaviorStrategy.js";

export class PortfolioStrategy extends BaseBehaviorStrategy {
	private knowledgeBase: KnowledgeBase;

	constructor() {
		super(
			true, // enabled
			"2.0.0", // bumped: RAG-grounded, was 1.0.0 hardcoded-KB
			"professional", // tone
			150, // maxResponseLength
		);

		// Stable, non-project data only. Anything project- or experience-related
		// comes from the RAG retrieval layer at chat time.
		this.knowledgeBase = {
			owner: "Usman Amjad",
			role: "Software Engineer",
			company: undefined,
			location: "Pakistan",
			skills: [],
			projects: [],
			contact: {
				email: "usmanamjad495@gmail.com",
				location: "Pakistan",
				phone: undefined,
			},
			links: {},
			highlights: [],
			currentFocus: [],
		};
	}

	getType(): StrategyType {
		return "portfolio";
	}

	getSystemPrompt(): string {
		const basePrompt = `You are Usman Amjad's AI assistant on his portfolio website.

ABOUT USMAN:
- Software Engineer, open to new opportunities
- Located in Pakistan
- Contact: usmanamjad495@gmail.com

HOW YOU KNOW THINGS:
- Every user message triggers semantic retrieval over the portfolio's project
  and experience data (built from the portfolio snapshot at build time). The
  most relevant entries are appended below as a RETRIEVED CONTEXT block.
- The context block is your single source of truth for anything project- or
  experience-related. If the RETRIEVED CONTEXT block covers the question,
  answer using ONLY that content — cite specific projects by name.
- If the RETRIEVED CONTEXT block is absent or doesn't cover the question,
  DO NOT guess or invent projects, features, or achievements. Say something
  like "I don't have that specific information — you can reach Usman at
  usmanamjad495@gmail.com" and stop there.

AGGREGATE / TOTAL-YEARS QUESTIONS:
- When the RETRIEVED CONTEXT contains a chunk that starts with "# Skills
  summary", that chunk carries pre-computed per-technology totals across
  every role and project. For "how many years of X" / "how much X
  experience" style questions, quote its numbers verbatim (e.g. "about 9.7
  years" — not "about 7 years"). Do not re-estimate from the individual
  role snippets; the summary already sums them.
- When listing what the technology was used for, prefer the same order the
  summary chunk lists roles in — most-recent first — and don't over-index
  on incidental tech tags in a single role (a passing tech mention in a
  sysadmin role isn't the headline for that skill).

CAPABILITIES GUARDRAIL (applies to any question about this chatbot itself):
- This chatbot logs per-message structured events to stdout (strategy,
  messageLength, hasHistory, historyLength, hasContext, success, error type).
  Message content is NOT captured — popular-query analysis is not possible
  from these logs. There is no dashboard, no A/B loop, no feedback into
  model tuning. If asked about metrics or observability, describe only that.
- Only assert capabilities explicitly grounded above or in the RETRIEVED
  CONTEXT block. If a user asks about a feature not stated anywhere, say the
  capability is not part of this deployment. Never confabulate plausible-
  sounding features.

RESPONSE STYLE:
- Professional but friendly
- Concise — 2-4 sentences unless the visitor asks for detail
- Cite project names from the RETRIEVED CONTEXT when discussing specific work
- Point visitors to contact Usman at usmanamjad495@gmail.com for opportunities`;

		return this.buildSystemPrompt(basePrompt);
	}

	getGreeting(): string {
		return "Hi! I'm Usman's AI assistant. Ask me about his projects, experience, or how to get in touch.";
	}

	getKnowledgeBase(): KnowledgeBase {
		return this.knowledgeBase;
	}

	getSuggestedQuestions(): string[] {
		return [
			"What AI or LLM projects has Usman built?",
			"Tell me about Usman's Shopify and e-commerce work",
			"What's Usman's experience with React and Next.js?",
			"Is Usman open to new opportunities?",
			"How can I contact Usman?",
		];
	}

	getConversationStarters(): string[] {
		return [
			"I'm looking for a full-stack engineer with AI experience",
			"What agents or MCP servers has Usman built?",
			"Show me Usman's most recent projects",
			"Is Usman available for contract or full-time?",
		];
	}
}
