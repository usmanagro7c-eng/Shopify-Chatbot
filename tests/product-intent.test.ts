import { describe, expect, it } from "vitest";
import {
	buildSearchTerm,
	classifyIntent,
	extractCatalogTokens,
	isBrowseRequest,
	repairSearchTerm,
	wantsSizeInfo,
} from "../src/bot/product-intent.js";

describe("Product intent classification", () => {
	describe("classifyIntent", () => {
		it("detects product questions", () => {
			expect(classifyIntent("What products do you have?")).toBe("product");
			expect(classifyIntent("Show me puffer jackets")).toBe("product");
			expect(classifyIntent("Black puffer jacket ki price batao")).toBe(
				"product",
			);
			expect(classifyIntent("kya products hain?")).toBe("product");
			expect(classifyIntent("jacket 😊 price?")).toBe("product");
			expect(classifyIntent("I want to buy a winter jacket")).toBe("product");
		});

		it("detects order questions", () => {
			expect(classifyIntent("Mera order #1001 track karo")).toBe("order");
			expect(classifyIntent("My order status please")).toBe("order");
			expect(classifyIntent("mera order track karo")).toBe("order");
			expect(classifyIntent("order #12345 kahan hai")).toBe("order");
		});

		it("detects policy questions", () => {
			expect(classifyIntent("Delivery kitne din mein hoti hai?")).toBe(
				"policy",
			);
			expect(classifyIntent("Shipping charges kitne hain?")).toBe("policy");
			expect(classifyIntent("COD available hai?")).toBe("policy");
			expect(classifyIntent("Return policy kya hai?")).toBe("policy");
			expect(classifyIntent("Payment methods kya hain?")).toBe("policy");
			expect(classifyIntent("I want to return my jacket")).toBe("policy");
		});

		it("detects greetings and small talk", () => {
			expect(classifyIntent("hi")).toBe("greeting");
			expect(classifyIntent("hello")).toBe("greeting");
			expect(classifyIntent("Assalam-o-Alaikum")).toBe("greeting");
			expect(classifyIntent("Hello, who are you?")).toBe("greeting");
			expect(classifyIntent("thanks")).toBe("greeting");
		});

		it("detects off-topic questions", () => {
			expect(classifyIntent("What is the weather today?")).toBe("off_topic");
			expect(classifyIntent("tell me a joke")).toBe("off_topic");
		});

		it("detects discount requests", () => {
			expect(classifyIntent("Can you give me a discount?")).toBe("discount");
		});

		it("does not treat a policy question as a browse request", () => {
			// "payment methods kya hain" contains "kya … hain" but is not a
			// request to browse the catalog.
			expect(classifyIntent("Payment methods kya hain?")).toBe("policy");
			expect(classifyIntent("Delivery kitne din mein hoti hai?")).toBe(
				"policy",
			);
		});

		it("falls back to product for unknown product-ish questions", () => {
			expect(classifyIntent("Do you sell laptops?")).toBe("product");
			expect(classifyIntent("silk shawl")).toBe("product");
		});
	});

	describe("buildSearchTerm", () => {
		it("strips question words and Roman Urdu filler", () => {
			expect(buildSearchTerm("Black puffer jacket ki price batao")).toBe(
				"Black puffer jacket",
			);
			expect(buildSearchTerm("kya products hain?")).toBe("products");
			expect(buildSearchTerm("Show me puffer jackets")).toBe("puffer jackets");
		});

		it("returns an empty term when nothing meaningful is left", () => {
			expect(buildSearchTerm("kya hai?")).toBe("");
			expect(buildSearchTerm("hi")).toBe("");
		});
	});

	describe("isBrowseRequest", () => {
		it("recognises browse requests", () => {
			expect(isBrowseRequest("What products do you have?")).toBe(true);
			expect(isBrowseRequest("kya products hain?")).toBe(true);
			expect(isBrowseRequest("Show me puffer jackets")).toBe(true);
		});

		it("does not treat specific lookups as browse requests", () => {
			expect(isBrowseRequest("Black puffer jacket ki price")).toBe(false);
		});
	});

	describe("wantsSizeInfo", () => {
		it("detects sizing questions", () => {
			expect(wantsSizeInfo("Sizing guide batao M se 2XL tak")).toBe(true);
			expect(wantsSizeInfo("do you have size XL?")).toBe(true);
			expect(wantsSizeInfo("what is the fit?")).toBe(true);
		});

		it("ignores non-sizing questions", () => {
			expect(wantsSizeInfo("what products do you have?")).toBe(false);
		});
	});

	describe("repairSearchTerm", () => {
		const tokens = extractCatalogTokens([
			{ title: "Men's Two-Tone Puffer Jacket in White | Flexi Fit" },
			{ title: "Men's Two-Tone Puffer Jacket in Black | Flexi Fit" },
		]);

		it("extracts catalog tokens from titles", () => {
			expect(tokens).toContain("puffer");
			expect(tokens).toContain("jacket");
			expect(tokens).toContain("white");
		});

		it("repairs common misspellings", () => {
			expect(repairSearchTerm("pufer jaket", tokens)).toBe("puffer jacket");
			expect(repairSearchTerm("jaket", tokens)).toBe("jacket");
			expect(repairSearchTerm("pufer", tokens)).toBe("puffer");
		});

		it("leaves correct words untouched", () => {
			expect(repairSearchTerm("puffer jacket", tokens)).toBe("puffer jacket");
		});

		it("returns the term unchanged when there is nothing to repair", () => {
			expect(repairSearchTerm("silk", tokens)).toBe("silk");
			expect(repairSearchTerm("puffer jacket", [])).toBe("puffer jacket");
		});
	});
});
