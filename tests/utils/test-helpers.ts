/**
 * Test Utilities and Helpers
 * Common functions for all test suites
 */

/**
 * Create a mock user context for testing
 */
export function createMockUserContext(overrides: Record<string, unknown> = {}) {
	return {
		userId: "test-user-123",
		sessionId: "test-session-456",
		userName: "Test User",
		userHistory: [],
		...overrides,
	};
}

/**
 * Create a mock message for testing
 */
export function createMockMessage(
	role: "user" | "assistant",
	content: string,
	timestamp?: number,
) {
	return {
		role,
		content,
		timestamp: timestamp || Date.now(),
	};
}

/**
 * Create mock product data
 */
export function createMockProduct(overrides: Record<string, unknown> = {}) {
	return {
		id: "gid://shopify/Product/123456789",
		title: "Test Product - Blue T-Shirt",
		description: "A high-quality test product",
		priceRange: {
			minVariantPrice: {
				amount: "29.99",
				currencyCode: "USD",
			},
		},
		handle: "test-product-blue-tshirt",
		...overrides,
	};
}

/**
 * Create mock order data
 */
export function createMockOrder(overrides: Record<string, unknown> = {}) {
	return {
		id: "gid://shopify/Order/123456789",
		orderNumber: 1001,
		status: "FULFILLED",
		createdAt: new Date().toISOString(),
		totalPrice: {
			amount: "99.99",
			currencyCode: "USD",
		},
		...overrides,
	};
}

/**
 * Sleep for a specified milliseconds (useful for async tests)
 */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Measure function execution time
 */
export async function measureExecutionTime<T>(
	fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> {
	const start: number = Date.now();
	const result: T = await fn();
	const duration: number = Date.now() - start;
	return { result, duration };
}

/**
 * Assert that a promise rejects with a specific error message
 */
export async function expectToReject(
	promise: Promise<unknown>,
	expectedMessage?: string,
): Promise<Error> {
	try {
		await promise;
		throw new Error("Expected promise to reject but it resolved");
	} catch (error) {
		if (error instanceof Error) {
			if (expectedMessage && !error.message.includes(expectedMessage)) {
				throw new Error(
					`Expected error message to contain "${expectedMessage}" but got "${error.message}"`,
				);
			}
			return error;
		}
		throw error;
	}
}

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, status: number = 200) {
	return {
		status,
		headers: {
			"content-type": "application/json",
		},
		json: async () => data,
		text: async () => JSON.stringify(data),
		ok: status >= 200 && status < 300,
	};
}

/**
 * Generate random test data
 */
export const testData = {
	randomUserId: (): string => `user-${Math.random().toString(36).substr(2, 9)}`,
	randomSessionId: (): string =>
		`session-${Math.random().toString(36).substr(2, 9)}`,
	randomEmail: (): string =>
		`test-${Math.random().toString(36).substr(2, 9)}@example.com`,
	randomProductId: (): string =>
		`gid://shopify/Product/${Math.floor(Math.random() * 1000000000)}`,
};
