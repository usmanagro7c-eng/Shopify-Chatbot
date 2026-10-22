import { existsSync } from "node:fs";
import dotenv from "dotenv";

// Load environment variables FIRST before other imports
// In Docker, environment variables are passed directly via docker-compose
// Locally, load from .env.local if it exists
if (existsSync(".env.local")) {
	dotenv.config({ path: ".env.local" });
} else if (process.env.NODE_ENV !== "production") {
	console.warn("[Warning] .env.local not found, using environment variables");
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
	buildSearchTerm,
	classifyIntent,
	getCatalogTokens,
	isBrowseRequest,
	repairSearchTerm,
	wantsSizeInfo,
} from "../bot/product-intent.js";
import { getAIResponse, getRateLimitStatus } from "../integrations/openai.js";
import type { ShopInfo, ShopifyProduct } from "../integrations/shopify.js";
import {
	checkShopifyHealth,
	getOrderByNumber,
	getShopInfo,
	searchProducts,
} from "../integrations/shopify.js";
import { formatContext, retrieveRelevant } from "../knowledge/retrieve.js";
import { StrategyFactory } from "../strategies/factory/StrategyFactory.js";
import type { StrategyType } from "../types/strategy.types.js";

// Debug: Log Shopify env vars
console.log(
	"[Debug] SHOPIFY_STORE_DOMAIN:",
	process.env.SHOPIFY_STORE_DOMAIN || "NOT SET",
);
console.log(
	"[Debug] SHOPIFY_STOREFRONT_ACCESS_TOKEN:",
	process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ? "SET" : "NOT SET",
);
console.log(
	"[Debug] SHOPIFY_ADMIN_API_TOKEN:",
	process.env.SHOPIFY_ADMIN_API_TOKEN ? "SET" : "NOT SET",
);

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for store website, local development, and custom domains
const allowedOrigins = ["http://localhost:3000", "http://localhost:3001"];

app.use((req, res, next) => {
	const origin = req.headers.origin;

	// Allow file:// protocol (null origin) for local testing or any connecting website/Shopify store
	if (!origin || origin === "null") {
		res.header("Access-Control-Allow-Origin", "*");
	} else if (
		allowedOrigins.includes(origin) ||
		origin.endsWith(".myshopify.com") ||
		(process.env.SHOPIFY_STORE_DOMAIN &&
			origin.includes(process.env.SHOPIFY_STORE_DOMAIN))
	) {
		res.header("Access-Control-Allow-Origin", origin);
	} else {
		// Allow custom store domains for public chat widget
		res.header("Access-Control-Allow-Origin", origin);
	}

	res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.header(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization, ngrok-skip-browser-warning",
	);
	res.header("Access-Control-Allow-Credentials", "true");

	// Handle preflight requests
	if (req.method === "OPTIONS") {
		return res.sendStatus(200);
	}

	next();
});

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../../public")));

// GET / - Welcome message
app.get("/", (_req, res) => {
	res.json({
		message: "AI Chatbot API",
		version: "1.0.0",
		documentation: "Send POST requests to /api/chat with optional strategyType",
		endpoints: {
			chat: "POST /api/chat - Send a message and get AI response (accepts: message, conversationHistory, strategyType)",
			health: "GET /api/health - Health check",
			rateLimit: "GET /api/rate-limit - Check rate limit status",
			strategies: "GET /api/strategies - List available strategy types",
			strategyInfo: "GET /api/strategy/:type - Get strategy information",
		},
		availableStrategies: StrategyFactory.getAvailableStrategies(),
	});
});

