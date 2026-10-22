import fetch from "node-fetch";

// Type definitions
export interface ShopifyProduct {
	id: string;
	title: string;
	description: string;
	handle?: string;
	url?: string;
	price: string;
	currency?: string;
	image?: string;
	variants?: ShopifyVariant[];
}

export interface ShopifyVariant {
	id: string;
	title: string;
	price: string;
	available: boolean;
}

/**
 * Normalise the `variants` payload. The Admin API returns `price` as a
 * string and `availableForSale`; the Storefront API returns `price.amount`
 * and `availableForSale`. Both are flattened into one shape.
 */
function mapVariants(raw: unknown): ShopifyVariant[] {
	const edges = (raw as { edges?: unknown } | undefined)?.edges;
	if (!Array.isArray(edges)) return [];

	return edges.map((edge) => {
		const node =
			(edge as { node?: Record<string, unknown> } | undefined)?.node ?? {};
		const priceValue = node.price;
		const price =
			typeof priceValue === "object" && priceValue !== null
				? String((priceValue as { amount?: string }).amount ?? "")
				: String(priceValue ?? "");

		return {
			id: String(node.id ?? ""),
			title: String(node.title ?? ""),
			price,
			available: Boolean(node.availableForSale ?? node.available ?? true),
		};
	});
}

export interface ShopifyOrder {
	id: string;
	orderNumber: number;
	status: string;
	createdAt: string;
	totalPrice: string;
	lineItems: ShopifyLineItem[];
}

export interface ShopifyLineItem {
	id: string;
	title: string;
	quantity: number;
	price: string;
}

export interface ShopInfo {
	name: string;
	domain: string;
	currency: string;
	moneyFormat: string;
	email?: string;
	phone?: string;
	country?: string;
	/** True when the live lookup failed and generic defaults were returned. */
	isFallback?: boolean;
}

interface ShopifyError extends Error {
	code?: string;
	status?: number;
}

/**
 * Shopify API version used for every Admin/Storefront call.
 *
 * Shopify retires each version after 12 months, and a retired version starts
 * answering 401 — which would silently kill the whole product catalog. The
 * version is therefore configurable via SHOPIFY_API_VERSION.
 */
function getApiVersion(): string {
	return process.env.SHOPIFY_API_VERSION || "2026-07";
}

/**
 * True when a credential is missing or still holds the .env.example
 * placeholder value ("your-storefront-token-here", "xxxx…", …).
 */
function isPlaceholderToken(value: string | undefined): boolean {
	if (!value) return true;
	const trimmed = value.trim();
	if (trimmed.length === 0) return true;
	return /^(your[-_ ]|xxxx|placeholder|changeme|your-?token)/i.test(trimmed);
}

/**
 * True when a usable client id + secret pair is configured (the
 * client-credentials grant used by Dev Dashboard apps).
 */
function clientCredentialsOk(
	clientId: string | undefined,
	clientSecret: string | undefined,
): boolean {
	return !isPlaceholderToken(clientId) && !isPlaceholderToken(clientSecret);
}

/**
 * Build a canonical product URL for the store.
 *
 * `onlineStoreUrl` is only populated when the Online Store channel exposes
 * it, so fall back to <store domain>/products/<handle>. Without this a
 * product can end up with no link at all, which drops it from the widget's
 * product cards.
 */
function buildProductUrl(handle: string | undefined): string | undefined {
	if (!handle) return undefined;
	const { SHOPIFY_DOMAIN } = getShopifyConfig();
	const base = (
		process.env.STORE_FRONT_URL ||
		(SHOPIFY_DOMAIN ? `https://${SHOPIFY_DOMAIN}` : "")
	).replace(/\/$/, "");
	if (!base) return undefined;
	return `${base}/products/${handle}`;
}

/**
 * Get Shopify configuration from environment variables
 * Reads at runtime to ensure dotenv has loaded
 */
function getShopifyConfig() {
	return {
		SHOPIFY_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN || "",
		STOREFRONT_TOKEN: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || "",
		ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_API_TOKEN || "",
		CLIENT_ID: process.env.SHOPIFY_CLIENT_ID || "",
		CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET || "",
	};
}

/**
 * Human-readable report about which Shopify credentials are usable.
 * Surfaced through GET /api/health so a broken token is obvious without
 * reading server logs.
 */
