/**
 * Product-intent classification and search-term preparation.
 *
 * Two problems this solves:
 *
 * 1. The API used to run a Shopify catalog search for *every* message —
 *    including "Assalam-o-Alaikum" and "what is the weather". That wasted an
 *    API call and pushed four product cards at customers who never asked
 *    about a product.
 * 2. The search term was the raw message minus a few stop words, so
 *    "Black puffer jacket batao" became the literal query
 *    "Black puffer jacket batao", which matches nothing in Shopify.
 *
 * Everything here is pure and side-effect free so it can be unit tested.
 */

import { searchProducts } from "../integrations/shopify.js";

export type ChatIntent =
	| "product"
	| "policy"
	| "order"
	| "greeting"
	| "discount"
	| "off_topic";

/* ------------------------------------------------------------------ *
 * Intent patterns
 * ------------------------------------------------------------------ */

// Order tracking / order status, with or without an order number.
const ORDER_PATTERN =
	/\b(orders?|order\s*(?:status|no\.?|number|id)|track(?:ing)?\s*(?:my\s+|the\s+)?orders?|where\s+is\s+my\s+order|order\s*kahan|mera\s*orders?|my\s*orders?)\b/i;

// Returns, refunds, warranty — always a support flow, never a catalog search.
const RETURN_PATTERN =
	/\b(returns?|refunds?|exchange|replace[ds]?|warranty|damaged|defective|broken|cancel(?:lation|led|s)?)\b/i;

// Anything that points at merchandise.
const PRODUCT_PATTERN =
	/\b(jackets?|puffer|coats?|hoodies|sweaters?|shirts?|t-?shirts?|tshirts?|trousers?|jeans|dress(?:es)?|skirts?|products?|items?|collection|catalog(?:ue)?|prices?|sizes?|colou?rs?|bags?|wallets?|caps?|prints?|frames?|art|arts?|wear|clothing|cloths|outfits?|winter|summer|spring|autumn|size\s+guide|size\s+chart)\b/i;

// "Show me", "what do you have", "kya products hain" …
// The Roman Urdu part deliberately requires a product noun, otherwise
// "payment methods kya hain" ("what are the payment methods") would be
// mistaken for a request to browse the catalog.
const BROWSE_PATTERN =
	/\b(what\s+do\s+you\s+(?:have|sell|offer)|show\s+me|list\s+(?:all|your|me)|browse|collection|all\s+products?|everything|kya\s+(?:products?|items?|cheezain|jackets?|kapde|maal|coats?|sweaters?)\s*(?:hain|hai|mil|milte|available)?|dikhao|dikha|sab\s+dikhao)\b/i;

// Discount / promotion requests.
const DISCOUNT_PATTERN =
	/\b(discount|discounts|coupon|coupons|promo\s*code|voucher|price\s*drop|bargain|cheaper|any\s+offers?|offers?)\b/i;

// Store policy — the assistant has no data for these, so it hands over contact.
const POLICY_PATTERN =
	/\b(delivery|shipping|shipment|courier|dispatch|charges?|cash\s+on\s+delivery|\bcod\b|payment|payments|installments?|kitne\s+din|charges?\s+kitne)\b/i;

// Clearly unrelated to the store.
const OFF_TOPIC_PATTERN =
	/\b(weather|forecast|news|football|cricket|match\s+score|recipe|joke|story|poem|translate|translation|who\s+won|election|horoscope|stock\s+market|bitcoin|medicine|symptoms?)\b/i;

// Greetings and sign-offs.
const GREETING_PATTERN =
	/^\s*(hi|hey|hello|yo|hiya|salam|salaam|assalam|assalam-o-alaikum|wa\s?alaikum|waalaikum|thanks|thank\s*you|thx|ty|bye|goodbye|ok|okay|cool|nice|great|awesome|yes|yeah|no|nope|haan|nahi|good\s+morning|good\s+evening|good\s+night)\b/i;