// POST /api/chat - Get AI response
app.post("/api/chat", async (req, res) => {
	try {
		const {
			message,
			conversationHistory,
			strategyType,
			sessionId,
			userId,
			storeInfo,
			products: clientProducts,
		} = req.body;

		if (!message) {
			res.status(400).json({ error: "Message is required" });
			return;
		}

		// Trace opts forwarded to Langfuse so retrieve + completion spans share a
		// sessionId/userId. Widget generates a UUID sessionId and persists it in
		// localStorage; host page can pass userId via AIChatbot.init({ userId }).
		const traceOpts =
			sessionId || userId
				? {
						sessionId: typeof sessionId === "string" ? sessionId : undefined,
						userId: typeof userId === "string" ? userId : undefined,
					}
				: undefined;

		// Get strategy (defaults to 'default' if not specified)
		const strategy = StrategyFactory.createStrategy(
			(strategyType as StrategyType) || "default",
		);

		// Check if strategy is enabled
		if (!strategy.isEnabled()) {
			res.status(503).json({
				success: false,
				error: "This chatbot strategy is currently disabled",
			});
			return;
		}

		// Get system prompt from strategy
		let systemPrompt = strategy.getSystemPrompt();
		let contextInfo = "";
		// Structured products returned alongside the AI text (for widget image cards).
		let productCards: {
			title: string;
			price: string;
			currency: string;
			url?: string;
			image?: string;
		}[] = [];

		// For portfolio strategy, do semantic retrieval over the RAG index
		// (built at deploy time from the portfolio snapshot).
		if (strategy.getType() === "portfolio") {
			try {
				const relevant = await retrieveRelevant(message, 3, traceOpts);
				if (relevant.length > 0) {
					contextInfo = formatContext(relevant);
					console.log(
						`[Chat API] portfolio RAG: injected ${relevant.length} chunks (${relevant.map((c) => c.id).join(", ")})`,
					);
				} else {
					console.log(
						`[Chat API] portfolio RAG: no chunks above similarity floor for "${message}"`,
					);
				}
			} catch (error) {
				console.error("[Chat API] portfolio RAG error:", error);
				// Continue with static system prompt if retrieval fails
			}
		}

		// For ecommerce strategy, retrieve product data and store context
		if (strategy.getType() === "ecommerce") {
			// Hoisted so the order-lookup block below can use the store currency
			// instead of assuming USD.
			let shopInfo: ShopInfo | null = null;
			// Hoisted for the same reason — the order lookup runs after the
			// catalog try/catch below.
			const orderNumberMatch = message.match(
				/\border\s*#?\s*(\d{3,})\b|(?:^|[^A-Za-z0-9])#(\d{3,})\b/i,
			);
			const orderNumber = orderNumberMatch?.[1] || orderNumberMatch?.[2];
			try {
				// 1. Fetch shop info if available
				shopInfo = storeInfo || (await getShopInfo());
				if (shopInfo) {
					// Real contact details so the assistant can point the customer
					// somewhere useful when a question is outside the data it has.
					const contact = [
						shopInfo.email ? `- Contact Email: ${shopInfo.email}` : "",
						shopInfo.phone
							? `- Contact Phone / WhatsApp: ${shopInfo.phone}`
							: "",
					]
						.filter(Boolean)
						.join("\n");

					contextInfo += `\n\nSTORE INFORMATION:
- Store Name: ${shopInfo.name}
- Website: https://${shopInfo.domain}
- Currency: ${shopInfo.currency} (${shopInfo.moneyFormat || ""})
${shopInfo.country ? `- Country: ${shopInfo.country}` : ""}${contact ? `\n${contact}` : ""}`;
				}

				// 2. Work out what the customer is actually asking about.
				//    Running a catalog search for "Assalam-o-Alaikum" wasted a
				//    Shopify call and pushed product cards at the customer.
				const intent = classifyIntent(message);

				console.log(
					`[Chat API] Intent: ${intent}${orderNumber ? ` (order #${orderNumber})` : ""}`,
				);

				if (intent === "product") {
					const browseRequest = isBrowseRequest(message);
					const rawTerm = browseRequest ? "" : buildSearchTerm(message);

					console.log(
						`[Chat API] Searching Shopify products with query: "${rawTerm || "(featured/catalog)"}"`,
					);

					let products: ShopifyProduct[] = [];
					let matchedSearch = false;
					// The term actually used for searching — after typo repair.
					let effectiveTerm = rawTerm;

					if (
						clientProducts &&
						Array.isArray(clientProducts) &&
						clientProducts.length > 0
					) {
						products = clientProducts;
						matchedSearch = true;
					} else if (rawTerm) {
						products = await searchProducts(rawTerm, 8);
						matchedSearch = products.length > 0;

						// 1) Typo repair: "pufer jaket" -> "puffer jacket".
						if (!matchedSearch) {
							const repaired = repairSearchTerm(
								rawTerm,
								await getCatalogTokens(),
							);
							if (repaired !== rawTerm) {
								effectiveTerm = repaired;
								products = await searchProducts(repaired, 8);
								matchedSearch = products.length > 0;
								console.log(
									`[Chat API] Repaired search term "${rawTerm}" -> "${repaired}" (matched=${matchedSearch})`,
								);
							}
						}

						// 2) Word-by-word retry: "difference white black jacket"
						//    matches nothing as a phrase, but the words do.
						if (!matchedSearch) {
							const words = effectiveTerm
								.split(/\s+/)
								.filter((w) => w.length > 3);
							for (const word of words.slice(0, 3)) {
								const partial = await searchProducts(word, 8);
								if (partial.length > 0) {
									products = partial;
									matchedSearch = true;
									console.log(
										`[Chat API] No match for "${rawTerm}", matched on "${word}"`,
									);
									break;
								}
							}
						}
					} else {
						// Browse request: the catalog itself is the answer.
						products = await searchProducts("", 8);
						matchedSearch = true;
					}

					// Product cards only make sense when something actually
					// matched (or the customer asked to browse). A delivery
					// question must never push four jackets at the customer.
					productCards = matchedSearch
						? (products || [])
								.filter((p) => p.url)
								.map((p) => ({
									title: p.title,
									price: p.price,
									currency: p.currency || shopInfo?.currency || "PKR",
									url: p.url,
									image: p.image,
								}))
						: [];

					// A size question needs the whole catalog, because the
					// answer (M, L, XL, 2XL) lives in the product variants.
					let isSizingQuestion = false;
					if (!matchedSearch && wantsSizeInfo(message)) {
						const catalog = await searchProducts("", 8);
						if (catalog.length > 0) {
							products = catalog;
							matchedSearch = true;
							isSizingQuestion = true;
							productCards = catalog
								.filter((p) => p.url)
								.map((p) => ({
									title: p.title,
									price: p.price,
									currency: p.currency || shopInfo?.currency || "PKR",
									url: p.url,
									image: p.image,
								}));
							console.log(
								`[Chat API] Size question — injected full catalog with variants`,
							);
						}
					}

					const productLines = (products || [])
						.map((p) => {
							const sizes = (p.variants || [])
								.map((v) => v.title)
								.filter((t) => t && t.toLowerCase() !== "default title")
								.join(", ");
							return `- ${p.title}: ${p.currency || shopInfo?.currency || "PKR"} ${p.price}${p.url ? ` | Product Link: ${p.url}` : ""}${sizes ? ` | Available Sizes: ${sizes}` : ""}${p.description ? ` | Info: ${p.description.substring(0, 100)}` : ""}`;
						})
						.join("\n");

					if (matchedSearch && products && products.length > 0) {
						contextInfo += `\n\nAVAILABLE PRODUCTS (from ${shopInfo?.name || "Shopify Store"}):\n${productLines}\n\nIMPORTANT INSTRUCTIONS:
- Answer the customer's question directly using ONLY the real products from the list above.
- This list is the complete set of products you have. Do not mention any product, price, variant or link that is not in it.
${isSizingQuestion ? '- The customer asked about sizing. Answer with the "Available Sizes" listed for each product. Never invent a size range.\n' : ""}- Mention only the products listed above, using their exact names. NEVER invent a product, a product type, a category, a brand, a price or a link — not even as a passing example.
- Mention prices in ${shopInfo?.currency || "PKR"} (e.g. Rs. ${shopInfo?.moneyFormat || ""}).
- Provide a clickable product URL ONLY if a "Product Link" is listed for that product in the list above. NEVER invent, guess, or construct product URLs yourself, and prefer mentioning products by name/title when they have no listed link.
- ALWAYS reply in clear, natural English — even if the customer writes in Roman Urdu or Urdu. You may understand their input in Roman Urdu, but your answer must be in English.`;

						console.log(
							`[Chat API] Injected ${products.length} products into context`,
						);
					} else {
						// Nothing matched. Show the full catalog as context, but
						// tell the model it is not a match — otherwise it will
						// happily present an unrelated product as the answer
						// (and, worse, invent product types that do not exist).
						contextInfo += `\n\nNO PRODUCT MATCHED the customer's request.
The catalog below is the FULL store catalog, not a search result.
${productLines || "(the catalog could not be read)"}

INSTRUCTIONS:
- If the customer asked for a specific product type that is NOT in the list above, tell them clearly that we do not carry that item.
- Mention only the products listed above, using their exact names. NEVER invent a product, a product type, a category, a brand, a price or a link — not even as a passing example ("we also sell sports bras", "we have shorts in stock").
- Do NOT claim that the store sells anything other than what is listed above.
- ALWAYS reply in clear, natural English.`;

						console.log(
							`[Chat API] No products matched for "${rawTerm}" — model told not to invent any`,
						);
					}
				} else if (intent === "policy" || intent === "discount") {
					// The assistant has no data for store policies, so it should
					// hand the customer the real contact details instead of
					// guessing at delivery times or charges.
					contextInfo += `\n\nCUSTOMER QUESTION OUTSIDE PRODUCT DATA:
The customer asked about store policy (delivery, charges, payment, returns${intent === "discount" ? ", discounts" : ""}).
- Do NOT list, price, or describe any product.
- Answer honestly that you do not have that information, and give the customer the contact email and phone from the STORE INFORMATION block if they are listed.
- ALWAYS reply in clear, natural English.`;
				} else if (intent === "greeting") {
					contextInfo += `\n\nCUSTOMER GREETING:
The customer just greeted you. Reply with a short, friendly greeting in English (for example "Hello! Welcome to ${shopInfo?.name || "our store"}.") and ask what they would like to know about the store's products.
- Do NOT list or describe any product yet.
- Reply in English only. Do not mirror a Roman Urdu or Urdu greeting back.
- ALWAYS reply in clear, natural English.`;
				} else if (intent === "order" && !orderNumber) {
					contextInfo += `\n\nORDER TRACKING REQUEST WITHOUT AN ORDER NUMBER:
- The customer wants to track an order but did not give an order number.
- Ask them for the order number (it looks like #1234) before doing anything else.
- Do NOT list or describe any product.
- ALWAYS reply in clear, natural English.`;
				} else if (intent === "off_topic") {
					contextInfo += `\n\nCUSTOMER QUESTION IS UNRELATED TO THE STORE:
- Politely say that you can only help with the store's products and orders.
- Do NOT list or describe any product.
- ALWAYS reply in clear, natural English.`;
				}
			} catch (error) {
				console.error("[Chat API] Shopify search error:", error);
				// The catalog could not be read. Previously the request continued
				// with no product context, which made the model invent products,
				// prices and URLs. Tell it explicitly that it has no data.
				contextInfo += `\n\nPRODUCT CATALOG UNAVAILABLE:
The live Shopify product catalog could not be loaded (the store API returned an error).
- You have NO product data. Do NOT name, price, describe, or link any product.
- Tell the customer that the product catalog is temporarily unavailable and ask them to try again in a few minutes, or to contact the store directly.
- ALWAYS reply in clear, natural English.`;
			}

			// Order-lookup intent. On Shopify Basic/Starter plans there's no way to
			// verify against a PII field (order.email and order.customer.email are
			// both walled off), so we return unauthenticated order data on this
			// dev store — enumeration risk is accepted for demo purposes. If this
			// ever runs on a real store, upgrade the plan and reintroduce the
			// email gate that used to live here (see git log).
			if (orderNumber) {
				try {
					console.log(`[Chat API] Order lookup: #${orderNumber}`);
					const order = await getOrderByNumber(orderNumber);
					if (order) {
						const items = order.lineItems
							.map((li) => `  - ${li.quantity}x ${li.title} (${li.price})`)
							.join("\n");
						// Use the store's real currency — the order total is not USD.
						const currency = shopInfo?.currency || "PKR";
						contextInfo += `\n\nORDER LOOKUP RESULT:\nOrder #${order.orderNumber}\nStatus: ${order.status}\nPlaced: ${order.createdAt}\nTotal: ${currency} ${order.totalPrice}\nItems:\n${items}\n\nSummarize this for the customer in a friendly, concise way, and reply in English.`;
					} else {
						contextInfo += `\n\nORDER LOOKUP RESULT: no order found with that number. Ask the customer to double-check the number in their order confirmation email.`;
					}
				} catch (error) {
					// Explicit fields — Vercel's log viewer collapses raw Error objects to
					// "[Object]" which hides the code/status/message we actually need.
					const err = error as {
						code?: string;
						status?: number;
						message?: string;
					};
					console.error(
						`[Chat API] Order lookup error: code=${err.code ?? "unknown"} status=${err.status ?? "n/a"} message=${err.message ?? String(error)}`,
					);
					contextInfo += `\n\nORDER LOOKUP RESULT: system error. Ask the customer to try again in a moment or contact support.`;
				}
			}
		}

		// Append product context to system prompt if available
		if (contextInfo) {
			systemPrompt += contextInfo;
		}

		// Get AI response with custom system prompt and product context
		const response = await getAIResponse(
			message,
			conversationHistory || [],
			systemPrompt,
			traceOpts,
		);

		// Analytics: Log conversation metrics
		console.log(
			JSON.stringify({
				event: "chat_message",
				timestamp: new Date().toISOString(),
				strategy: strategy.getType(),
				messageLength: message.length,
				hasHistory: !!conversationHistory && conversationHistory.length > 0,
				historyLength: conversationHistory?.length || 0,
				hasSessionId: !!traceOpts?.sessionId,
				hasUserId: !!traceOpts?.userId,
				responseTime: Date.now(), // Can calculate delta if needed
				hasContext: contextInfo.length > 0,
				success: true,
			}),
		);

		res.json({
			success: true,
			data: {
				...response,
				strategyUsed: strategy.getType(),
				greeting: strategy.getGreeting(),
				products: productCards,
			},
		});
	} catch (error) {
		console.error("Chat API error:", error);

		// Analytics: Log error
		console.log(
			JSON.stringify({
				event: "chat_error",
				timestamp: new Date().toISOString(),
				strategy: req.body.strategyType || "unknown",
				errorType:
					error instanceof Error ? error.constructor.name : "UnknownError",
				errorMessage: error instanceof Error ? error.message : "Unknown error",
				success: false,
			}),
		);

		if (error instanceof Error) {
			if ("code" in error && error.code === "RATE_LIMIT_EXCEEDED") {
				res.status(429).json({
					success: false,
					error: "Rate limit exceeded. Please try again later.",
				});
				return;
			}

			if ("code" in error && error.code === "MISSING_API_KEY") {
				res.status(500).json({
					success: false,
					error: "Server configuration error. API key not set.",
				});
				return;
			}
		}

		res.status(500).json({
			success: false,
			error: "Failed to get AI response",
		});
	}
});

// GET /api/health - Health check
app.get("/api/health", async (_req, res) => {
	const shopify = await checkShopifyHealth();

	res.json({
		status: shopify.reachable ? "ok" : "degraded",
		message: shopify.reachable
			? "AI Chatbot API is running and the Shopify catalog is reachable."
			: "AI Chatbot API is running, but the Shopify catalog is NOT reachable — the assistant cannot read real products and will tell customers so instead of guessing.",
		shopify,
		timestamp: new Date().toISOString(),
	});
});

// GET /api/strategy/:type - Get strategy information
app.get("/api/strategy/:type", (req, res) => {
	try {
		const strategyType = req.params.type as StrategyType;
		const strategy = StrategyFactory.createStrategy(strategyType);

		res.json({
			success: true,
			data: {
				type: strategy.getType(),
				version: strategy.getVersion(),
				enabled: strategy.isEnabled(),
				greeting: strategy.getGreeting(),
				suggestedQuestions: strategy.getSuggestedQuestions(),
				conversationStarters: strategy.getConversationStarters(),
				tone: strategy.getTone(),
			},
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			error: error instanceof Error ? error.message : "Invalid strategy type",
		});
	}
});

// GET /api/strategies - List available strategies
app.get("/api/strategies", (_req, res) => {
	res.json({
		success: true,
		data: {
			available: StrategyFactory.getAvailableStrategies(),
		},
	});
});

// GET /api/rate-limit - Check rate limit status
app.get("/api/rate-limit", (_req, res) => {
	const status = getRateLimitStatus();
	res.json({
		rateLimit: status,
	});
});

// Export for Vercel serverless
export default app;

// For local development and Docker: listen if not in Vercel serverless environment
if (!process.env.VERCEL) {
	const PORT: number = parseInt(process.env.PORT || "4000", 10);
	app.listen(PORT, () => {
		console.log(`AI Chatbot API running on port ${PORT}`);
		console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
		console.log(`OpenAI Model: ${process.env.OPENAI_MODEL || "gpt-4o-mini"}`);
	});
}
