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
import { getAIResponse, getRateLimitStatus } from "../integrations/openai.js";
import { getOrderByNumber, getShopInfo, searchProducts } from "../integrations/shopify.js";
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
const allowedOrigins = [
	"http://localhost:3000",
	"http://localhost:3001",
];

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
	res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning");
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
		const { message, conversationHistory, strategyType, sessionId, userId } =
			req.body;

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
		let productCards: { title: string; price: string; currency: string; url?: string; image?: string }[] = [];

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
			try {
				// 1. Fetch shop info if available
				const shopInfo = await getShopInfo();
				if (shopInfo) {
					contextInfo += `\n\nSTORE INFORMATION:
- Store Name: ${shopInfo.name}
- Website: https://${shopInfo.domain}
- Currency: ${shopInfo.currency} (${shopInfo.moneyFormat || ""})
${shopInfo.country ? `- Country: ${shopInfo.country}` : ""}`;
				}

				// 2. Check if message is an order inquiry or product inquiry
				const isOrderInquiry =
					/\border\s*#?\s*(\d{3,})\b|(?:^|[^A-Za-z0-9])#(\d{3,})\b/i.test(
						message,
					);

				if (!isOrderInquiry) {
					const messageText = message.toLowerCase();

					// Detect broad/general catalog questions or store inquiries
					const isGeneralInquiry =
						/what (products|items|art|prints|goods|paintings)|what do you (have|sell|offer)|show (me )?(products|items|catalog|collection|art)|all products|browse|catalog|kya (products|items|cheezain|hai|hain)|store|products\b|items\b|collection|available/i.test(
							messageText,
						) ||
						messageText.includes("ya mera store hai") ||
						messageText.includes("according reply") ||
						messageText.includes("kya hai") ||
						messageText.includes("kya mil") ||
						messageText.includes("list");

					let searchTerm = "";

					if (!isGeneralInquiry) {
						// Clean search term from user message: remove punctuation & common stop words
						const cleaned = message
							.replace(/[^\w\s-]/g, " ")
							.split(/\s+/)
							.filter(
								(w: string) =>
									w.length > 2 &&
									![
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
										"tell",
										"show",
										"give",
										"find",
										"search",
										"look",
										"for",
										"the",
										"and",
										"about",
										"have",
										"any",
										"some",
										"kya",
										"hai",
										"hain",
										"mujhe",
										"apne",
										"aap",
										"mera",
										"meri",
										"store",
										"please",
										"much",
										"cost",
										"price",
										"chiye",
										"chahiye",
										"reply",
										"karo",
										"kro",
										"according",
									].includes(w.toLowerCase()),
							)
							.join(" ");

						searchTerm = cleaned;
					}

					console.log(
						`[Chat API] Searching Shopify products with query: "${searchTerm || "(featured/catalog)"}"`,
					);

					let products = await searchProducts(searchTerm, 8);

					// If specific search yielded 0 results and we had a search term, fallback to featured products
					if ((!products || products.length === 0) && searchTerm) {
						console.log(
							`[Chat API] No exact match for "${searchTerm}", fetching general store products`,
						);
						products = await searchProducts("", 8);
					}

					productCards = (products || [])
						.filter((p) => p.url)
						.map((p) => ({
							title: p.title,
							price: p.price,
							currency: p.currency || shopInfo?.currency || "PKR",
							url: p.url,
							image: p.image,
						}));

					if (products && products.length > 0) {
						contextInfo += `\n\nAVAILABLE PRODUCTS (from ${shopInfo?.name || "Shopify Store"}):\n${products
							.map(
								(p) =>
									`- ${p.title}: ${p.currency || shopInfo?.currency || "PKR"} ${p.price}${p.url ? ` | Product Link: ${p.url}` : ""}${p.description ? ` | Info: ${p.description.substring(0, 100)}` : ""}`,
							)
							.join(
								"\n",
							)}\n\nIMPORTANT INSTRUCTIONS:
- Answer the customer's question directly using ONLY the real products from the list above.
- Mention prices in ${shopInfo?.currency || "PKR"} (e.g. Rs. ${shopInfo?.moneyFormat || ""}).
- Provide a clickable product URL ONLY if a "Product Link" is listed for that product in the list above. NEVER invent, guess, or construct product URLs yourself, and prefer mentioning products by name/title when they have no listed link.
- If the user talks to you in Urdu or Roman Urdu (e.g., "ya mera store hai", "kya products hain"), reply naturally in Urdu or Roman Urdu / English according to their request.`;

						console.log(
							`[Chat API] Injected ${products.length} products into context`,
						);
					}
				}
			} catch (error) {
				console.error("[Chat API] Shopify search error:", error);
				// Continue with AI response even if Shopify fails
			}

			// Order-lookup intent. On Shopify Basic/Starter plans there's no way to
			// verify against a PII field (order.email and order.customer.email are
			// both walled off), so we return unauthenticated order data on this
			// dev store — enumeration risk is accepted for demo purposes. If this
			// ever runs on a real store, upgrade the plan and reintroduce the
			// email gate that used to live here (see git log).
			const orderNumberMatch = message.match(
				/\border\s*#?\s*(\d{3,})\b|(?:^|[^A-Za-z0-9])#(\d{3,})\b/i,
			);
			const orderNumber = orderNumberMatch?.[1] || orderNumberMatch?.[2];
			if (orderNumber) {
				try {
					console.log(`[Chat API] Order lookup: #${orderNumber}`);
					const order = await getOrderByNumber(orderNumber);
					if (order) {
						const items = order.lineItems
							.map((li) => `  - ${li.quantity}x ${li.title} (${li.price})`)
							.join("\n");
						contextInfo += `\n\nORDER LOOKUP RESULT:\nOrder #${order.orderNumber}\nStatus: ${order.status}\nPlaced: ${order.createdAt}\nTotal: $${order.totalPrice}\nItems:\n${items}\n\nSummarize this for the customer in a friendly, concise way.`;
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
app.get("/api/health", (_req, res) => {
	res.json({
		status: "ok",
		message: "AI Chatbot API is running",
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
