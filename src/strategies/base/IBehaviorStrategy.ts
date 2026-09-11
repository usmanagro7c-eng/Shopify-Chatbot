/**
 * IBehaviorStrategy Interface
 * Defines the contract for all chatbot behavior strategies
 */

import type {
	KnowledgeBase,
	StrategyType,
} from "../../types/strategy.types.js";

export interface IBehaviorStrategy {
	/**
	 * Get the type of strategy
	 */
	getType(): StrategyType;

	/**
	 * Get the system prompt for OpenAI
	 * This defines the chatbot's personality and knowledge
	 */
	getSystemPrompt(): string;

	/**
	 * Get the greeting message shown when chat opens
	 */
	getGreeting(): string;

	/**
	 * Get the knowledge base for this strategy
	 */
	getKnowledgeBase(): KnowledgeBase;

	/**
	 * Get suggested questions to display to users
	 */
	getSuggestedQuestions(): string[];

	/**
	 * Get conversation starters
	 */
	getConversationStarters(): string[];

	/**
	 * Get maximum response length in words
	 */
	getMaxResponseLength(): number;

	/**
	 * Get the tone of the chatbot
	 */
	getTone(): "professional" | "friendly" | "casual" | "formal";

	/**
	 * Validate if the strategy is enabled
	 */
	isEnabled(): boolean;

	/**
	 * Get version of the strategy
	 */
	getVersion(): string;
}
