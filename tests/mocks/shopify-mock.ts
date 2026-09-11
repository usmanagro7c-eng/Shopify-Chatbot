/**
 * Mock Shopify API Service
 * Provides fake Shopify API responses for testing
 */

export interface MockShopifyConfig {
	delayMs?: number;
	shouldFail?: boolean;
	failureError?: string;
}

let config: MockShopifyConfig = { delayMs: 0, shouldFail: false };

export function setMockShopifyConfig(newConfig: MockShopifyConfig): void {
	config = { ...config, ...newConfig };
}

export function resetMockShopifyConfig(): void {
	config = { delayMs: 0, shouldFail: false };
}

/**
 * Mock Shopify product query response
 */
export async function mockShopifyProductQuery(
	productId: string,
): Promise<Record<string, unknown>> {
	if (config.delayMs) {
		await new Promise((resolve) => setTimeout(resolve, config.delayMs));
	}

	if (config.shouldFail) {
		throw new Error(config.failureError || "Shopify API Error");
	}

	return {
		data: {
			product: {
				id: productId,
				title: "Mock Product",
				description: "A mock product for testing",
				priceRange: {
					minVariantPrice: {
						amount: "29.99",
						currencyCode: "USD",
					},
				},
				variants: {
					edges: [
						{
							node: {
								id: "gid://shopify/ProductVariant/123",
								title: "Size: M / Color: Blue",
								priceV2: {
									amount: "29.99",
									currencyCode: "USD",
								},
							},
						},
					],
				},
			},
		},
	};
}

/**
 * Mock Shopify search products response
 */
export async function mockShopifySearchProducts(
	query: string,
): Promise<Record<string, unknown>> {
	if (config.delayMs) {
		await new Promise((resolve) => setTimeout(resolve, config.delayMs));
	}

	if (config.shouldFail) {
		throw new Error(config.failureError || "Shopify API Error");
	}

	return {
		data: {
			search: {
				edges: [
					{
						node: {
							id: "gid://shopify/Product/123",
							title: `Product matching "${query}"`,
							priceRange: {
								minVariantPrice: {
									amount: "39.99",
									currencyCode: "USD",
								},
							},
						},
					},
				],
			},
		},
	};
}

/**
 * Mock Shopify order query response
 */
export async function mockShopifyOrderQuery(
	orderId: string,
): Promise<Record<string, unknown>> {
	if (config.delayMs) {
		await new Promise((resolve) => setTimeout(resolve, config.delayMs));
	}

	if (config.shouldFail) {
		throw new Error(config.failureError || "Shopify API Error");
	}

	return {
		data: {
			order: {
				id: orderId,
				orderNumber: 1001,
				status: "FULFILLED",
				createdAt: new Date().toISOString(),
				totalPrice: {
					amount: "99.99",
					currencyCode: "USD",
				},
				lineItems: {
					edges: [
						{
							node: {
								title: "Mock Product",
								quantity: 2,
								originalTotalSet: {
									shopMoney: {
										amount: "59.98",
										currencyCode: "USD",
									},
								},
							},
						},
					],
				},
			},
		},
	};
}
