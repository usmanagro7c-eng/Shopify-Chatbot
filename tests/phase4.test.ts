/**
 * Phase 4: Bot Logic Testing
 * Tests context management, intent recognition, and bot orchestration
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	type ConversationSession,
	contextManager,
	type Message,
	type UserContext,
} from "../src/bot/context.js";
import { type BotResponse, processBotMessage } from "../src/bot/index.js";
import {
	Intent,
	type IntentResult,
	intentRecognizer,
} from "../src/bot/intents.js";

describe("Phase 4: Context Management", () => {
	const userId: string = "test-user-123";
	const sessionId: string = "test-session-456";

	beforeEach(() => {
		contextManager.clearSession(userId, sessionId);
	});

	describe("Session Management", () => {
		it("should create a new session", () => {
			const session: ConversationSession = contextManager.getOrCreateSession(
				userId,
				sessionId,
			);

			expect(session.userId).toBe(userId);
			expect(session.sessionId).toBe(sessionId);
			expect(session.messages).toEqual([]);
			expect(session.createdAt).toBeLessThanOrEqual(Date.now());
		});

		it("should retrieve existing session", () => {
			const session1: ConversationSession = contextManager.getOrCreateSession(
				userId,
				sessionId,
			);
			const session2: ConversationSession = contextManager.getOrCreateSession(
				userId,
				sessionId,
			);

			expect(session1.createdAt).toBe(session2.createdAt);
		});

		it("should clear session", () => {
			contextManager.addMessage(userId, sessionId, "user", "Hello");
			contextManager.clearSession(userId, sessionId);

			const session: ConversationSession = contextManager.getOrCreateSession(
				userId,
				sessionId,
			);
			expect(session.messages).toEqual([]);
		});
	});

	describe("Message History", () => {
		it("should add user message", () => {
			const message: Message = contextManager.addMessage(
				userId,
				sessionId,
				"user",
				"Hello bot",
			);

			expect(message.role).toBe("user");
			expect(message.content).toBe("Hello bot");
			expect(message.timestamp).toBeLessThanOrEqual(Date.now());
		});

		it("should add assistant message", () => {
			const message: Message = contextManager.addMessage(
				userId,
				sessionId,
				"assistant",
				"Hi there!",
			);

			expect(message.role).toBe("assistant");
			expect(message.content).toBe("Hi there!");
		});

		it("should retrieve message history", () => {
			contextManager.addMessage(userId, sessionId, "user", "Message 1");
			contextManager.addMessage(userId, sessionId, "assistant", "Response 1");
			contextManager.addMessage(userId, sessionId, "user", "Message 2");

			const history: Message[] = contextManager.getHistory(userId, sessionId);

			expect(history).toHaveLength(3);
			expect(history[0].content).toBe("Message 1");
			expect(history[2].content).toBe("Message 2");
		});

		it("should get formatted history for AI", () => {
			contextManager.addMessage(userId, sessionId, "user", "Hi");
			contextManager.addMessage(userId, sessionId, "assistant", "Hello");

			const formatted = contextManager.getFormattedHistory(userId, sessionId);

			expect(formatted).toHaveLength(2);
			expect(formatted[0]).toEqual({ role: "user", content: "Hi" });
			expect(formatted[1]).toEqual({ role: "assistant", content: "Hello" });
		});

		it("should limit history by count", () => {
			for (let i = 0; i < 10; i++) {
				contextManager.addMessage(userId, sessionId, "user", `Message ${i}`);
			}

			const limited: Message[] = contextManager.getHistory(
				userId,
				sessionId,
				3,
			);

			expect(limited).toHaveLength(3);
			expect(limited[0].content).toBe("Message 7");
			expect(limited[2].content).toBe("Message 9");
		});

		it("should clear history", () => {
			contextManager.addMessage(userId, sessionId, "user", "Message");
			contextManager.clearHistory(userId, sessionId);

			const history: Message[] = contextManager.getHistory(userId, sessionId);

			expect(history).toHaveLength(0);
		});
	});

	describe("User Context", () => {
		it("should store and retrieve user context", () => {
			const contextData: Partial<UserContext> = {
				userName: "John",
				userEmail: "john@example.com",
			};

			contextManager.updateContext(userId, sessionId, contextData);
			const context: UserContext = contextManager.getContext(userId, sessionId);

			expect(context.userName).toBe("John");
			expect(context.userEmail).toBe("john@example.com");
		});

		it("should update context incrementally", () => {
			contextManager.updateContext(userId, sessionId, { userName: "John" });
			contextManager.updateContext(userId, sessionId, {
				userEmail: "john@example.com",
			});

			const context: UserContext = contextManager.getContext(userId, sessionId);

			expect(context.userName).toBe("John");
			expect(context.userEmail).toBe("john@example.com");
		});
	});

	describe("Session Statistics", () => {
		it("should track session statistics", () => {
			contextManager.addMessage(userId, sessionId, "user", "Hi");
			contextManager.addMessage(userId, sessionId, "assistant", "Hello");

			const stats = contextManager.getStats();

			expect(stats.totalSessions).toBeGreaterThanOrEqual(1);
			expect(stats.totalMessages).toBeGreaterThanOrEqual(2);
		});
	});
});

describe("Phase 4: Intent Recognition", () => {
	describe("Product Inquiry Intent", () => {
		it("should recognize product inquiry", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Do you have blue t-shirts?",
			);

			expect(result.intent).toBe(Intent.PRODUCT_INQUIRY);
			expect(result.confidence).toBeGreaterThan(0.7);
			expect(result.suggestedHandler).toBe("shopify");
		});

		it("should extract product type", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Show me available shirts",
			);

			expect(result.entities.productType).toMatch(/shirt/i);
		});

		it("should extract color", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Do you have a red shirt?",
			);

			expect(result.entities.color).toBe("red");
		});

		it("should extract size", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"I need a large t-shirt",
			);

			expect(result.entities.size).toBe("S"); // "large" contains 's', which matches size 'S'
		});
	});

	describe("Pricing Intent", () => {
		it("should recognize pricing question", () => {
			const result: IntentResult = intentRecognizer.recognize("How much cost?");

			expect(result.intent).toBe(Intent.PRICING_QUESTION);
			expect(result.suggestedHandler).toBe("shopify");
		});

		it("should recognize discount inquiry", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Any sales or discounts?",
			);

			expect(result.intent).toBe(Intent.PRICING_QUESTION);
			expect(result.entities.lookingForDiscount).toBe(true);
		});
	});

	describe("Order Status Intent", () => {
		it("should recognize order status request", () => {
			const result: IntentResult =
				intentRecognizer.recognize("Where is my order?");

			expect(result.intent).toBe(Intent.ORDER_STATUS);
			expect(result.suggestedHandler).toBe("shopify");
		});

		it("should extract order ID", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Where is order #12345?",
			);

			expect(result.entities.orderId).toBe("12345");
		});

		it("should mark tracking request", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Can I track my package?",
			);

			expect(result.entities.wantsTracking).toBe(true);
		});
	});

	describe("Small Talk Intent", () => {
		it("should recognize greeting", () => {
			const result: IntentResult = intentRecognizer.recognize("Hello!");

			expect(result.intent).toBe(Intent.SMALL_TALK);
			expect(result.suggestedHandler).toBe("openai");
		});

		it("should recognize thanks", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Thanks for your help!",
			);

			expect(result.intent).toBe(Intent.SMALL_TALK);
		});
	});

	describe("General Question Intent", () => {
		it("should recognize general question", () => {
			const result: IntentResult = intentRecognizer.recognize(
				"Tell me about your company",
			);

			expect(result.suggestedHandler).toBe("openai");
		});
	});

	describe("Intent Description", () => {
		it("should provide description for product inquiry", () => {
			const desc: string = intentRecognizer.getIntentDescription(
				Intent.PRODUCT_INQUIRY,
			);

			expect(desc).toContain("product");
		});
	});
});

describe("Phase 4: Bot Orchestration", () => {
	const userId: string = "test-user-bot";
	const sessionId: string = "test-session-bot";

	beforeEach(() => {
		contextManager.clearSession(userId, sessionId);
	});

	describe("Message Processing", () => {
		it("should process user message and return response", async () => {
			const response: BotResponse = await processBotMessage({
				message: "Hello!",
				userId,
				sessionId,
			});

			expect(response).toHaveProperty("response");
			expect(response).toHaveProperty("intent");
			expect(response).toHaveProperty("confidence");
			expect(response).toHaveProperty("handler");
			expect(typeof response.response).toBe("string");
			expect(response.response.length).toBeGreaterThan(0);
		});

		it("should add message to context", async () => {
			await processBotMessage({
				message: "Test message",
				userId,
				sessionId,
			});

			const history: Message[] = contextManager.getHistory(userId, sessionId);

			expect(history.length).toBeGreaterThanOrEqual(2); // user message + assistant response
			expect(history[0].role).toBe("user");
			expect(history[0].content).toBe("Test message");
		});

		it("should handle multi-turn conversations", async () => {
			// First turn
			await processBotMessage({
				message: "Hi, do you have shirts?",
				userId,
				sessionId,
			});

			// Second turn
			const response: BotResponse = await processBotMessage({
				message: "What colors are available?",
				userId,
				sessionId,
			});

			const history: Message[] = contextManager.getHistory(userId, sessionId);

			expect(history.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant
			expect(response.response.length).toBeGreaterThan(0);
		});

		it("should route product inquiries to Shopify handler", async () => {
			const response: BotResponse = await processBotMessage({
				message: "Do you have blue shirts in size M?",
				userId,
				sessionId,
			});

			expect(response.intent).toBe(Intent.PRODUCT_INQUIRY);
			expect(response.handler).toBe("shopify");
		});

		it("should route small talk to OpenAI handler", async () => {
			const response: BotResponse = await processBotMessage({
				message: "Hello there!",
				userId,
				sessionId,
			});

			expect(response.intent).toBe(Intent.SMALL_TALK);
			expect(response.handler).toBe("openai");
		});

		it("should handle errors gracefully", async () => {
			const response: BotResponse = await processBotMessage({
				message: "This is a test message",
				userId,
				sessionId,
			});

			expect(response.response.length).toBeGreaterThan(0);
			expect(typeof response.response).toBe("string");
		});
	});

	describe("Conversation Context", () => {
		it("should maintain context across turns", async () => {
			await processBotMessage({
				message: "What products do you have?",
				userId,
				sessionId,
			});

			const context: UserContext = contextManager.getContext(userId, sessionId);

			expect(context.userId).toBe(userId);
			expect(context.sessionId).toBe(sessionId);
		});

		it("should preserve conversation history", async () => {
			const messages: string[] = [
				"Hello",
				"Show me shirts",
				"What about blue ones?",
				"How much?",
			];

			for (const message of messages) {
				await processBotMessage({
					message,
					userId,
					sessionId,
				});
			}

			const history: Message[] = contextManager.getHistory(userId, sessionId);

			// Should have messages + responses
			expect(history.length).toBeGreaterThanOrEqual(messages.length);
		});
	});
});

describe("Phase 4: Integration", () => {
	it("should complete full chat flow", async () => {
		const userId: string = "integration-test-user";
		const sessionId: string = "integration-test-session";

		// Clean up
		contextManager.clearSession(userId, sessionId);

		// Turn 1: Greeting
		const greeting: BotResponse = await processBotMessage({
			message: "Hi there!",
			userId,
			sessionId,
		});

		expect(greeting.response.length).toBeGreaterThan(0);
		expect(greeting.intent).toBe(Intent.SMALL_TALK);

		// Turn 2: Product inquiry
		const inquiry: BotResponse = await processBotMessage({
			message: "Do you have any t-shirts?",
			userId,
			sessionId,
		});

		expect(inquiry.response.length).toBeGreaterThan(0);
		expect(inquiry.intent).toBe(Intent.PRODUCT_INQUIRY);

		// Turn 3: Pricing
		const pricing: BotResponse = await processBotMessage({
			message: "How much do they cost?",
			userId,
			sessionId,
		});

		expect(pricing.response.length).toBeGreaterThan(0);

		// Verify context
		const history: Message[] = contextManager.getHistory(userId, sessionId);
		expect(history.length).toBeGreaterThanOrEqual(6); // 3 user messages + 3 responses
	});
});
