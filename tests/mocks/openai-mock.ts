/**
 * Mock OpenAI API Service
 * Provides fake OpenAI API responses for testing
 */

export interface MockOpenAIConfig {
	delayMs?: number;
	shouldFail?: boolean;
	failureError?: string;
	responseText?: string;
}

let config: MockOpenAIConfig = {
	delayMs: 0,
	shouldFail: false,
	responseText: "This is a mock OpenAI response.",
};

export function setMockOpenAIConfig(newConfig: MockOpenAIConfig): void {
	config = { ...config, ...newConfig };
}

export function resetMockOpenAIConfig(): void {
	config = {
		delayMs: 0,
		shouldFail: false,
		responseText: "This is a mock OpenAI response.",
	};
}

/**
 * Mock OpenAI chat completion response
 */
export async function mockOpenAIChatCompletion(
	_messages: Array<{ role: string; content: string }>,
): Promise<Record<string, unknown>> {
	if (config.delayMs) {
		await new Promise((resolve) => setTimeout(resolve, config.delayMs));
	}

	if (config.shouldFail) {
		throw new Error(config.failureError || "OpenAI API Error");
	}

	// Generate unique ID for each request
	const uniqueId: string = `chatcmpl-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;

	return {
		id: uniqueId,
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model: "gpt-4",
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content: config.responseText,
				},
				finish_reason: "stop",
			},
		],
		usage: {
			prompt_tokens: 10,
			completion_tokens: 20,
			total_tokens: 30,
		},
	};
}

/**
 * Generate mock response text based on intent
 */
export function generateMockResponseForIntent(intent: string): string {
	const responses: Record<string, string> = {
		product_inquiry:
			"The blue t-shirt is priced at $29.99 and is available in sizes S to XL.",
		order_status:
			"Your order #1001 was shipped on November 1st and should arrive by November 5th.",
		general_question: "I appreciate your question. Let me help you with that.",
		complaint:
			"I sincerely apologize for the inconvenience. How can I make this right?",
		greeting: "Hello! How can I assist you today?",
		goodbye: "Thank you for chatting with us. Have a great day!",
	};

	return responses[intent] || "How can I help you?";
}

/**
 * Mock rate limit exceeded error
 */
export async function mockOpenAIRateLimitError(): Promise<void> {
	throw new Error("Rate limit exceeded: You have exceeded your API rate limit");
}

/**
 * Mock token calculation (rough estimate)
 */
export function mockCalculateTokens(text: string): number {
	// Roughly 1 token per 4 characters
	return Math.ceil(text.length / 4);
}