export function getShopifyConfigStatus(): {
	configured: boolean;
	apiVersion: string;
	adminConfigured: boolean;
	storefrontConfigured: boolean;
	issues: string[];
} {
	const {
		SHOPIFY_DOMAIN,
		STOREFRONT_TOKEN,
		ADMIN_TOKEN,
		CLIENT_ID,
		CLIENT_SECRET,
	} = getShopifyConfig();

	const issues: string[] = [];

	if (!SHOPIFY_DOMAIN) {
		issues.push("SHOPIFY_STORE_DOMAIN is not set.");
	}

	const clientCredentials =
		!isPlaceholderToken(CLIENT_ID) && !isPlaceholderToken(CLIENT_SECRET);
	const adminConfigured = clientCredentials || !isPlaceholderToken(ADMIN_TOKEN);
	const storefrontConfigured = !isPlaceholderToken(STOREFRONT_TOKEN);

	if (!clientCredentials && isPlaceholderToken(ADMIN_TOKEN)) {
		issues.push(
			"SHOPIFY_ADMIN_API_TOKEN is missing or still the .env.example placeholder.",
		);
	}
	if (!storefrontConfigured) {
		issues.push(
			"SHOPIFY_STOREFRONT_ACCESS_TOKEN is missing or still the .env.example placeholder.",
		);
	}
	if (
		!clientCredentials &&
		!isPlaceholderToken(ADMIN_TOKEN) &&
		!storefrontConfigured
	) {
		issues.push(
			"Only an Admin API token is configured — the Storefront API is not. If Shopify does not accept the Admin token, the product catalog cannot be read.",
		);
	}

	return {
		configured: adminConfigured || storefrontConfigured,
		apiVersion: getApiVersion(),
		adminConfigured,
		storefrontConfigured,
		issues,
	};
}

// In-memory cache for the client-credentials access token.
// Tokens are valid 24h (86399s); refresh a minute early to avoid edge expiry.
let cachedAdminToken: string | null = null;
let cachedAdminTokenExpiresAt = 0;

let cachedShopInfo: ShopInfo | null = null;
let cachedShopInfoExpiresAt = 0;

/**
 * Get an Admin API access token, preferring the client-credentials grant
 * (SHOPIFY_CLIENT_ID/SECRET) and falling back to a static SHOPIFY_ADMIN_API_TOKEN
 * if that's what's configured (e.g. an older admin-created custom app).
 */
