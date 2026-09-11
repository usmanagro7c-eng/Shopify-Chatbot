/**
 * Conversation Context Management
 * Handles conversation history, session management, and user context enrichment
 */

export interface Message {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface UserContext {
	userId: string;
	sessionId: string;
	userName?: string;
	userEmail?: string;
	recentPurchases?: string[];
	preferences?: Record<string, unknown>;
	lastInteractionTime?: number;
}

export interface ConversationSession {
	sessionId: string;
	userId: string;
	messages: Message[];
	createdAt: number;
	updatedAt: number;
	context: UserContext;
	metadata?: Record<string, unknown>;
}

/**
 * In-memory conversation context store
 * In production, replace with Redis or database
 */
class ContextManager {
	private sessions: Map<string, ConversationSession> = new Map();
	private readonly MAX_HISTORY: number = 20;
	private readonly SESSION_TIMEOUT: number = 30 * 60 * 1000; // 30 minutes

	/**
	 * Create or get a conversation session
	 */
	public getOrCreateSession(
		userId: string,
		sessionId: string,
	): ConversationSession {
		const key: string = `${userId}:${sessionId}`;

		if (this.sessions.has(key)) {
			const session: ConversationSession | undefined = this.sessions.get(key);
			if (session) {
				// Check if session is still valid
				if (Date.now() - session.updatedAt > this.SESSION_TIMEOUT) {
					this.sessions.delete(key);
					return this.createNewSession(userId, sessionId);
				}
				session.updatedAt = Date.now();
				return session;
			}
		}

		return this.createNewSession(userId, sessionId);
	}

	/**
	 * Create a new conversation session
	 */
	private createNewSession(
		userId: string,
		sessionId: string,
	): ConversationSession {
		const session: ConversationSession = {
			sessionId,
			userId,
			messages: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
			context: {
				userId,
				sessionId,
			},
		};

		const key: string = `${userId}:${sessionId}`;
		this.sessions.set(key, session);
		return session;
	}

	/**
	 * Add a message to conversation history
	 */
	public addMessage(
		userId: string,
		sessionId: string,
		role: "user" | "assistant",
		content: string,
		metadata?: Record<string, unknown>,
	): Message {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);

		const message: Message = {
			role,
			content,
			timestamp: Date.now(),
			metadata,
		};

		session.messages.push(message);

		// Keep only recent messages to manage memory
		if (session.messages.length > this.MAX_HISTORY) {
			session.messages = session.messages.slice(-this.MAX_HISTORY);
		}

		session.updatedAt = Date.now();
		return message;
	}

	/**
	 * Get conversation history
	 */
	public getHistory(
		userId: string,
		sessionId: string,
		limit?: number,
	): Message[] {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);
		const messages: Message[] = session.messages;

		if (limit && limit > 0) {
			return messages.slice(-limit);
		}

		return messages;
	}

	/**
	 * Get formatted history for AI context
	 * Returns messages in format suitable for OpenAI API
	 */
	public getFormattedHistory(
		userId: string,
		sessionId: string,
		limit?: number,
	): Array<{ role: "user" | "assistant"; content: string }> {
		const messages: Message[] = this.getHistory(userId, sessionId, limit);
		return messages.map((msg: Message) => ({
			role: msg.role,
			content: msg.content,
		}));
	}

	/**
	 * Update user context information
	 */
	public updateContext(
		userId: string,
		sessionId: string,
		contextData: Partial<UserContext>,
	): void {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);
		session.context = {
			...session.context,
			...contextData,
		};
		session.updatedAt = Date.now();
	}

	/**
	 * Get user context
	 */
	public getContext(userId: string, sessionId: string): UserContext {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);
		return session.context;
	}

	/**
	 * Get full session data
	 */
	public getSession(userId: string, sessionId: string): ConversationSession {
		return this.getOrCreateSession(userId, sessionId);
	}

	/**
	 * Clear conversation history
	 */
	public clearHistory(userId: string, sessionId: string): void {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);
		session.messages = [];
		session.updatedAt = Date.now();
	}

	/**
	 * Clear entire session
	 */
	public clearSession(userId: string, sessionId: string): void {
		const key: string = `${userId}:${sessionId}`;
		this.sessions.delete(key);
	}

	/**
	 * Get conversation summary for context
	 * Extracts key information from conversation history
	 */
	public getSummary(userId: string, sessionId: string): string {
		const messages: Message[] = this.getHistory(userId, sessionId, 10);

		if (messages.length === 0) {
			return "No previous conversation history.";
		}

		const userMessages: Message[] = messages.filter(
			(msg: Message) => msg.role === "user",
		);
		const assistantMessages: Message[] = messages.filter(
			(msg: Message) => msg.role === "assistant",
		);

		const summary: string = `Conversation Summary:
- Total messages: ${messages.length}
- User messages: ${userMessages.length}
- Assistant responses: ${assistantMessages.length}
- Last message: ${messages[messages.length - 1].content.substring(0, 100)}...`;

		return summary;
	}

	/**
	 * Check if session has context
	 */
	public hasContext(userId: string, sessionId: string): boolean {
		const session: ConversationSession = this.getOrCreateSession(
			userId,
			sessionId,
		);
		return session.messages.length > 0;
	}

	/**
	 * Cleanup expired sessions
	 * Call periodically to clean up old sessions
	 */
	public cleanupExpiredSessions(): number {
		let cleanedCount: number = 0;
		const now: number = Date.now();

		for (const [key, session] of this.sessions.entries()) {
			if (now - session.updatedAt > this.SESSION_TIMEOUT) {
				this.sessions.delete(key);
				cleanedCount++;
			}
		}

		return cleanedCount;
	}

	/**
	 * Get session statistics
	 */
	public getStats(): {
		totalSessions: number;
		totalMessages: number;
		averageMessagesPerSession: number;
	} {
		let totalMessages: number = 0;

		for (const session of this.sessions.values()) {
			totalMessages += session.messages.length;
		}

		return {
			totalSessions: this.sessions.size,
			totalMessages,
			averageMessagesPerSession:
				this.sessions.size > 0 ? totalMessages / this.sessions.size : 0,
		};
	}
}

// Singleton instance
export const contextManager: ContextManager = new ContextManager();

// Periodic cleanup (every 5 minutes)
setInterval(
	() => {
		const cleaned: number = contextManager.cleanupExpiredSessions();
		if (cleaned > 0) {
			console.log(`[Context] Cleaned up ${cleaned} expired sessions`);
		}
	},
	5 * 60 * 1000,
);

export default contextManager;
