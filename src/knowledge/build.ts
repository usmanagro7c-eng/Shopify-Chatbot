/**
 * Build-time RAG indexer.
 *
 * Fetches projects + experiences from a portfolio JSON snapshot, chunks them,
 * embeds each chunk with text-embedding-3-small, and writes the resulting
 * KnowledgeIndex to data/knowledge.json.
 *
 * Source:
 *   Portfolio JSON snapshot — fetches PORTFOLIO_JSON_URL
 *   (defaults to a hand-maintained portfolio.json URL). Only includes projects
 *   visible on the site.
 *
 * ## Vercel build integration
 *
 * `vercel-build` runs this before `tsc` so the deployed knowledge index is
 * always fresh from the snapshot. To keep code-only deploys from failing when
 * the snapshot is temporarily unreachable, the Vercel build sets
 * `KNOWLEDGE_BUILD_STRICT=false`, which converts a failed rebuild into a
 * warning-plus-exit-0 and preserves the committed data/knowledge.json.
 *
 * The strict/lenient toggle:
 *
 *   KNOWLEDGE_BUILD_STRICT=true   (default, and what local/manual runs use)
 *     Any error (fetch failure, missing env var, embedding API 5xx)
 *     is fatal — exit 1. Use this locally so you notice broken creds fast.
 *
 *   KNOWLEDGE_BUILD_STRICT=false  (Vercel build sets this)
 *     On failure, log the error and exit 0 with a fallback notice. The
 *     committed data/knowledge.json is preserved unchanged. Use this on
 *     Vercel so a code-only deploy never breaks when the snapshot is stale.
 *
 * Run:
 *   OPENAI_API_KEY=... bun run build:knowledge                        # portfolio.json, strict
 *   KNOWLEDGE_BUILD_STRICT=false bun run build:knowledge               # lenient — Vercel pattern
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import OpenAI from "openai";
import { traced } from "../integrations/langfuse.js";
import type { KnowledgeChunk, KnowledgeIndex } from "./types.js";

const PORTFOLIO_JSON_URL =
	process.env.PORTFOLIO_JSON_URL || "https://your-domain.com/data/portfolio.json";
const EMBEDDING_MODEL = "text-embedding-3-small";
const OUT_PATH = join(process.cwd(), "data", "knowledge.json");

// Normalized shape the source snapshot is funneled into before chunking.
interface NormalizedProject {
	id: string;
	title: string;
	description: string;
	technologies: string[];
	features: string[];
	githubUrl?: string;
	liveUrl?: string;
}
interface NormalizedExperience {
	id: string;
	title: string;
	company: string;
	period: string;
	startDate?: string;
	endDate?: string;
	location?: string;
	achievements: string[];
	technologies: string[];
	talkingPoints?: string;
}
interface NormalizedSite {
	name: string;
	url: string;
	socialLinks: Array<{ id: string; name: string; url: string }>;
}
interface NormalizedSnapshot {
	projects: NormalizedProject[];
	experience: NormalizedExperience[];
	site: NormalizedSite;
	sourceLabel: string;
}

const FALLBACK_SITE: NormalizedSite = {
	name: "Usman Amjad - Software Engineer",
	url: "https://your-domain.com",
	socialLinks: [
		{ id: "email", name: "Email", url: "mailto:usmanamjad495@gmail.com" },
	],
};

// Parse portfolio.json's free-form period ("May 2022 - 2026", "Jan 2020 - May 2022")
// into ISO-ish start/end dates good enough for month-delta math. Returns
// { start: undefined, end: undefined } if we can't confidently parse.
const MONTHS: Record<string, number> = {
	jan: 0,
	feb: 1,
	mar: 2,
	apr: 3,
	may: 4,
	jun: 5,
	jul: 6,
	aug: 7,
	sep: 8,
	oct: 9,
	nov: 10,
	dec: 11,
};
function parsePeriod(period: string): { start?: string; end?: string } {
	const norm = period.replace(/–/g, "-");
	const [rawStart, rawEnd] = norm.split(/\s*-\s*/).map((s) => s.trim());
	const toISO = (s?: string): string | undefined => {
		if (!s) return undefined;
		if (/^present$/i.test(s)) return new Date().toISOString().slice(0, 10);
		const m = s.match(/^(?:(\w+)\s+)?(\d{4})$/);
		if (!m) return undefined;
		const mo = m[1] ? MONTHS[m[1].slice(0, 3).toLowerCase()] : 0;
		if (m[1] && mo === undefined) return undefined;
		return `${m[2]}-${String((mo ?? 0) + 1).padStart(2, "0")}-01`;
	};
	return { start: toISO(rawStart), end: toISO(rawEnd) };
}

interface PortfolioExperienceRaw {
	id: string;
	title: string;
	company: string;
	period: string;
	location?: string;
	achievements: string[];
	current?: boolean;
	technologies?: string[];
}

