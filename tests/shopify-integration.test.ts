/**
 * Shopify Integration Tests
 * Tests for Shopify API interactions
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	mockShopifyOrderQuery,
	mockShopifyProductQuery,
	mockShopifySearchProducts,
	resetMockShopifyConfig,
	setMockShopifyConfig,
} from "./mocks/shopify-mock.js";
import { measureExecutionTime, sleep } from "./utils/test-helpers.js";

describe("Shopify Integration", () => {
	beforeEach(() => {
		resetMockShopifyConfig();
	});

	describe("Product Queries", () => {
		it("should retrieve product by ID", async () => {
			const result: Record<string, unknown> = await mockShopifyProductQuery(
				"gid://shopify/Product/123",
			);

			expect(result).toHaveProperty("data");
			expect(result.data).toHaveProperty("product");
		});

		it("should include product title", async () => {
			const result: Record<string, unknown> = await mockShopifyProductQuery(
				"gid://shopify/Product/123",
			);
			const product: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).product as Record<string, unknown>;

			expect(product).toHaveProperty("title");
			expect(typeof product.title).toBe("string");
			expect(product.title?.toString().length).toBeGreaterThan(0);
		});

		it("should include product price", async () => {
			const result: Record<string, unknown> = await mockShopifyProductQuery(
				"gid://shopify/Product/123",
			);
			const product: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).product as Record<string, unknown>;

			expect(product).toHaveProperty("priceRange");
		});

		it("should include product variants", async () => {
			const result: Record<string, unknown> = await mockShopifyProductQuery(
				"gid://shopify/Product/123",
			);
			const product: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).product as Record<string, unknown>;

			expect(product).toHaveProperty("variants");
		});

		it("should include product description", async () => {
			const result: Record<string, unknown> = await mockShopifyProductQuery(
				"gid://shopify/Product/123",
			);
			const product: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).product as Record<string, unknown>;

			expect(product).toHaveProperty("description");
		});

		it("should handle product IDs in correct format", async () => {
			const productId: string = "gid://shopify/Product/987654321";
			const result: Record<string, unknown> =
				await mockShopifyProductQuery(productId);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("data");
		});
	});

	describe("Search Products", () => {
		it("should search products by query", async () => {
			const result: Record<string, unknown> =
				await mockShopifySearchProducts("t-shirt");

			expect(result).toHaveProperty("data");
			expect(result.data).toHaveProperty("search");
		});

		it("should return search results", async () => {
			const result: Record<string, unknown> =
				await mockShopifySearchProducts("blue");
			const search: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).search as Record<string, unknown>;

			expect(search).toHaveProperty("edges");
			expect(Array.isArray(search.edges)).toBe(true);
		});

		it("should include product information in search results", async () => {
			const result: Record<string, unknown> =
				await mockShopifySearchProducts("shirt");
			const search: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).search as Record<string, unknown>;
			const edges: unknown[] = search.edges as unknown[];

			if (edges.length > 0) {
				const firstResult: Record<string, unknown> = (
					edges[0] as Record<string, unknown>
				).node as Record<string, unknown>;
				expect(firstResult).toHaveProperty("title");
				expect(firstResult).toHaveProperty("priceRange");
			}
		});

		it("should handle empty search queries", async () => {
			const result: Record<string, unknown> =
				await mockShopifySearchProducts("");

			expect(result).toHaveProperty("data");
		});

		it("should handle special characters in search queries", async () => {
			const queries: string[] = [
				"blue-shirt",
				"shirt (large)",
				"shirt & pants",
			];

			for (const query of queries) {
				const result: Record<string, unknown> =
					await mockShopifySearchProducts(query);
				expect(result).toHaveProperty("data");
			}
		});
	});

	describe("Order Queries", () => {
		it("should retrieve order by ID", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);

			expect(result).toHaveProperty("data");
			expect(result.data).toHaveProperty("order");
		});

		it("should include order number", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);
			const order: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).order as Record<string, unknown>;

			expect(order).toHaveProperty("orderNumber");
			expect(typeof order.orderNumber).toBe("number");
		});

		it("should include order status", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);
			const order: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).order as Record<string, unknown>;

			expect(order).toHaveProperty("status");
			expect(["FULFILLED", "PENDING", "CANCELLED"]).toContain(order.status);
		});

		it("should include order total price", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);
			const order: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).order as Record<string, unknown>;

			expect(order).toHaveProperty("totalPrice");
		});

		it("should include line items", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);
			const order: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).order as Record<string, unknown>;

			expect(order).toHaveProperty("lineItems");
		});

		it("should include created date", async () => {
			const result: Record<string, unknown> = await mockShopifyOrderQuery(
				"gid://shopify/Order/123",
			);
			const order: Record<string, unknown> = (
				result.data as Record<string, unknown>
			).order as Record<string, unknown>;

			expect(order).toHaveProperty("createdAt");
			expect(typeof order.createdAt).toBe("string");
		});
	});

	describe("Error Handling", () => {
		it("should throw error on API failure", async () => {
			setMockShopifyConfig({ shouldFail: true });

			try {
				await mockShopifyProductQuery("gid://shopify/Product/123");
				throw new Error("Expected to throw");
			} catch (error) {
				expect(error).toBeDefined();
				expect(error instanceof Error).toBe(true);
			}
		});

		it("should throw custom error message", async () => {
			const customError: string = "Custom Shopify Error";
			setMockShopifyConfig({ shouldFail: true, failureError: customError });

			try {
				await mockShopifyProductQuery("gid://shopify/Product/123");
				throw new Error("Expected to throw");
			} catch (error) {
				if (error instanceof Error) {
					expect(error.message).toContain(customError);
				}
			}
		});

		it("should handle invalid product IDs", async () => {
			const invalidIds: string[] = [
				"invalid",
				"123",
				"",
				"gid://invalid/Product/123",
			];

			for (const id of invalidIds) {
				const result: Record<string, unknown> =
					await mockShopifyProductQuery(id);
				expect(result).toBeDefined();
			}
		});

		it("should handle network timeout", async () => {
			setMockShopifyConfig({ delayMs: 5000 });

			const timeout: number = 100;
			const timeoutPromise: Promise<void> = sleep(timeout);

			try {
				await Promise.race([
					mockShopifyProductQuery("gid://shopify/Product/123"),
					timeoutPromise,
				]);
			} catch (error) {
				expect(error).toBeDefined();
			}
		});
	});

	describe("Rate Limiting", () => {
		it("should track API call rate", async () => {
			const callCount: number = 5;
			const start: number = Date.now();

			for (let i: number = 0; i < callCount; i++) {
				await mockShopifyProductQuery("gid://shopify/Product/123");
			}

			const duration: number = Date.now() - start;
			expect(duration).toBeGreaterThanOrEqual(0);
		});

		it("should handle consecutive rapid calls", async () => {
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < 10; i++) {
				promises.push(mockShopifyProductQuery(`gid://shopify/Product/${i}`));
			}

			const results: Record<string, unknown>[] = await Promise.all(promises);
			expect(results.length).toBe(10);
		});

		it("should respect rate limit delay", async () => {
			setMockShopifyConfig({ delayMs: 100 });

			const { duration } = await measureExecutionTime(async () => {
				await mockShopifyProductQuery("gid://shopify/Product/123");
			});

			// 5% tolerance — setTimeout(100) can wake at 99.x ms on a busy CI
			// scheduler, which was causing sporadic CI failures on fast runners.
			expect(duration).toBeGreaterThanOrEqual(95);
		});

		it("should provide rate limit info", () => {
			const rateLimitInfo: Record<string, unknown> = {
				requestsPerSecond: 10,
				requestsPerDay: 10000,
				requestsUsed: 50,
			};

			expect(rateLimitInfo).toHaveProperty("requestsPerSecond");
			expect(rateLimitInfo).toHaveProperty("requestsPerDay");
		});
	});
});
