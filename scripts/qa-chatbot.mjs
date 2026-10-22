/**
 * Chatbot QA harness.
 *
 * Pulls the REAL product catalog from Shopify, then fires a broad set of
 * realistic customer questions at the running API and validates every reply
 * against ground truth:
 *
 *   - the reply is in English (no Roman Urdu leakage)
 *   - every product link mentioned exists in the catalog
 *   - every price mentioned matches a real product price
 *   - no product category is invented (the classic "we also sell sports bras")
 *   - policy questions give the real contact details and no product cards
 *   - order questions never invent an order status
 *   - product questions do produce product cards
 *
 * Usage:
 *   bun run dev            # in one terminal
 *   bun run qa             # in another
 *
 * Environment:
 *   API_URL   defaults to http://localhost:3000
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.API_URL || "http://localhost:3000";
const REPORT = join(ROOT, "qa-report.json");

/* ------------------------------------------------------------------ *
 * Ground truth from Shopify
 * ------------------------------------------------------------------ */
function readEnv() {
	const env = {};
	const path = join(ROOT, ".env.local");
	if (!existsSync(path)) return env;
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
		if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
	}
	return env;
}

async function fetchCatalog() {
	const env = readEnv();
	const domain = env.SHOPIFY_STORE_DOMAIN;
	const version = env.SHOPIFY_API_VERSION || "2026-07";
	if (!domain) throw new Error("SHOPIFY_STORE_DOMAIN is not set in .env.local");

	const tok = await fetch(`https://${domain}/admin/oauth/access_token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: env.SHOPIFY_CLIENT_ID || "",
			client_secret: env.SHOPIFY_CLIENT_SECRET || "",
		}),
	});
	const token = await tok.json();
	if (!token.access_token) {
		throw new Error(
			`Could not get a Shopify access token: ${JSON.stringify(token)}`,
		);
	}

	const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Shopify-Access-Token": token.access_token,
		},
		body: JSON.stringify({
			query: `{
				products(first: 100) { edges { node {
					title handle onlineStoreUrl
					priceRangeV2 { minVariantPrice { amount currencyCode } }
				} } }
			}`,
		}),
	});
	const data = await res.json();
	const edges = data?.data?.products?.edges || [];
	return edges.map((e) => ({
		title: e.node.title,
		handle: e.node.handle,
		url: e.node.onlineStoreUrl,
		price: e.node.priceRangeV2?.minVariantPrice?.amount,
		currency: e.node.priceRangeV2?.minVariantPrice?.currencyCode,
	}));
}

/* ------------------------------------------------------------------ *
 * Reply validation
 * ------------------------------------------------------------------ */
const ROMAN_URDU =
	/\b(?:kya|hai|hain|hoon|krdo|karo|kro|chahta|chahiye|chiye|dikhao|dikha|kitne|mein|aur|kaisa|kaisi|bohot|bohat|bilkul|shukriya|aap|mera|meri|apna|apni|batao|bata)\b/i;

const CATEGORY_TERMS = [
	"laptop", "iphone", "mobile phone", "samsung", "tablet", "tv", "camera", "shoe", "sneaker",
	"watch", "bag", "kitchen", "sofa", "mattress", "helmet", "tyre", "tractor", "rice", "grocery",
	"bra", "shorts", "pants", "trousers", "jeans", "dress", "skirt", "hoodie", "coat", "sweater",
	"shirt", "tshirt", "t-shirt", "cap", "hat", "wallet", "socks", "belt", "tie", "scarf", "gloves",
	"ring", "necklace", "earrings", "perfume", "makeup", "phone", "headphone", "speaker", "printer",
	"router", "battery", "charger", "toy", "book", "rug", "curtain", "pillow", "chair", "table",
	"cooker", "fridge", "kettle", "blender", "bike", "bicycle", "car", "oil", "tea", "coffee",
	"chocolate", "kurta", "shalwar", "kameez", "dupatta", "saree", "lehenga", "tracksuits",
];

/**
 * A product-category noun that is not in the real catalog is a fabricated
 * product. Negations ("we do not sell laptops") and contact wording ("by
 * phone", "phone/WhatsApp") are not product claims.
 */
function findInventedCategories(text, catalog) {
	const catalogText = catalog.map((p) => p.title.toLowerCase()).join(" ");
	const found = [];
	const lower = text.toLowerCase();

	for (const term of CATEGORY_TERMS) {
		const esc = term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		const re = new RegExp(`\\b${esc}s?\\b`, "gi");
		let m;
		while ((m = re.exec(lower))) {
			const before = lower.slice(Math.max(0, m.index - 70), m.index);
			const after = lower.slice(m.index, m.index + m[0].length + 40);

			if (/\b(not|n't|never|no longer|cannot|can't|nothing)\b[^.]*$/i.test(before)) continue;
			if (
				/^phone$/.test(term) &&
				(/\bby\s*$/i.test(before) || /\/(whatsapp|call)|number/i.test(after))
			) {
				continue;
			}
			if (catalogText.includes(term)) continue;

			found.push(term);
			break;
		}
	}
	return found;
}

function extractPrices(text) {
	const out = [];
	const re = /(?:rs\.?\s*|pkr\s*|\$)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi;
	let m;
	while ((m = re.exec(text))) out.push(Number(m[1].replace(/,/g, "")));
	// Standalone numbers — but not "#1234" (an order-number example).
	const bare = /(?<![\w.#])([0-9]{3,6}(?:\.0+)?)(?![\w.])/g;
	while ((m = bare.exec(text))) out.push(Number(m[1]));
	return out;
}

function extractHandles(text) {
	const out = [];
	const re = /myflexifit\.com\/products\/([a-z0-9-]+)/gi;
	let m;
	while ((m = re.exec(text))) out.push(m[1].toLowerCase());
	return out;
}

function extractTitles(text, catalog) {
	const found = [];
	const lower = text.toLowerCase();
	for (const p of catalog) {
		const words = p.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
		for (let i = 0; i + 2 < words.length; i++) {
			if (lower.includes(words.slice(i, i + 3).join(" "))) {
				found.push(p.title);
				break;
			}
		}
	}
	return found;
}

/* ------------------------------------------------------------------ *
 * Test cases
 * ------------------------------------------------------------------ */
const CASES = [
	{ q: "What products do you have?", kind: "catalog", expectCards: true },
	{ q: "kya products hain?", kind: "catalog", expectCards: true },
	{ q: "Show me puffer jackets", kind: "catalog", expectCards: true },
	{ q: "Black puffer jacket ki price batao", kind: "catalog", expectCards: true },
	{ q: "Do you have jackets for men?", kind: "catalog", expectCards: true },
	{ q: "What colours are available?", kind: "catalog", expectCards: true },
	{ q: "Sizing guide batao M se 2XL tak", kind: "catalog", expectCards: true },
	{ q: "Difference between white and black jacket?", kind: "catalog", expectCards: true },
	{ q: "Delivery kitne din mein hoti hai?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "Shipping charges kitne hain?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "COD available hai?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "Return policy kya hai?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "Payment methods kya hain?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "Mera order #1001 track karo", kind: "order", expectCards: false },
	{ q: "order #12345 kahan hai", kind: "order", expectCards: false },
	{ q: "My order status please", kind: "order", expectCards: false },
	{ q: "Assalam-o-Alaikum", kind: "greeting", expectCards: false },
	{ q: "Hello, who are you?", kind: "greeting", expectCards: false },
	{ q: "Do you sell laptops?", kind: "out-of-store", expectCards: false, forbidden: ["laptop"] },
	{ q: "Can you give me a discount?", kind: "out-of-store", expectCards: false },
	{ q: "Kya aap COD aur free delivery karte ho?", kind: "policy", expectCards: false, expectContact: true },
	{ q: "What is the weather today?", kind: "off-topic", expectCards: false },
	{ q: "hi", kind: "greeting", expectCards: false },
	{ q: "pufer jaket ki daam kya hai", kind: "catalog", expectCards: true },
	{ q: "mera order track karo", kind: "order", expectCards: false },
	{ q: "jacket 😊 price?", kind: "catalog", expectCards: true },
	{ q: "I want to buy a winter jacket for my father, what do you recommend?", kind: "catalog", expectCards: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
const catalog = await fetchCatalog();
const realPrices = new Set(catalog.map((p) => Number(p.price)));
const realHandles = new Set(catalog.map((p) => (p.handle || "").toLowerCase()));
const realTitles = catalog.map((p) => p.title.toLowerCase());

console.log(`Ground truth: ${catalog.length} products`);
for (const p of catalog) {
	console.log(`  - ${p.title} | ${p.currency} ${p.price} | ${p.handle}`);
}
console.log("");

const results = [];
for (const c of CASES) {
	let r;
	let lastError = null;

	// The model provider can reject bursts with 402/429 ("in-flight requests").
	// Retry with a backoff so a transient provider limit is not reported as a
	// product/UX failure.
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await fetch(`${API}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					message: c.q,
					strategyType: "ecommerce",
					sessionId: `qa-${Math.random().toString(36).slice(2)}`,
				}),
			});
			const body = await res.json();
			if (res.ok && body?.success) {
				r = body;
				break;
			}
			lastError = new Error(
				`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 160)}`,
			);
		} catch (error) {
			lastError = error;
		}
		await sleep(6000 * (attempt + 1));
	}

	if (!r) {
		results.push({
			...c,
			reply: `ERROR ${lastError ? lastError.message : "unknown"}`,
			cards: 0,
			issues: ["request failed"],
		});
		await sleep(2500);
		continue;
	}

	const reply = r?.data?.message || "";
	const cards = r?.data?.products || [];
	const issues = [];

	// 1. English only
	const urdu = reply.match(ROMAN_URDU);
	if (urdu) {
		issues.push(
			`Roman Urdu leaked: ${[...new Set(urdu.map((m) => m[0]))].join(", ")}`,
		);
	}

	// 2. links must be real
	for (const h of extractHandles(reply)) {
		if (!realHandles.has(h)) issues.push(`fabricated link handle: ${h}`);
	}

	// 3. prices must be real
	for (const price of extractPrices(reply)) {
		const known =
			[...realPrices].some((rp) => Math.abs(rp - price) < 0.01) ||
			price === 1001 ||
			price === 12345;
		if (!known) issues.push(`price not in catalog: ${price}`);
	}

	// 4. product titles must be real
	for (const t of extractTitles(reply, catalog)) {
		if (!realTitles.includes(t.toLowerCase())) issues.push(`unknown title: ${t}`);
	}

	// 5. must not claim to sell out-of-store categories
	for (const bad of c.forbidden || []) {
		const claims = new RegExp(
			`(we (sell|offer|have|stock)|available|in stock|our ${bad}s)`,
			"i",
		);
		if (
			claims.test(reply) &&
			!/do not|don't|not (sell|offer|have)|no /i.test(reply)
		) {
			issues.push(`claims to sell "${bad}"`);
		}
	}

	// 6. must not invent a product category
	for (const term of findInventedCategories(reply, catalog)) {
		issues.push(`invented product category: "${term}"`);
	}

	// 7. card expectations
	if (c.expectCards && cards.length === 0) issues.push("expected product cards, got 0");
	if (c.expectCards === false && cards.length > 0) {
		issues.push(`expected 0 cards, got ${cards.length}`);
	}

	// 8. card links must be real
	for (const card of cards) {
		if (!card.url) {
			issues.push(`card without url: ${card.title}`);
		} else {
			const handle = (card.url.split("/products/")[1] || "").toLowerCase();
			if (!realHandles.has(handle)) {
				issues.push(`card link not in catalog: ${handle}`);
			}
		}
	}

	// 9. policy questions must give real contact info
	if (c.expectContact) {
		const hasEmail = /flexifit\.pk@gmail\.com/i.test(reply);
		const hasPhone = /\+923265381617/i.test(reply);
		if (!hasEmail && !hasPhone) issues.push("no real contact info given");
	}

	// 10. order questions must not invent order data
	if (
		c.kind === "order" &&
		/\b(confirmed|shipped|processing|delivered|fulfill)\b/i.test(reply) &&
		!/couldn't find|could not find|no order|double-check|provide your order number/i.test(
			reply,
		)
	) {
		issues.push("invented order status");
	}

	results.push({ ...c, reply, cards: cards.length, issues });
	await sleep(2500);
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */
let passed = 0;
for (const r of results) if (r.issues.length === 0) passed++;

console.log("=".repeat(78));
console.log(`RESULT: ${passed}/${results.length} passed`);
console.log("=".repeat(78));
for (const r of results) {
	const ok = r.issues.length === 0;
	console.log(`\n${ok ? "PASS" : "FAIL"}  [${r.kind}] "${r.q}"  (cards=${r.cards})`);
	if (!ok) for (const i of r.issues) console.log(`      !! ${i}`);
	console.log(`      -> ${r.reply.replace(/\s+/g, " ").slice(0, 220)}`);
}

writeFileSync(REPORT, JSON.stringify(results, null, 2), "utf8");
console.log(`\nReport written to ${REPORT}`);

if (passed !== results.length) {
	console.error(`\n${results.length - passed} case(s) failed.`);
	process.exit(1);
}
console.log(`\nAll ${results.length} cases passed.`);