async function getAdminAccessToken(): Promise<string> {
	const { SHOPIFY_DOMAIN, ADMIN_TOKEN, CLIENT_ID, CLIENT_SECRET } =
		getShopifyConfig();

	// Static token path (legacy admin-created custom apps)
	if (!CLIENT_ID || !CLIENT_SECRET) {
		if (!ADMIN_TOKEN) {
			const error: ShopifyError = new Error(
				"Set either SHOPIFY_ADMIN_API_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET",
			);
			error.code = "MISSING_ADMIN_CREDENTIALS";
			throw error;
		}
		return ADMIN_TOKEN;
	}

	// Client-credentials path (Dev Dashboard apps)
	if (cachedAdminToken && Date.now() < cachedAdminTokenExpiresAt - 60_000) {
		return cachedAdminToken;
	}

	if (!SHOPIFY_DOMAIN) {
		const error: ShopifyError = new Error(
			"SHOPIFY_STORE_DOMAIN environment variable is not set",
		);
		error.code = "MISSING_STORE_DOMAIN";
		throw error;
	}

	const response = await fetch(
		`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "client_credentials",
				client_id: CLIENT_ID,
				client_secret: CLIENT_SECRET,
			}),
		},
	);

	if (!response.ok) {
		const error: ShopifyError = new Error(
			`Shopify token request failed: ${response.status} ${response.statusText}`,
		);
		error.status = response.status;
		error.code = "TOKEN_REQUEST_FAILED";
		throw error;
	}

	const { access_token, expires_in } = (await response.json()) as {
		access_token: string;
		expires_in: number;
	};

	cachedAdminToken = access_token;
	cachedAdminTokenExpiresAt = Date.now() + expires_in * 1000;

	return cachedAdminToken;
}

/**
 * Validate Shopify configuration
 */
function validateShopifyConfig(): void {
	const {
		SHOPIFY_DOMAIN,
		STOREFRONT_TOKEN,
		ADMIN_TOKEN,
		CLIENT_ID,
		CLIENT_SECRET,
	} = getShopifyConfig();

	if (!SHOPIFY_DOMAIN) {
		const error: ShopifyError = new Error(
			"SHOPIFY_STORE_DOMAIN environment variable is not set",
		);
		error.code = "MISSING_STORE_DOMAIN";
		throw error;
	}

	const hasAdminAuth = Boolean(
		!isPlaceholderToken(ADMIN_TOKEN) ||
			clientCredentialsOk(CLIENT_ID, CLIENT_SECRET),
	);
	const hasStorefrontAuth = !isPlaceholderToken(STOREFRONT_TOKEN);

	if (!hasAdminAuth && !hasStorefrontAuth) {
		const error: ShopifyError = new Error(
			"Neither SHOPIFY_ADMIN_API_TOKEN nor SHOPIFY_STOREFRONT_ACCESS_TOKEN is configured",
		);
		error.code = "MISSING_AUTH_TOKEN";
		throw error;
	}
}

/**
 * Get store information (name, currency, domain, etc.)
 */
export async function getShopInfo(): Promise<ShopInfo | null> {
	const {
		SHOPIFY_DOMAIN,
		STOREFRONT_TOKEN,
		ADMIN_TOKEN,
		CLIENT_ID,
		CLIENT_SECRET,
	} = getShopifyConfig();

	if (!SHOPIFY_DOMAIN) return null;

	if (cachedShopInfo && Date.now() < cachedShopInfoExpiresAt) {
		return cachedShopInfo;
	}

	const hasAdminAuth = Boolean(
		!isPlaceholderToken(ADMIN_TOKEN) ||
			clientCredentialsOk(CLIENT_ID, CLIENT_SECRET),
	);
	const hasValidStorefrontToken = !isPlaceholderToken(STOREFRONT_TOKEN);

	if (hasAdminAuth) {
		try {
			const adminToken = await getAdminAccessToken();
			const response = await fetch(
				`https://${SHOPIFY_DOMAIN}/admin/api/${getApiVersion()}/shop.json`,
				{
					headers: {
						"Content-Type": "application/json",
						"X-Shopify-Access-Token": adminToken,
					},
				},
			);

			if (response.ok) {
				const data = (await response.json()) as {
					shop: {
						name: string;
						domain?: string;
						myshopify_domain: string;
						currency: string;
						money_format: string;
						email?: string;
						customer_email?: string;
						phone?: string;
						country_name?: string;
					};
				};

				cachedShopInfo = {
					name: data.shop.name,
					// Prefer the primary/custom domain (e.g. myflexifit.com) over
					// the myshopify.com one — that is the URL customers know.
					domain:
						data.shop.domain || data.shop.myshopify_domain || SHOPIFY_DOMAIN,
					currency: data.shop.currency,
					moneyFormat: data.shop.money_format,
					email: data.shop.customer_email || data.shop.email,
					phone: data.shop.phone,
					country: data.shop.country_name,
				};
				cachedShopInfoExpiresAt = Date.now() + 60 * 60 * 1000;
				return cachedShopInfo;
			}
		} catch (err) {
			console.warn("[Shopify] Failed to fetch shop info:", err);
		}
	}

	// Fallback: read the shop name and currency from the Storefront API when
	// the Admin API is unavailable (e.g. a Storefront-only token).
	if (hasValidStorefrontToken) {
		try {
			const data = await makeStorefrontRequest(
				`{ shop { name currency } }`,
				{},
			);
			const shop = (data.data as Record<string, unknown>)?.shop as
				| Record<string, unknown>
				| undefined;
			if (shop) {
				cachedShopInfo = {
					name: (shop.name as string) || "Store",
					domain: SHOPIFY_DOMAIN,
					currency: (shop.currency as string) || "PKR",
					moneyFormat: "Rs.{{amount}}",
				};
				cachedShopInfoExpiresAt = Date.now() + 60 * 60 * 1000;
				return cachedShopInfo;
			}
		} catch (err) {
			console.warn("[Shopify] Storefront shop info failed:", err);
		}
	}

	return {
		name: "Store",
		domain: SHOPIFY_DOMAIN,
		currency: "PKR",
		moneyFormat: "Rs.{{amount}}",
		isFallback: true,
	};
}

/**
 * Live connectivity check for the Shopify integration.
 *
 * The static config check cannot tell a well-formed-but-rejected token
 * (expired / revoked / wrong scope) from a working one, so this actually
 * calls the store API and reports what happened.
 */