async function fetchFromPortfolioJson(
	url: string,
): Promise<NormalizedSnapshot> {
	console.log(`[rag-build] source: portfolio JSON snapshot (${url})`);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(
			`Portfolio snapshot fetch failed: ${res.status} ${res.statusText}`,
		);
	}
	const snap = (await res.json()) as {
		projects: NormalizedProject[];
		experience: PortfolioExperienceRaw[];
		site?: NormalizedSite;
	};
	const experience: NormalizedExperience[] = snap.experience.map((e) => {
		const { start, end } = parsePeriod(e.period);
		return {
			id: e.id,
			title: e.title,
			company: e.company,
			period: e.period,
			startDate: start,
			endDate: e.current ? undefined : end,
			location: e.location,
			achievements: e.achievements,
			technologies: e.technologies ?? [],
		};
	});
	return {
		projects: snap.projects,
		experience,
		site: snap.site ?? FALLBACK_SITE,
		sourceLabel: url,
	};
}

function chunkProject(p: NormalizedProject): KnowledgeChunk {
	const parts: string[] = [`# Project: ${p.title}`, "", p.description, ""];
	if (p.technologies.length)
		parts.push(`Technologies: ${p.technologies.join(", ")}`, "");
	if (p.features.length) {
		parts.push("Key features:");
		for (const f of p.features) parts.push(`- ${f}`);
		parts.push("");
	}
	if (p.githubUrl) parts.push(`GitHub: ${p.githubUrl}`);
	if (p.liveUrl) parts.push(`Live demo: ${p.liveUrl}`);
	return {
		id: `project:${p.id}`,
		title: p.title,
		text: parts.join("\n"),
		embedding: [],
		kind: "project",
	};
}

function chunkExperience(e: NormalizedExperience): KnowledgeChunk {
	const parts: string[] = [
		`# Experience: ${e.title} @ ${e.company}`,
		`Period: ${e.period}`,
	];
	if (e.location) parts.push(`Location: ${e.location}`);
	if (e.technologies.length)
		parts.push(`Technologies: ${e.technologies.join(", ")}`);
	parts.push("", "Achievements:");
	for (const a of e.achievements) parts.push(`- ${a}`);
	// Interview-only prose. The chatbot is conversational, so it opts into
	// this narrative color (same rationale as projects). The resume path in
	// job-search-pipeline structurally cannot read it.
	if (e.talkingPoints) {
		parts.push("", "Talking points:", e.talkingPoints);
	}
	return {
		id: `experience:${e.id}`,
		title: `${e.title} @ ${e.company}`,
		text: parts.join("\n"),
		embedding: [],
		kind: "experience",
	};
}

// Text patterns → canonical skill name. Lets us count PHP time spent on
// WordPress/WooCommerce/CakePHP/YII2 roles even when tech_stack tags are missing
// or use framework names instead of the base language. Case-insensitive, matched
// as whole-word substrings of the technology token and achievement text.
const SKILL_ALIASES: Record<string, string[]> = {
	PHP: [
		"php",
		"wordpress",
		"woocommerce",
		"cakephp",
		"yii2",
		"acf",
		"psr-4",
		"phpunit",
		"phpstan",
	],
	TypeScript: ["typescript", "next.js", "nextjs"],
	Python: [
		"python",
		"fastapi",
		"pydantic",
		"sqlalchemy",
		"pytest",
		"django",
		"celery",
	],
	React: ["react", "react.js", "react 18", "react 19", "next.js", "expo"],
	Node: ["node.js", "node ", "express", "vitest", "jest"],
	Docker: ["docker", "docker compose", "kubernetes"],
	AWS: ["aws", "lambda", "ec2", "s3", "iam", "eventbridge"],
	Shopify: ["shopify", "liquid", "storefront api", "admin api"],
	PostgreSQL: ["postgresql", "postgres"],
	Redis: ["redis"],
};

function detectSkills(...texts: string[]): Set<string> {
	const haystack = texts.join(" ").toLowerCase();
	const hit = new Set<string>();
	for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
		if (aliases.some((a) => haystack.includes(a))) hit.add(canonical);
	}
	return hit;
}

function monthsBetween(startISO: string, endISO: string): number {
	const s = new Date(startISO);
	const e = new Date(endISO);
	return Math.max(
		0,
		(e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()),
	);
}