const IDENTITY_PATTERN =
	/\b(who\s+are\s+you|what(?:'s|\s+is)\s+your\s+name|your\s+name|what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+do\s+you\s+do|are\s+you\s+(?:a\s+)?(?:bot|robot|ai))\b/i;

/**
 * Classify what the customer is actually asking about.
 *
 * Order of checks matters: "I want to return my jacket" is a return, not a
 * catalog question, so the support patterns are tested before the product
 * pattern.
 */
export function classifyIntent(message: string): ChatIntent {
	const text = message.toLowerCase().trim();

	if (ORDER_PATTERN.test(text)) return "order";
	if (RETURN_PATTERN.test(text)) return "policy";
	if (PRODUCT_PATTERN.test(text) || BROWSE_PATTERN.test(text)) return "product";
	if (DISCOUNT_PATTERN.test(text)) return "discount";
	if (POLICY_PATTERN.test(text)) return "policy";
	if (OFF_TOPIC_PATTERN.test(text)) return "off_topic";
	if (GREETING_PATTERN.test(text) || IDENTITY_PATTERN.test(text))
		return "greeting";

	// Unknown — let the catalog search decide. If it finds nothing the
	// customer simply does not carry that item, and we say so.
	return "product";
}

/* ------------------------------------------------------------------ *
 * Search term preparation
 * ------------------------------------------------------------------ */

/**
 * Words that carry no signal for a product search. Deliberately includes
 * Roman Urdu question words — they used to end up inside the Shopify query
 * and broke it.
 */
const STOP_WORDS = new Set([
	// English
	"what",
	"when",
	"where",
	"which",
	"who",
	"whom",
	"whose",
	"why",
	"how",
	"can",
	"you",
	"your",
	"yours",
	"the",
	"and",
	"for",
	"from",
	"with",
	"are",
	"was",
	"were",
	"will",
	"would",
	"should",
	"could",
	"have",
	"has",
	"had",
	"tell",
	"show",
	"give",
	"find",
	"search",
	"look",
	"about",
	"any",
	"some",
	"please",
	"much",
	"many",
	"get",
	"got",
	"need",
	"want",
	"buy",
	"purchase",
	"tell",
	"know",
	"like",
	"also",
	"there",
	"here",
	"that",
	"this",
	"these",
	"those",
	"then",
	"than",
	"them",
	"they",
	"me",
	"my",
	"mine",
	"we",
	"our",
	"us",
	"not",
	"but",
	"all",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"available",
	"option",
	"options",
	"difference",
	"between",
	"differ",
	"recommend",
	"recommendation",
	"suggest",
	"suggestion",
	"price",
	"prices",
	"priced",
	"cost",
	"costs",
	"expensive",
	"cheap",
	"cheapest",
	"size",
	"sizes",
	"guide",
	"chart",
	"color",
	"colours",
	"colors",
	"colour",
	// Roman Urdu
	"kya",
	"hai",
	"hain",
	"hoon",
	"ho",
	"hona",
	"krdo",
	"kardo",
	"karo",
	"kro",
	"kr",
	"kar",
	"kari",
	"karke",
	"chahta",
	"chahiye",
	"chiye",
	"dikhao",
	"dikha",
	"dikh",
	"dikhaye",
	"batao",
	"bata",
	"bataye",
	"baat",
	"kitne",
	"kitna",
	"kitni",
	"kaisa",
	"kaisi",
	"kaisay",
	"bohot",
	"bohat",
	"bilkul",
	"shukriya",
	"jazakallah",
	"aap",
	"mera",
	"meri",
	"meray",
	"apna",
	"apni",
	"apne",
	"mujhe",
	"mujhko",
	"hamare",
	"tum",
	"tumhe",
	"tumhara",
	"kya",
	"kis",
	"kisko",
	"kisi",
	"sab",
	"sari",
	"sabhi",
	"wala",
	"wali",
	"waala",
	"wali",
	"wala",
	"liye",
	"kyun",
	"kyunki",
	"lekin",
	"phir",
	"baad",
	"pehle",
	"abhi",
	"bhi",
	"hi",
	"to",
	"tak",
	"waala",
	// Urdu numerals/words that survive lowercasing
	"hai",
	"hain",
	"raha",
	"rahi",
	"rahe",
	"kro",
	"krna",
	"krne",
]);

/**
 * Build a Shopify search term from a customer message.
 * Returns an empty string for a browse request (the full catalog is shown).
 */
export function buildSearchTerm(message: string): string {
	const cleaned = message
		.replace(/[^\w\s-]/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
		.join(" ");

	return cleaned;
}

/**
 * True when the message is a "show me everything" request rather than a
 * lookup for one specific product.
 */
export function isBrowseRequest(message: string): boolean {
	const text = message.toLowerCase();
	return (
		BROWSE_PATTERN.test(text) ||
		/\b(what\s+(?:products?|items?|do\s+you\s+(?:have|sell|offer))|all\s+products?|show\s+(?:me\s+)?(?:all|everything)|list\s+(?:all|your))\b/i.test(
			text,
		)
	);
}

/**
 * True when the customer is asking about sizes / fit.
 *
 * A size question is still a product question, and the answer lives in the
 * product variants — so the assistant needs the catalog, not a filtered
 * search result.
 */
export function wantsSizeInfo(message: string): boolean {
	return /\b(sizes?|sizing|fit|fitting|measurement|measurements)\b/i.test(
		message,
	);
}

/* ------------------------------------------------------------------ *
 * Typo tolerance
 * ------------------------------------------------------------------ */

/**
 * Levenshtein distance, capped for performance (returns limit + 1 early).
 */
function editDistance(a: string, b: string, limit: number): number {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;

	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const curr = [i];
		let rowMin = i;
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			const value = Math.min(
				(prev[j] ?? 0) + 1,
				(curr[j - 1] ?? 0) + 1,
				(prev[j - 1] ?? 0) + cost,
			);
			curr[j] = value;
			if (value < rowMin) rowMin = value;
		}
		if (rowMin > limit) return limit + 1;
		prev = curr;
	}
	return prev[b.length] ?? limit + 1;
}

/**
 * Repair a misspelled search term using the catalog's own words.
 *
 * "pufer jaket" -> "puffer jacket", which is what a Pakistani customer
 * actually types when they misspell in Roman Urdu.
 */
export function repairSearchTerm(
	term: string,
	catalogTokens: string[],
): string {
	if (!term || catalogTokens.length === 0) return term;

	const words = term.split(/\s+/);
	const repaired = words.map((word) => {
		const lower = word.toLowerCase();
		if (catalogTokens.includes(lower)) return word;
		if (lower.length < 4) return word;

		const limit = lower.length >= 7 ? 2 : 1;
		let best: string | null = null;
		let bestDistance = limit + 1;

		for (const token of catalogTokens) {
			const distance = editDistance(lower, token, limit);
			if (distance < bestDistance) {
				bestDistance = distance;
				best = token;
			}
		}

		return best && bestDistance <= limit ? best : word;
	});

	return repaired.join(" ");
}

/**
 * Distinctive words from the catalog titles, used for typo repair and for
 * deciding whether a question is about something the store actually sells.
 */
export function extractCatalogTokens(
	products: Array<{ title: string }>,
): string[] {
	const tokens = new Set<string>();
	for (const product of products) {
		for (const word of product.title.toLowerCase().split(/[^a-z0-9]+/)) {
			if (word.length > 2) tokens.add(word);
		}
	}
	return [...tokens];
}

let cachedCatalogTokens: string[] = [];
let cachedCatalogTokensAt = 0;

/**
 * Distinctive words from the catalog titles, cached for an hour.
 *
 * Used to repair misspelled search terms — a customer typing Roman Urdu
 * ("pufer jaket") should still find the puffer jacket.
 */
export async function getCatalogTokens(): Promise<string[]> {
	if (
		cachedCatalogTokens.length > 0 &&
		Date.now() - cachedCatalogTokensAt < 60 * 60 * 1000
	) {
		return cachedCatalogTokens;
	}

	try {
		const products = await searchProducts("", 50);
		cachedCatalogTokens = extractCatalogTokens(products);
		cachedCatalogTokensAt = Date.now();
	} catch (error) {
		// Best effort — keep the previous list, the repair step is optional.
		console.warn(
			"[Shopify] Could not load catalog tokens for typo repair:",
			error instanceof Error ? error.message : error,
		);
	}

	return cachedCatalogTokens;
}