export async function checkShopifyHealth(): Promise<{
	configured: boolean;
	apiVersion: string;
	adminConfigured: boolean;
	storefrontConfigured: boolean;
	reachable: boolean;
	issues: string[];
}> {
	const status = getShopifyConfigStatus();
	const issues = [...status.issues];

	if (!status.configured) {
		return { ...status, reachable: false, issues };
	}

	let reachable = false;
	try {
		const info = await getShopInfo();
		reachable = Boolean(info && !info.isFallback);
	} catch (error) {
		issues.push(
			`Shopify connectivity check failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (!reachable) {
		issues.push(
			"Shopify rejected the configured credential (401 Unauthorized). The product catalog cannot be read until a valid token is set in .env.local.",
		);
	}

	return { ...status, reachable, issues };
}

/**
 * Make GraphQL request to Shopify Admin API
 */
async function makeAdminGraphQLRequest(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
	const { SHOPIFY_DOMAIN } = getShopifyConfig();
	const adminToken = await getAdminAccessToken();
	const ADMIN_API_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${getApiVersion()}/graphql.json`;

	const response = await fetch(ADMIN_API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Shopify-Access-Token": adminToken,
		},
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		const error: ShopifyError = new Error(
			`Shopify Admin API error: ${response.statusText}`,
		);
		error.status = response.status;
		throw error;
	}

	const data = (await response.json()) as Record<string, unknown>;

	if ("errors" in data && data.errors) {
		const error: ShopifyError = new Error(
			`Shopify Admin GraphQL error: ${JSON.stringify(data.errors)}`,
		);
		error.code = "GRAPHQL_ERROR";
		throw error;
	}

	return data;
}

/**
 * Make GraphQL request to Shopify Storefront API
 */
async function makeStorefrontRequest(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
	try {
		const { SHOPIFY_DOMAIN, STOREFRONT_TOKEN } = getShopifyConfig();
		const STOREFRONT_API_URL = `https://${SHOPIFY_DOMAIN}/api/${getApiVersion()}/graphql.json`;

		const response = await fetch(STOREFRONT_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
			},
			body: JSON.stringify({ query, variables }),
		});

		if (!response.ok) {
			const error: ShopifyError = new Error(
				`Shopify Storefront API error: ${response.statusText}`,
			);
			error.status = response.status;
			throw error;
		}

		const data = (await response.json()) as Record<string, unknown>;

		if ("errors" in data && data.errors) {
			const error: ShopifyError = new Error(
				`Shopify GraphQL error: ${JSON.stringify(data.errors)}`,
			);
			error.code = "GRAPHQL_ERROR";
			throw error;
		}

		return data as Record<string, unknown>;
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("Unknown error calling Shopify Storefront API");
	}
}

/**
 * Get product information by ID
 */
export async function getProductInfo(
	productId: string,
): Promise<ShopifyProduct> {
	validateShopifyConfig();
	const { ADMIN_TOKEN, CLIENT_ID, CLIENT_SECRET } = getShopifyConfig();
	const hasAdminAuth = Boolean(
		!isPlaceholderToken(ADMIN_TOKEN) ||
			clientCredentialsOk(CLIENT_ID, CLIENT_SECRET),
	);

	const formattedId = productId.startsWith("gid://shopify/Product/")
		? productId
		: `gid://shopify/Product/${productId}`;

	if (hasAdminAuth) {
		const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          description
          handle
          onlineStoreUrl
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
          }
        }
      }
    `;

		try {
			const data = await makeAdminGraphQLRequest(query, { id: formattedId });
			const product = (data.data as Record<string, unknown>)?.product as
				| Record<string, unknown>
				| undefined;

			if (!product) {
				const error: ShopifyError = new Error("Product not found");
				error.code = "PRODUCT_NOT_FOUND";
				error.status = 404;
				throw error;
			}

			const priceRange = product.priceRangeV2 as
				| Record<string, unknown>
				| undefined;
			const minPrice =
				((priceRange?.minVariantPrice as Record<string, unknown>)
					?.amount as string) || "0";
			const currency =
				((priceRange?.minVariantPrice as Record<string, unknown>)
					?.currencyCode as string) || "PKR";
			const handle = product.handle as string | undefined;
			const onlineStoreUrl = product.onlineStoreUrl as string | undefined;

			const productUrl = onlineStoreUrl || buildProductUrl(handle);

			return {
				id: product.id as string,
				title: product.title as string,
				description: (product.description as string) || "",
				handle: handle,
				url: productUrl,
				price: minPrice,
				currency,
				image: (product.featuredImage as Record<string, unknown>)?.url as
					| string
					| undefined,
				variants: [],
			};
		} catch (adminErr) {
			console.warn("[Shopify] Admin getProductInfo failed:", adminErr);
		}
	}

	const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        description
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        featuredImage {
          url
        }
        variants(first: 5) {
          edges {
            node {
              id
              title
              priceV2 {
                amount
                currencyCode
              }
              available
            }
          }
        }
      }
    }
  `;

	try {
		const data = await makeStorefrontRequest(query, {
			id: formattedId,
		});

		const product = (data.data as Record<string, unknown>).product as Record<
			string,
			unknown
		>;

		if (!product) {
			const error: ShopifyError = new Error("Product not found");
			error.code = "PRODUCT_NOT_FOUND";
			error.status = 404;
			throw error;
		}

		const priceRange = product.priceRange as Record<string, unknown>;
		const minPrice = (priceRange.minVariantPrice as Record<string, unknown>)
			.amount;
		const currency =
			((priceRange.minVariantPrice as Record<string, unknown>)
				?.currencyCode as string) || "PKR";
		const handle = product.handle as string;

		return {
			id: product.id as string,
			title: product.title as string,
			description: product.description as string,
			handle: handle,
			url: buildProductUrl(handle),
			price: minPrice as string,
			currency,
			image: (product.featuredImage as Record<string, unknown>)?.url as
				| string
				| undefined,
			variants: [],
		};
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("Failed to fetch product info");
	}
}

