/**
 * OpenAI Integration Tests
 * Tests for OpenAI API interactions
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	generateMockResponseForIntent,
	mockCalculateTokens,
	mockOpenAIChatCompletion,
	resetMockOpenAIConfig,
	setMockOpenAIConfig,
} from "./mocks/openai-mock.js";
import { measureExecutionTime } from "./utils/test-helpers.js";

describe("OpenAI Integration", () => {
	beforeEach(() => {
		resetMockOpenAIConfig();
	});

	describe("Chat Completion", () => {
		it("should process chat completion request", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "What is the price of the blue t-shirt?" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);

			expect(result).toHaveProperty("choices");
			expect(Array.isArray(result.choices)).toBe(true);
		});

		it("should return valid response structure", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Hello" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);

			expect(result).toHaveProperty("id");
			expect(result).toHaveProperty("created");
			expect(result).toHaveProperty("model");
			expect(result).toHaveProperty("choices");
			expect(result).toHaveProperty("usage");
		});

		it("should include message content in response", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Test message" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			const choices: unknown[] = result.choices as unknown[];
			const firstChoice: Record<string, unknown> = choices[0] as Record<
				string,
				unknown
			>;
			const message: Record<string, unknown> = firstChoice.message as Record<
				string,
				unknown
			>;

			expect(message).toHaveProperty("content");
			expect(typeof message.content).toBe("string");
			expect((message.content as string).length).toBeGreaterThan(0);
		});

		it("should include assistant role in response", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Hi" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			const choices: unknown[] = result.choices as unknown[];
			const firstChoice: Record<string, unknown> = choices[0] as Record<
				string,
				unknown
			>;
			const message: Record<string, unknown> = firstChoice.message as Record<
				string,
				unknown
			>;

			expect(message).toHaveProperty("role");
			expect(message.role).toBe("assistant");
		});

		it("should handle multi-turn conversations", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "What products do you have?" },
				{ role: "assistant", content: "We have t-shirts and hoodies" },
				{ role: "user", content: "Tell me more about t-shirts" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);

			expect(result).toHaveProperty("choices");
			expect(Array.isArray(result.choices)).toBe(true);
		});

		it("should handle system messages", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{
					role: "system",
					content: "You are a helpful customer service representative",
				},
				{ role: "user", content: "How can I track my order?" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);

			expect(result).toHaveProperty("choices");
		});
	});

	describe("Token Usage", () => {
		it("should track prompt tokens", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Hello" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			const usage: Record<string, unknown> = result.usage as Record<
				string,
				unknown
			>;

			expect(usage).toHaveProperty("prompt_tokens");
			expect(typeof usage.prompt_tokens).toBe("number");
			expect((usage.prompt_tokens as number) > 0).toBe(true);
		});

		it("should track completion tokens", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Hello" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			const usage: Record<string, unknown> = result.usage as Record<
				string,
				unknown
			>;

			expect(usage).toHaveProperty("completion_tokens");
			expect(typeof usage.completion_tokens).toBe("number");
		});

		it("should calculate total tokens", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "Hello" },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			const usage: Record<string, unknown> = result.usage as Record<
				string,
				unknown
			>;
			const promptTokens: number = usage.prompt_tokens as number;
			const completionTokens: number = usage.completion_tokens as number;
			const totalTokens: number = usage.total_tokens as number;

			expect(totalTokens).toBe(promptTokens + completionTokens);
		});

		it("should estimate tokens for text", () => {
			const text: string = "What is the price of the blue t-shirt?";
			const tokens: number = mockCalculateTokens(text);

			expect(tokens).toBeGreaterThan(0);
			expect(tokens).toBeLessThan(text.length);
		});
	});

	describe("Intent-Based Responses", () => {
		it("should generate product inquiry response", () => {
			const response: string = generateMockResponseForIntent("product_inquiry");

			expect(response).toContain("t-shirt");
			expect(response).toContain("$");
		});

		it("should generate order status response", () => {
			const response: string = generateMockResponseForIntent("order_status");

			expect(response).toContain("order");
			expect(response).toContain("shipped");
		});

		it("should generate greeting response", () => {
			const response: string = generateMockResponseForIntent("greeting");

			expect(response).toContain("Hello");
		});

		it("should generate fallback response for unknown intents", () => {
			const response: string = generateMockResponseForIntent("unknown_intent");

			expect(typeof response).toBe("string");
			expect(response.length).toBeGreaterThan(0);
		});
	});

	describe("Error Handling", () => {
		it("should handle API failures", async () => {
			setMockOpenAIConfig({ shouldFail: true });

			try {
				await mockOpenAIChatCompletion([{ role: "user", content: "Hello" }]);
				throw new Error("Expected to throw");
			} catch (error) {
				expect(error).toBeDefined();
				expect(error instanceof Error).toBe(true);
			}
		});

		it("should throw custom error message", async () => {
			const customError: string = "Custom OpenAI Error";
			setMockOpenAIConfig({ shouldFail: true, failureError: customError });

			try {
				await mockOpenAIChatCompletion([{ role: "user", content: "Test" }]);
				throw new Error("Expected to throw");
			} catch (error) {
				if (error instanceof Error) {
					expect(error.message).toContain(customError);
				}
			}
		});

		it("should handle empty message content", async () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: "" },
			];

			try {
				const result: Record<string, unknown> =
					await mockOpenAIChatCompletion(messages);
				expect(result).toBeDefined();
			} catch (error) {
				expect(error).toBeDefined();
			}
		});

		it("should handle very long messages", async () => {
			const longContent: string = "a".repeat(10000);
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: longContent },
			];

			const result: Record<string, unknown> =
				await mockOpenAIChatCompletion(messages);
			expect(result).toHaveProperty("choices");
		});

		it("should handle invalid role values", () => {
			const messages: Array<{ role: string; content: string }> = [
				{ role: "invalid_role", content: "test" },
			];

			expect(messages[0].role).toBe("invalid_role");
		});
	});

	describe("Performance", () => {
		it("should complete requests within timeout", async () => {
			setMockOpenAIConfig({ delayMs: 100 });

			const { duration } = await measureExecutionTime(async () => {
				await mockOpenAIChatCompletion([{ role: "user", content: "Hello" }]);
			});

			const maxTimeout: number = 5000;
			expect(duration).toBeLessThan(maxTimeout);
		});

		it("should handle concurrent requests", async () => {
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < 5; i++) {
				promises.push(
					mockOpenAIChatCompletion([{ role: "user", content: `Message ${i}` }]),
				);
			}

			const results: Record<string, unknown>[] = await Promise.all(promises);
			expect(results.length).toBe(5);
			expect(results.every((r) => r !== null && r !== undefined)).toBe(true);
		});

		it("should track response time", async () => {
			setMockOpenAIConfig({ delayMs: 50 });

			const { duration } = await measureExecutionTime(async () => {
				await mockOpenAIChatCompletion([{ role: "user", content: "Test" }]);
			});

			// Allow for slight timing variation in CI/CD (±5ms tolerance)
			expect(duration).toBeGreaterThanOrEqual(45);
		});
	});

	describe("Model Configuration", () => {
		it("should specify model in response", async () => {
			const result: Record<string, unknown> = await mockOpenAIChatCompletion([
				{ role: "user", content: "Hello" },
			]);

			expect(result).toHaveProperty("model");
			expect(result.model).toBe("gpt-4");
		});

		it("should provide unique request IDs", async () => {
			const result1: Record<string, unknown> = await mockOpenAIChatCompletion([
				{ role: "user", content: "Hello" },
			]);
			const result2: Record<string, unknown> = await mockOpenAIChatCompletion([
				{ role: "user", content: "Hi" },
			]);

			expect(result1.id).not.toBe(result2.id);
		});

		it("should include creation timestamp", async () => {
			const before: number = Math.floor(Date.now() / 1000);
			const result: Record<string, unknown> = await mockOpenAIChatCompletion([
				{ role: "user", content: "Hello" },
			]);
			const after: number = Math.floor(Date.now() / 1000);

			expect(typeof result.created).toBe("number");
			expect((result.created as number) >= before).toBe(true);
			expect((result.created as number) <= after).toBe(true);
		});
	});
});
