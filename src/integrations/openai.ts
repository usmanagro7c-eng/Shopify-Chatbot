import { OpenAI } from "openai";
import { flush, traced } from "./langfuse.js";

// Initialize OpenAI client (lazy initialization)
let openai: OpenAI | null = null;

interface AIError extends Error {
	code?: string;
	status?: number;
}

function getOpenAIClient(): OpenAI {
	if (!openai) {
		const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
		if (!apiKey) {
			const error = new Error(
				"OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is not set",
			) as AIError;
			error.code = "MISSING_API_KEY";
			error.status = 500;
			throw error;
		}
		const usingOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
		openai = new OpenAI({
			apiKey,
			baseURL: usingOpenRouter ? "https://openrouter.ai/api/v1" : undefined,
			defaultHeaders: usingOpenRouter
				? {
						"HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
						"X-Title": "AI Chatbot",
					}
				: undefined,
		});
	}
	return openai;
}

/**
 * Resolve which chat model to use.
 * OPENROUTER_MODEL takes priority when using OpenRouter, then OPENAI_MODEL,
 * then a sane default.
 */
function getChatModel(): string {
	return (
		process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini"
	);
}

// Type definitions
interface ChatMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

interface AIResponse {
	message: string;
	model: string;
	tokensUsed: number;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
const RATE_LIMIT_MAX_REQUESTS = 30; // Max requests per window
let requestTimestamps: number[] = [];

/**
 * Check if request is within rate limit
 */
function isWithinRateLimit(): boolean {
	const now = Date.now();
	// Remove timestamps outside the current window
	requestTimestamps = requestTimestamps.filter(
		(timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
	);

	if (requestTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}

	requestTimestamps.push(now);
	return true;
}

/**
 * Some provider accounts have a small credit balance, and the API rejects a
 * request that asks for more max_tokens than the balance can afford
 * ("... you requested up to 1000 tokens, but can only afford 812").
 * Returns the affordable amount, or null when the error is something else.
 */
function extractAffordableTokens(error: unknown): number | null {
	const message = error instanceof Error ? error.message : "";
	const match = /can only afford (\d+)/i.exec(message);
	if (!match) return null;

	const affordable = Number(match[1]);
	return Number.isFinite(affordable) && affordable > 0 ? affordable : null;
}

/**
 * Minimum max_tokens we are willing to fall back to. Below this a reply
 * would be truncated mid-sentence, so it is better to fail than to send a
 * half answer.
 */
const MIN_MAX_TOKENS = 120;

export interface RequestTraceOpts {
	sessionId?: string;
	userId?: string;
}

/**
 * Get AI response from OpenAI
 * @param message - User message
 * @param conversationHistory - Previous messages for context
 * @param systemPrompt - Custom system prompt (optional, uses default if not provided)
 * @param traceOpts - Optional session/user IDs threaded into Langfuse trace metadata
 * @returns AI response with metadata
 */
export async function getAIResponse(
	message: string,
	conversationHistory: ChatMessage[] = [],
	systemPrompt?: string,
	traceOpts?: RequestTraceOpts,
): Promise<AIResponse> {
	// Check rate limit
	if (!isWithinRateLimit()) {
		const error: AIError = new Error("Rate limit exceeded");
		error.code = "RATE_LIMIT_EXCEEDED";
		error.status = 429;
		throw error;
	}

	// Validate input
	if (!message || message.trim().length === 0) {
		const error: AIError = new Error("Message cannot be empty");
		error.code = "INVALID_INPUT";
		error.status = 400;
		throw error;
	}

	if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
		const error: AIError = new Error(
			"OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is not set",
		);
		error.code = "MISSING_API_KEY";
		error.status = 500;
		throw error;
	}

	try {
		// Build messages array with conversation history
		const defaultSystemPrompt: string = `You are a helpful ecommerce customer support chatbot. You help customers with product questions, orders, and general support. Be concise, friendly, and helpful.`;

		const messages: ChatMessage[] = [
			{
				role: "system",
				content: systemPrompt || defaultSystemPrompt,
			},
			...conversationHistory,
			{
				role: "user",
				content: message,
			},
		];

		// Call OpenAI API
		const client = traced(getOpenAIClient(), {
			generationName: "chat.completion",
			sessionId: traceOpts?.sessionId,
			userId: traceOpts?.userId,
			metadata: {
				historyLength: conversationHistory.length,
				streaming: false,
			},
		});
		const model: string = getChatModel();
		let maxTokens: number = parseInt(
			process.env.OPENAI_MAX_TOKENS || "1000",
			10,
		);
		const request = (tokenLimit: number) =>
			client.chat.completions.create({
				model,
				messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
				max_tokens: tokenLimit,
				temperature: 0.7,
			});

		let response: OpenAI.Chat.Completions.ChatCompletion;
		try {
			response = await request(maxTokens);
		} catch (error) {
			// The account balance cannot cover max_tokens — retry with what the
			// provider says it can afford instead of failing the customer.
			const affordable = extractAffordableTokens(error);
			if (affordable && affordable < maxTokens) {
				const reduced = Math.max(MIN_MAX_TOKENS, affordable - 40);
				console.warn(
					`[OpenAI] Credit limit reached — retrying with max_tokens ${maxTokens} -> ${reduced}`,
				);
				maxTokens = reduced;
				response = await request(maxTokens);
			} else {
				throw error;
			}
		}

		// Extract response
		const responseText: string =
			response.choices[0]?.message?.content || "Unable to generate response";

		// Calculate tokens used (estimate: ~1 token per 4 characters)
		const tokensUsed: number = Math.ceil(
			(message.length + responseText.length) / 4,
		);

		await flush(client);

		return {
			message: responseText,
			model,
			tokensUsed,
		};
	} catch (error) {
		// Handle OpenAI errors
		if (error instanceof OpenAI.APIError) {
			const aiError: AIError = new Error(error.message);
			aiError.code = (error.code || "UNKNOWN_ERROR") as string;
			aiError.status = error.status;
			throw aiError;
		}

		// Handle unexpected errors
		if (error instanceof Error) {
			throw error;
		}

		throw new Error("Unknown error occurred while calling OpenAI API");
	}
}

/**
 * Get AI response with streaming
 * @param message - User message
 * @param conversationHistory - Previous messages for context
 * @returns Async generator for streaming response
 */
export async function* getAIResponseStream(
	message: string,
	conversationHistory: ChatMessage[] = [],
	traceOpts?: RequestTraceOpts,
): AsyncGenerator<string, void, unknown> {
	// Check rate limit
	if (!isWithinRateLimit()) {
		const error: AIError = new Error("Rate limit exceeded");
		error.code = "RATE_LIMIT_EXCEEDED";
		error.status = 429;
		throw error;
	}

	// Validate input
	if (!message || message.trim().length === 0) {
		const error: AIError = new Error("Message cannot be empty");
		error.code = "INVALID_INPUT";
		error.status = 400;
		throw error;
	}

	if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
		const error: AIError = new Error(
			"OPENROUTER_API_KEY or OPENAI_API_KEY environment variable is not set",
		);
		error.code = "MISSING_API_KEY";
		error.status = 500;
		throw error;
	}

