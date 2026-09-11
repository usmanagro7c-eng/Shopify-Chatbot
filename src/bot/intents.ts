/**
 * Intent Recognition System
 * Routes messages to appropriate handlers based on intent classification
 */

import { contextManager } from "./context.js";

export enum Intent {
	PRODUCT_INQUIRY = "product_inquiry",
	PRICING_QUESTION = "pricing_question",
	ORDER_STATUS = "order_status",
	GENERAL_QUESTION = "general_question",
	SMALL_TALK = "small_talk",
	UNKNOWN = "unknown",
}

export interface IntentResult {
	intent: Intent;
	confidence: number;
	entities: Record<string, unknown>;
	suggestedHandler: "shopify" | "openai" | "hybrid";
}

/**
 * Intent recognition engine
 * Uses keyword matching and pattern recognition
 */
class IntentRecognizer {
	private readonly productKeywords: string[] = [
		"product",
		"item",
		"shirt",
		"tshirt",
		"t-shirt",
		"available",
		"stock",
		"in stock",
		"out of stock",
		"size",
		"color",
		"model",
		"variant",
		"specifications",
		"specs",
	];

	private readonly pricingKeywords: string[] = [
		"price",
		"cost",
		"how much",
		"expensive",
		"cheap",
		"discount",
		"sale",
		"offer",
		"promotion",
		"promo",
		"deal",
		"payment",
		"purchase",
	];

	private readonly orderKeywords: string[] = [
		"order",
		"status",
		"delivery",
		"shipping",
		"track",
		"tracking",
		"when will",
		"arrive",
		"delivered",
		"package",
		"shipment",
		"received",
		"cancel",
		"refund",
		"return",
	];

	private readonly smallTalkKeywords: string[] = [
		"hello",
		"hi",
		"hey",
		"thanks",
		"thank you",
		"goodbye",
		"bye",
		"see you",
		"how are you",
		"what is your name",
		"who are you",
	];

	/**
	 * Recognize intent from user message
	 */
	public recognize(
		message: string,
		userId?: string,
		sessionId?: string,
	): IntentResult {
		const lowerMessage: string = message.toLowerCase().trim();

		// Check for order status first (most specific)
		if (this.matchesKeywords(lowerMessage, this.orderKeywords)) {
			return {
				intent: Intent.ORDER_STATUS,
				confidence: 0.9,
				entities: this.extractOrderEntities(message),
				suggestedHandler: "shopify",
			};
		}

		// Check for product inquiry
		if (this.matchesKeywords(lowerMessage, this.productKeywords)) {
			return {
				intent: Intent.PRODUCT_INQUIRY,
				confidence: 0.85,
				entities: this.extractProductEntities(message),
				suggestedHandler: "shopify",
			};
		}

		// Check for pricing question
		if (this.matchesKeywords(lowerMessage, this.pricingKeywords)) {
			return {
				intent: Intent.PRICING_QUESTION,
				confidence: 0.8,
				entities: this.extractPricingEntities(message),
				suggestedHandler: "shopify",
			};
		}

		// Check for small talk
		if (this.matchesKeywords(lowerMessage, this.smallTalkKeywords)) {
			return {
				intent: Intent.SMALL_TALK,
				confidence: 0.95,
				entities: {},
				suggestedHandler: "openai",
			};
		}

		// Check if user has context from previous conversation
		if (userId && sessionId) {
			const context = contextManager.getContext(userId, sessionId);
			if (
				context &&
				this.hasShopifyContext(context as unknown as Record<string, unknown>)
			) {
				return {
					intent: Intent.GENERAL_QUESTION,
					confidence: 0.6,
					entities: { context: "previous_shopping_context" },
					suggestedHandler: "hybrid",
				};
			}
		}

		// Default: general question
		return {
			intent: Intent.GENERAL_QUESTION,
			confidence: 0.5,
			entities: {},
			suggestedHandler: "openai",
		};
	}