/**
 * Search products by query or fetch featured/top products if query is empty
 */
export async function searchProducts(
	query: string = "",
	limit: number = 10,
): Promise<ShopifyProduct[]> {
	validateShopifyConfig();
	const { STOREFRONT_TOKEN, ADMIN_TOKEN, CLIENT_ID, CLIENT_SECRET } =
		getShopifyConfig();
	const hasAdminAuth = Boolean(
		!isPlaceholderToken(ADMIN_TOKEN) ||
			clientCredentialsOk(CLIENT_ID, CLIENT_SECRET),
	);
	const hasValidStorefrontToken = !isPlaceholderToken(STOREFRONT_TOKEN);

	// Try Admin API if available
	if (hasAdminAuth) {
		try {
			return await searchProductsAdmin(query, limit);
		} catch (adminError) {
			console.warn(
				"[Shopify] Admin product search failed, attempting storefront:",
				adminError,
			);
			if (hasValidStorefrontToken) {
				return await searchProductsStorefront(query, limit);
			}
			throw adminError;
		}
	}

	if (hasValidStorefrontToken) {
		return await searchProductsStorefront(query, limit);
	}

	throw new Error(
		"No valid Shopify API credentials available (Admin or Storefront)",
	);
}

/**
 * Search products using Admin API GraphQL
 */