// Aggregate skill mentions across all experience + projects into a single
// chunk. Callers asking summation questions ("how many years of X",
// "what's your Python experience") match this at the top and get a
// per-skill total + source-of-truth list to justify the number.
function chunkSkillsSummary(
	experience: NormalizedExperience[],
	projects: NormalizedProject[],
): KnowledgeChunk {
	interface Row {
		months: number;
		roles: string[];
		projects: string[];
	}
	const bySkill = new Map<string, Row>();
	const row = (s: string): Row => {
		let r = bySkill.get(s);
		if (!r) {
			r = { months: 0, roles: [], projects: [] };
			bySkill.set(s, r);
		}
		return r;
	};
	const today = new Date().toISOString().slice(0, 10);

	for (const e of experience) {
		const skills = detectSkills(...e.technologies, ...e.achievements, e.title);
		const start = e.startDate;
		const end = e.endDate ?? today;
		const months = start ? monthsBetween(start, end) : 0;
		const roleLabel = `${e.title} @ ${e.company} (${e.period})`;
		for (const s of skills) {
			const r = row(s);
			r.months += months;
			r.roles.push(roleLabel);
		}
	}
	for (const p of projects) {
		const skills = detectSkills(
			...p.technologies,
			p.description,
			...p.features,
			p.title,
		);
		for (const s of skills) row(s).projects.push(p.title);
	}

	const sorted = [...bySkill.entries()].sort(
		(a, b) => b[1].months - a[1].months,
	);
	// Intro deliberately front-loads the phrases visitors ask with — "how
	// many years of X", "how much experience with X", "which technologies"
	// — so the chunk embeds close to aggregate-skill queries. (This chunk
	// is also pinned in retrieve.ts as a belt-and-suspenders; the intro
	// helps if someone changes the pinning logic later.)
	const lines: string[] = [
		"# Skills summary — how many years of experience with each technology",
		"",
		"Authoritative per-technology totals. When asked 'how many years of X',",
		"'how much experience with X', or 'which technologies has Usman used',",
		"quote the numbers below verbatim rather than re-estimating from",
		"individual roles. Overlapping/concurrent role time is summed.",
		"",
	];
	for (const [skill, r] of sorted) {
		const years = (r.months / 12).toFixed(1);
		lines.push(`## ${skill}: ~${years} years`);
		if (r.roles.length) {
			lines.push("Used in roles:");
			for (const role of r.roles) lines.push(`- ${role}`);
		}
		if (r.projects.length) {
			lines.push("Also used in projects:");
			for (const proj of r.projects) lines.push(`- ${proj}`);
		}
		lines.push("");
	}
	return {
		id: "skills:summary",
		title: "Skills summary",
		text: lines.join("\n"),
		embedding: [],
		kind: "skills",
	};
}

function chunkSite(site: NormalizedSite): KnowledgeChunk {
	const socials = site.socialLinks.map((s) => `${s.name}: ${s.url}`).join("\n");
	return {
		id: "site:contact",
		title: "Contact / social",
		text: `# Contact and social links\n\nSite: ${site.name} (${site.url})\n\n${socials}`,
		embedding: [],
		kind: "site",
	};
}

async function main() {
	if (!process.env.OPENAI_API_KEY) {
		throw new Error(
			"OPENAI_API_KEY is required to build the RAG index. Set it in the build environment.",
		);
	}

	const snap = await fetchFromPortfolioJson(PORTFOLIO_JSON_URL);

	const chunks: KnowledgeChunk[] = [
		chunkSite(snap.site),
		chunkSkillsSummary(snap.experience, snap.projects),
		...snap.projects.map(chunkProject),
		...snap.experience.map(chunkExperience),
	];
	console.log(
		`[rag-build] chunked ${snap.projects.length} projects + ${snap.experience.length} experience entries + 1 site + 1 skills summary = ${chunks.length} chunks`,
	);

	const openai = traced(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), {
		generationName: "rag.build.embed",
		metadata: { chunkCount: chunks.length, model: EMBEDDING_MODEL },
	});
	const embeddingRes = await openai.embeddings.create({
		model: EMBEDDING_MODEL,
		input: chunks.map((c) => c.text),
	});
	for (let i = 0; i < chunks.length; i++) {
		chunks[i].embedding = embeddingRes.data[i].embedding;
	}
	console.log(
		`[rag-build] embedded ${chunks.length} chunks with ${EMBEDDING_MODEL} (${embeddingRes.usage.total_tokens} tokens, $${((embeddingRes.usage.total_tokens / 1_000_000) * 0.02).toFixed(5)})`,
	);

	const index: KnowledgeIndex = {
		generatedAt: new Date().toISOString(),
		sourceUrl: snap.sourceLabel,
		embeddingModel: EMBEDDING_MODEL,
		chunks,
	};

	mkdirSync(dirname(OUT_PATH), { recursive: true });
	writeFileSync(OUT_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
	console.log(`[rag-build] wrote ${OUT_PATH}`);
}

// Strict mode is the default. Vercel's `vercel-build` explicitly overrides
// to `false` so a stale snapshot never breaks an otherwise-clean deploy.
const STRICT = process.env.KNOWLEDGE_BUILD_STRICT !== "false";

main().catch((e) => {
	console.error("[rag-build] FAILED:", e);
	if (STRICT) {
		process.exit(1);
	}
	console.error(
		"[rag-build] KNOWLEDGE_BUILD_STRICT=false — preserving committed data/knowledge.json and continuing",
	);
	process.exit(0);
});
