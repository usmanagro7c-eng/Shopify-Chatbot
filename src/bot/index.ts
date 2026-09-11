/**
 * Main Chatbot Processor
 * Orchestrates context management, intent recognition, and response generation
 */

import { getAIResponse } from "../integrations/openai.js";
import { searchProducts } from "../integrations/shopify.js";
import { contextManager } from "./context.js";
import { Intent, type IntentResult, intentRecognizer } from "./intents.js";

export interface BotRequest {
	message: string;
	userId: string;
	sessionId: string;
}

export interface BotResponse {
	response: string;
	intent: Intent;
	confidence: number;
	handler: "shopify" | "openai" | "hybrid";
}

/**
 * Process user message and generate intelligent response
 */
export async function processBotMessage(
	request: BotRequest,
): Promise<BotResponse> {
	const { message, userId, sessionId } = request;

	// Step 1: Add user message to context
	contextManager.addMessage(userId, sessionId, "user", message);

	// Step 2: Recognize intent
	const intentResult: IntentResult = intentRecognizer.recognize(
		message,
		userId,
		sessionId,
	);

	console.log(
		`[Bot] Intent: ${intentRecognizer.getIntentDescription(intentResult.intent)} (confidence: ${intentResult.confidence})`,
	);

	// Step 3: Get conversation history for context
	const history = contextManager.getFormattedHistory(userId, sessionId, 5);
	const userContext = contextManager.getContext(userId, sessionId);

	// Step 4: Route to appropriate handler
	let response: string = "";

	try {
		if (intentResult.suggestedHandler === "shopify") {
			response = await handleShopifyIntent(
				intentResult,
				message,
				userContext as unknown as Record<string, unknown>,
			);
		} else if (intentResult.suggestedHandler === "openai") {
			response = await handleOpenAIIntent(intentResult, message, history);
		} else {
			// Hybrid: Try Shopify first, fallback to OpenAI
			try {
				response = await handleShopifyIntent(
					intentResult,
					message,
					userContext as unknown as Record<string, unknown>,
				);
				if (!response || response.length === 0) {
					response = await handleOpenAIIntent(intentResult, message, history);
				}
			} catch (_error) {
				console.log("[Bot] Shopify handler failed, falling back to OpenAI");
				response = await handleOpenAIIntent(intentResult, message, history);
			}
		}
	} catch (error) {
		console.error("[Bot] Error processing message:", error);
		response =
			"I apologize, but I'm having trouble processing your request. Please try again.";
	}

	// Step 5: Add assistant response to context
	contextManager.addMessage(userId, sessionId, "assistant", response);

	return {
		response,
		intent: intentResult.intent,
		confidence: intentResult.confidence,
		handler: intentResult.suggestedHandler,
	};
}

/**
 * Handle Shopify-related intents
 */
async function handleShopifyIntent(
	intentResult: IntentResult,
	_message: string,
	_userContext: Record<string, unknown>,
): Promise<string> {
	const intent: Intent = intentResult.intent;

	switch (intent) {
		case Intent.PRODUCT_INQUIRY: {
			// Extract product name from message
			const entities = intentResult.entities as Record<string, unknown>;
			const productType: string = (entities.productType as string) || "shirt";

			try {
				const products: unknown = await searchProducts(productType);
				if (products) {
					return `I found some ${productType}s available! ${JSON.stringify(products).substring(0, 200)}...`;
				}
			} catch (error) {
				console.log("[Bot] Product search error:", error);
			}
			return `I can help you find ${productType}s. What specific style or color are you looking for?`;
		}

		case Intent.PRICING_QUESTION: {
			const entities = intentResult.entities as Record<string, unknown>;
			const productType: string = (entities.productType as string) || "shirt";

			try {
				const products: unknown = await searchProducts(productType);
				if (products) {
					return `Our ${productType}s are competitively priced. ${JSON.stringify(products).substring(0, 150)}... Would you like more details?`;
				}
			} catch (error) {
				console.log("[Bot] Pricing lookup error:", error);
			}
			return `I can check pricing for you. What product are you interested in?`;
		}

		// Intent.ORDER_STATUS falls through to default — the Shopify Admin API's
		// getOrderStatus took an internal Order gid (not the customer-facing #1234)
		// and was never wired up correctly here. The real order-lookup path lives
		// in src/api/index.ts via getOrderByNumber. This legacy bot module is
		// kept for phase4 intent-recognizer tests only.
		default:
			return `How can I help you with our products today?`;
	}
}

/**
 * Handle OpenAI-related intents
 */
async function handleOpenAIIntent(
	intentResult: IntentResult,
	message: string,
	history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
	const intent: Intent = intentResult.intent;

	// Build context for OpenAI
	let _systemMessage: string =
		"You are a helpful customer service chatbot for an ecommerce store. ";

	if (intent === Intent.SMALL_TALK) {
		_systemMessage +=
			"Be friendly and engaging. After the greeting, try to understand if they need help with anything.";
	} else if (intent === Intent.GENERAL_QUESTION) {
		_systemMessage +=
			"Answer their question helpfully. If it relates to products or orders, suggest they ask about specific products.";
	} else {
		_systemMessage += "Provide helpful information related to their question.";
	}

	try {
		// Include conversation history for context
		const messagesWithHistory: Array<{
			role: "user" | "assistant";
			content: string;
		}> = history.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}));

		// Call getAIResponse with the user message and history
		const aiResponse = await getAIResponse(message, messagesWithHistory);
		const response: string =
			typeof aiResponse === "string" ? aiResponse : aiResponse.message;
		return response;
	} catch (error) {
		console.error("[Bot] OpenAI error:", error);
		return "I'm having trouble generating a response. Could you please rephrase your question?";
	}
}

/**
 * Simple synchronous wrapper for backward compatibility
 */
export function getBotResponse(message: string): string {
	// Fallback for synchronous usage
	return `Processing: ${message}`;
}
