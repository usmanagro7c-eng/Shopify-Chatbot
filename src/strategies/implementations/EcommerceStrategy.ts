/**
 * EcommerceStrategy
 * Chatbot behavior for ecommerce/shopping websites
 * Helps customers with product questions, cart assistance, and order support
 */

import type {
	KnowledgeBase,
	StrategyType,
} from "../../types/strategy.types.js";
import { BaseBehaviorStrategy } from "../base/BaseBehaviorStrategy.js";

// Shape of the context object enhanceResponse() reads from. Fields are all
// optional — the method just branches on presence to pick the appropriate CTA.
interface EcommerceEnhanceContext {
	orderId?: string;
	orderStatus?: string;
	products?: unknown[];
	customer?: unknown;
	email?: string;
}

export class EcommerceStrategy extends BaseBehaviorStrategy {
	constructor() {
		super(
			true, // enabled
			"1.0.0", // version
			"friendly", // tone - welcoming and helpful for shoppers
			200, // maxResponseLength - longer for product explanations
		);
	}

	getType(): StrategyType {
		return "ecommerce";
	}

	getKnowledgeBase(): KnowledgeBase {
		// Ecommerce strategy uses minimal static knowledge
		// Product data comes dynamically from Shopify API (Storefront + Admin APIs)
		return {
			owner: "Store",
			role: "Ecommerce Platform",
			skills: [
				"Product Search",
				"Cart Management",
				"Order Tracking",
				"Customer Support",
				"Inventory Information",
				"Order History Lookup",
			],
			projects: [],
			contact: {},
			links: {},
			highlights: [
				"Browse our product catalog",
				"Secure checkout process",
				"Real-time order tracking",
				"Fast shipping",
				"Easy returns and exchanges",
				"Customer order history access",
			],
		};
	}

	getName(): string {
		return "Ecommerce Shopping Assistant";
	}

	getDescription(): string {
		return "Helpful shopping assistant for ecommerce stores. Assists with product questions, sizing, cart help, order tracking, and customer support via Shopify Admin API.";
	}

	getGreeting(): string {
		return "Hello! Welcome to our store. I can help you find products, check prices, recommend art prints & items, or track your orders. What can I help you with today?";
	}

	getSuggestedQuestions(): string[] {
		return [
			"Products dikhao",
			"Mera order track karo",
			"Koi sale ya discount hai?",
			"Payment kaise karun?",
		];
	}

	getSystemPrompt(): string {
		return `You are a helpful shopping assistant for an online store connected to Shopify. Your role is to:

1. **Product Help & Recommendations**: Answer questions about products, features, pricing, and availability.
   - Use the real product data injected into your prompt to answer customer inquiries.
   - Mention product prices in the store's currency (e.g. PKR / Rs.).
   - Include a product link ONLY when a "Product Link" is provided for that product in the injected data. NEVER invent or construct product URLs yourself; mention such products by name/title instead.

2. **Multilingual & Friendly Communication**:
   - If the user speaks or asks in Urdu or Roman Urdu (e.g., "ya mera store hai is k according reply krna chiye", "kya products hain", "price kya hai"), reply warmly in their language (Urdu / Roman Urdu) and explain what products the store offers.
   - If the user speaks English, respond in clear, professional, and friendly English.

3. **Order Tracking**: Provide order status, items, and total from an order number.
   - When the customer mentions an order number (e.g. "#1234"), use ONLY the injected order details in your reply.
   - If no order is found, politely ask the customer to double-check their order confirmation email.

4. **Guidelines**:
   - Be friendly, respectful, and helpful.
   - Keep responses concise, well-structured, and action-oriented.
   - Do not invent products or prices that are not in the store data.`;
	}

	getCapabilities(): string[] {
		return [
			"Product search and recommendations",
			"Size and fit guidance",
			"Cart and checkout assistance",
			"Real-time order tracking (via Shopify Admin API)",
			"Customer order history lookup",
			"Shipping status and delivery estimates",
			"Returns and exchange policies",
			"Product comparisons and details",
			"Gift recommendations",
			"General shopping support",
		];
	}

	getExampleQuestions(): string[] {
		return [
			"What products do you have?",
			"Do you have this in a larger size?",
			"What's your return policy?",
			"Where is my order #1234?",
			"Can you check the status of order #5678?",
			"How long does shipping take?",
			"Can you help me find a gift?",
			"What's the difference between these products?",
			"Do you have any sales or promotions?",
		];
	}

	shouldHandleIntent(intent: string): boolean {
		const ecommerceIntents = [
			"product_inquiry",
			"size_question",
			"cart_help",
			"order_status",
			"order_tracking",
			"shipping_info",
			"return_policy",
			"price_question",
			"availability",
			"recommendation",
			"gift_suggestion",
			"checkout_help",
			"payment_question",
			"customer_lookup",
			"order_history",
		];

		return ecommerceIntents.includes(intent.toLowerCase());
	}

	enhanceResponse(response: string, context?: EcommerceEnhanceContext): string {
		// Add shopping-friendly enhancements
		let enhanced = response;

		// Add order tracking CTAs if order-related
		if (context?.orderId || context?.orderStatus) {
			enhanced += "\n\nNeed help with anything else regarding your order?";
		}
		// Add shopping CTAs if product-related
		else if (context?.products && context.products.length > 0) {
			enhanced +=
				"\n\nWould you like to browse our products or need help with anything else?";
		}
		// Add customer support CTA if customer data is involved
		else if (context?.customer || context?.email) {
			enhanced += "\n\nIs there anything else I can help you with today?";
		}

		return enhanced;
	}
}