async function searchProductsAdmin(
	query: string = "",
	limit: number = 10,
): Promise<ShopifyProduct[]> {
	const graphqlQuery = `
    query SearchProducts($query: String, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            description
            handle
            onlineStoreUrl
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            featuredImage {
              url
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;

	const trimmedQuery = query?.trim();
	const data = await makeAdminGraphQLRequest(graphqlQuery, {
		query: trimmedQuery && trimmedQuery.length > 0 ? trimmedQuery : null,
		first: limit,
	});

	const searchResults = (data.data as Record<string, unknown>)
		?.products as Record<string, unknown>;
	const edges = (searchResults?.edges || []) as Array<
		Record<string, Record<string, unknown>>
	>;

	return edges.map((edge) => {
		const product = edge.node;
		const priceRange = product.priceRangeV2 as
			| Record<string, unknown>
			| undefined;
		const minVariantPrice = priceRange?.minVariantPrice as
			| Record<string, unknown>
			| undefined;
		const minPrice = (minVariantPrice?.amount as string) || "0";
		const currencyCode = (minVariantPrice?.currencyCode as string) || "PKR";
		const handle = product.handle as string | undefined;
		const onlineStoreUrl = product.onlineStoreUrl as string | undefined;

		const productUrl = onlineStoreUrl || buildProductUrl(handle);

		return {
			id: product.id as string,
			title: product.title as string,
			description: (product.description as string) || "",
			handle: handle,
			url: productUrl,
			price: minPrice,
			currency: currencyCode,
			image: (product.featuredImage as Record<string, unknown>)?.url as
				| string
				| undefined,
			variants: mapVariants(product.variants),
		};
	});
}

/**
 * Search products using Storefront API GraphQL
 */
async function searchProductsStorefront(
	query: string = "",
	limit: number = 10,
): Promise<ShopifyProduct[]> {
	const graphqlQuery = `
    query SearchProducts($query: String!, $first: Int!) {
      search(query: $query, first: $first, types: PRODUCT) {
        edges {
          node {
            ... on Product {
              id
              title
              description
              handle
              onlineStoreUrl
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
              }
              variants(first: 25) {
                edges {
                  node {
                    id
                    title
                    price {
                      amount
                    }
                    availableForSale
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

	const data = await makeStorefrontRequest(graphqlQuery, {
		query: query?.trim() || "*",
		first: limit,
	});

	const searchResults = (data.data as Record<string, unknown>)
		?.search as Record<string, unknown>;
	const edges = (searchResults?.edges || []) as Array<
		Record<string, Record<string, unknown>>
	>;

	return edges.map((edge) => {
		const product = edge.node;
		const priceRange = product.priceRange as
			| Record<string, unknown>
			| undefined;
		const minVariantPrice = priceRange?.minVariantPrice as
			| Record<string, unknown>
			| undefined;
		const minPrice = (minVariantPrice?.amount as string) || "0";
		const currencyCode = (minVariantPrice?.currencyCode as string) || "PKR";
		const handle = product.handle as string | undefined;
		const onlineStoreUrl = product.onlineStoreUrl as string | undefined;

		const productUrl = onlineStoreUrl || buildProductUrl(handle);

		return {
			id: product.id as string,
			title: product.title as string,
			description: (product.description as string) || "",
			handle: handle,
			url: productUrl,
			price: minPrice,
			currency: currencyCode,
			image: (product.featuredImage as Record<string, unknown>)?.url as
				| string
				| undefined,
			variants: mapVariants(product.variants),
		};
	});
}

/**
 * Look up an order by human-facing order number.
 * Uses Admin API's orders search with name:#{orderNumber}
 */
export async function getOrderByNumber(
	orderNumber: string,
): Promise<ShopifyOrder | null> {
	const { SHOPIFY_DOMAIN } = getShopifyConfig();
	const ADMIN_API_URL = `https://${SHOPIFY_DOMAIN}/admin/api/${getApiVersion()}/graphql.json`;
	const adminToken = await getAdminAccessToken();

	const cleanNumber = orderNumber.replace(/^#/, "");
	const query = `
    query FindOrder($q: String!) {
      orders(first: 1, query: $q) {
        edges {
          node {
            id
            name
            displayFulfillmentStatus
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                  quantity
                  originalUnitPriceSet { shopMoney { amount currencyCode } }
                }
              }
            }
          }
        }
      }
    }
  `;

	try {
		const response = await fetch(ADMIN_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Access-Token": adminToken,
			},
			body: JSON.stringify({
				query,
				variables: { q: `name:#${cleanNumber}` },
			}),
		});

		if (!response.ok) {
			const error: ShopifyError = new Error(
				`Shopify Admin API error: ${response.statusText}`,
			);
			error.status = response.status;
			throw error;
		}

		const data = (await response.json()) as Record<string, unknown>;

		if ("errors" in data && data.errors) {
			const error: ShopifyError = new Error(
				`Shopify Admin GraphQL error: ${JSON.stringify(data.errors)}`,
			);
			error.code = "GRAPHQL_ERROR";
			throw error;
		}

		const edges = (
			(data.data as Record<string, unknown>).orders as {
				edges: Array<{ node: Record<string, unknown> }>;
			}
		).edges;

		if (!edges || edges.length === 0) return null;

		const order = edges[0].node;

		const totalPrice = (
			(order.totalPriceSet as Record<string, Record<string, unknown>>)
				.shopMoney as Record<string, unknown>
		).amount;
		const lineItemsData = (order.lineItems as Record<string, unknown>)
			.edges as Array<Record<string, Record<string, unknown>>>;

		const nameStr = (order.name as string) || "";
		const parsedNumber = parseInt(nameStr.replace(/^#/, ""), 10) || 0;

		return {
			id: order.id as string,
			orderNumber: parsedNumber,
			status: order.displayFulfillmentStatus as string,
			createdAt: order.createdAt as string,
			totalPrice: totalPrice as string,
			lineItems: lineItemsData.map((item) => {
				const node = item.node;
				const price = (
					(node.originalUnitPriceSet as Record<string, Record<string, unknown>>)
						.shopMoney as Record<string, unknown>
				).amount;
				return {
					id: node.id as string,
					title: node.title as string,
					quantity: node.quantity as number,
					price: price as string,
				};
			}),
		};
	} catch (error) {
		if (error instanceof Error) {
			throw error;
		}
		throw new Error("Failed to look up order");
	}
}
