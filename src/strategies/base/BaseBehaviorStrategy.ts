/**
 * BaseBehaviorStrategy Abstract Class
 * Provides common functionality for all strategy implementations
 */

import type {
	KnowledgeBase,
	StrategyType,
} from "../../types/strategy.types.js";
import type { IBehaviorStrategy } from "./IBehaviorStrategy.js";

export abstract class BaseBehaviorStrategy implements IBehaviorStrategy {
	protected enabled: boolean;
	protected version: string;
	protected tone: "professional" | "friendly" | "casual" | "formal";
	protected maxResponseLength: number;

	constructor(
		enabled: boolean = true,
		version: string = "1.0.0",
		tone: "professional" | "friendly" | "casual" | "formal" = "friendly",
		maxResponseLength: number = 150,
	) {
		this.enabled = enabled;
		this.version = version;
		this.tone = tone;
		this.maxResponseLength = maxResponseLength;
	}

	// Abstract methods - must be implemented by subclasses
	abstract getType(): StrategyType;
	abstract getSystemPrompt(): string;
	abstract getGreeting(): string;
	abstract getKnowledgeBase(): KnowledgeBase;

	// Concrete methods - can be overridden by subclasses
	getSuggestedQuestions(): string[] {
		return [];
	}

	getConversationStarters(): string[] {
		return [];
	}

	getMaxResponseLength(): number {
		return this.maxResponseLength;
	}

	getTone(): "professional" | "friendly" | "casual" | "formal" {
		return this.tone;
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getVersion(): string {
		return this.version;
	}

	/**
	 * Helper method to build system prompt with response length constraint
	 */
	protected buildSystemPrompt(basePrompt: string): string {
		return `${basePrompt}\n\nIMPORTANT: Keep responses under ${this.maxResponseLength} words unless the user specifically asks for more details.`;
	}
}
