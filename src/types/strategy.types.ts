/**
 * Strategy Pattern Type Definitions
 * Defines types for customizable chatbot behaviors
 */

export type StrategyType = "portfolio" | "ecommerce" | "support" | "default";

export interface KnowledgeBase {
	owner?: string;
	role?: string;
	company?: string;
	skills?: string[];
	projects?: ProjectInfo[];
	contact?: ContactInfo;
	links?: SocialLinks;
	[key: string]: unknown; // Allow additional properties
}

export interface ProjectInfo {
	name: string;
	description: string;
	technologies: string[];
	link?: string;
}

export interface ContactInfo {
	email?: string;
	phone?: string;
	location?: string;
}

export interface SocialLinks {
	github?: string;
	linkedin?: string;
	twitter?: string;
	website?: string;
}

export interface StrategyConfig {
	type: StrategyType;
	version: string;
	enabled: boolean;
	config: {
		systemPrompt: string;
		greeting: string;
		tone: "professional" | "friendly" | "casual" | "formal";
		maxResponseLength?: number;
		knowledgeBase?: KnowledgeBase;
		suggestedQuestions?: string[];
		conversationStarters?: string[];
	};
}

export interface ChatRequest {
	message: string;
	strategyType?: StrategyType;
	context?: Record<string, unknown>;
}

export interface ChatResponse {
	success: boolean;
	data: {
		message: string;
		strategyUsed?: StrategyType;
	};
	error?: string;
}