	/**
	 * Check if message contains keywords
	 */
	private matchesKeywords(message: string, keywords: string[]): boolean {
		return keywords.some((keyword: string) => message.includes(keyword));
	}

	/**
	 * Extract product-related entities from message
	 */
	private extractProductEntities(message: string): Record<string, unknown> {
		const entities: Record<string, unknown> = {};

		// Extract product names/types
		const productMatch: RegExpMatchArray | null = message.match(
			/(?:t-?shirt|shirt|product|item)/gi,
		);
		if (productMatch) {
			entities.productType = productMatch[0].toLowerCase();
		}

		// Extract colors
		const colors: string[] = [
			"red",
			"blue",
			"green",
			"black",
			"white",
			"yellow",
			"purple",
			"pink",
		];
		const colorMatch: string | undefined = colors.find((color: string) =>
			message.toLowerCase().includes(color),
		);
		if (colorMatch) {
			entities.color = colorMatch;
		}

		// Extract sizes
		const sizes: string[] = [
			"XS",
			"S",
			"M",
			"L",
			"XL",
			"XXL",
			"xs",
			"s",
			"m",
			"l",
			"xl",
			"xxl",
		];
		const sizeMatch: string | undefined = sizes.find((size: string) =>
			message.toLowerCase().includes(size.toLowerCase()),
		);
		if (sizeMatch) {
			entities.size = sizeMatch.toUpperCase();
		}

		return entities;
	}

	/**
	 * Extract pricing-related entities from message
	 */
	private extractPricingEntities(message: string): Record<string, unknown> {
		const entities: Record<string, unknown> = {};

		// Check for price range
		const priceMatch: RegExpMatchArray | null =
			message.match(/\$?\d+(?:\.\d{2})?/g);
		if (priceMatch) {
			entities.mentionedPrice = priceMatch[0];
		}

		// Check for discount mention
		if (
			message.toLowerCase().includes("discount") ||
			message.toLowerCase().includes("sale")
		) {
			entities.lookingForDiscount = true;
		}

		return entities;
	}

	/**
	 * Extract order-related entities from message
	 */
	private extractOrderEntities(message: string): Record<string, unknown> {
		const entities: Record<string, unknown> = {};

		// Extract order ID (common formats)
		const orderIdMatch: RegExpMatchArray | null = message.match(/#?\d{4,}/);
		if (orderIdMatch) {
			entities.orderId = orderIdMatch[0].replace(/^#/, "");
		}

		// Check for tracking request
		if (
			message.toLowerCase().includes("track") ||
			message.toLowerCase().includes("status")
		) {
			entities.wantsTracking = true;
		}

		return entities;
	}

	/**
	 * Check if user has shopping context from previous interactions
	 */
	private hasShopifyContext(context: Record<string, unknown>): boolean {
		const hasRecentPurchases: boolean =
			context.recentPurchases !== undefined &&
			Array.isArray(context.recentPurchases) &&
			context.recentPurchases.length > 0;
		const hasLastOrderId: boolean = context.lastOrderId !== undefined;

		return hasRecentPurchases || hasLastOrderId;
	}

	/**
	 * Get intent description for logging
	 */
	public getIntentDescription(intent: Intent): string {
		const descriptions: Record<Intent, string> = {
			[Intent.PRODUCT_INQUIRY]: "User asking about products",
			[Intent.PRICING_QUESTION]: "User asking about pricing or discounts",
			[Intent.ORDER_STATUS]: "User checking order or delivery status",
			[Intent.GENERAL_QUESTION]: "General question not product-related",
			[Intent.SMALL_TALK]: "Casual conversation or greeting",
			[Intent.UNKNOWN]: "Intent could not be determined",
		};

		return descriptions[intent] || "Unknown intent";
	}
}

// Singleton instance
export const intentRecognizer: IntentRecognizer = new IntentRecognizer();

export default intentRecognizer;