	try {
		// Build messages array
		const messages: ChatMessage[] = [
			{
				role: "system",
				content: `You are a helpful ecommerce customer support chatbot. Be concise, friendly, and helpful.`,
			},
			...conversationHistory,
			{
				role: "user",
				content: message,
			},
		];

		// Call OpenAI API with streaming
		const client = traced(getOpenAIClient(), {
			generationName: "chat.completion.stream",
			sessionId: traceOpts?.sessionId,
			userId: traceOpts?.userId,
			metadata: {
				historyLength: conversationHistory.length,
				streaming: true,
			},
		});
		const model: string = getChatModel();
		const stream = await client.chat.completions.create({
			model,
			messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
			max_tokens: 500,
			temperature: 0.7,
			stream: true,
		});

		// Yield chunks as they arrive
		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content;
			if (content) {
				yield content;
			}
		}

		await flush(client);
	} catch (error) {
		// Handle errors
		if (error instanceof OpenAI.APIError) {
			const aiError: AIError = new Error(error.message);
			aiError.code = (error.code || "UNKNOWN_ERROR") as string;
			aiError.status = error.status;
			throw aiError;
		}

		if (error instanceof Error) {
			throw error;
		}

		throw new Error("Unknown error occurred while calling OpenAI API");
	}
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(): {
	remaining: number;
	limit: number;
	resetIn: number;
} {
	const now = Date.now();
	const validTimestamps = requestTimestamps.filter(
		(timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
	);

	const oldestTimestamp = validTimestamps[0];
	const resetIn = oldestTimestamp
		? Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW - now) / 1000)
		: 0;

	return {
		remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - validTimestamps.length),
		limit: RATE_LIMIT_MAX_REQUESTS,
		resetIn,
	};
}
