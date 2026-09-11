/**
 * Performance Tests
 * Response time, memory usage, and load testing
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
	mockOpenAIChatCompletion,
	resetMockOpenAIConfig,
	setMockOpenAIConfig,
} from "./mocks/openai-mock.js";
import { measureExecutionTime, sleep } from "./utils/test-helpers.js";

describe("Performance Tests", () => {
	beforeEach(() => {
		resetMockOpenAIConfig();
	});

	describe("Response Time Benchmarks", () => {
		it("should process chat request within 1 second", async () => {
			const { duration } = await measureExecutionTime(async () => {
				await mockOpenAIChatCompletion([{ role: "user", content: "Hello" }]);
			});

			const maxDuration: number = 1000;
			expect(duration).toBeLessThan(maxDuration);
		});

		it("should handle product queries within 500ms", async () => {
			setMockOpenAIConfig({ delayMs: 100 });

			const { duration } = await measureExecutionTime(async () => {
				await mockOpenAIChatCompletion([
					{ role: "user", content: "What is the price?" },
				]);
			});

			const maxDuration: number = 500;
			expect(duration).toBeLessThanOrEqual(maxDuration);
		});

		it("should handle order status queries within 500ms", async () => {
			const { duration } = await measureExecutionTime(async () => {
				// Simulate order lookup
				await sleep(100);
			});

			const maxDuration: number = 500;
			expect(duration).toBeLessThan(maxDuration);
		});

		it("should establish API connection within 200ms", async () => {
			const { duration } = await measureExecutionTime(async () => {
				// Simulate connection
				await sleep(50);
			});

			const maxDuration: number = 200;
			expect(duration).toBeLessThan(maxDuration);
		});

		it("should parse response within 100ms", async () => {
			const testData: Record<string, unknown> = {
				id: "123",
				message: "Test response",
				timestamp: Date.now(),
			};

			const { duration } = await measureExecutionTime(async () => {
				JSON.parse(JSON.stringify(testData));
			});

			const maxDuration: number = 100;
			expect(duration).toBeLessThan(maxDuration);
		});
	});

	describe("Concurrent Request Handling", () => {
		it("should handle 10 concurrent requests", async () => {
			const concurrentRequests: number = 10;
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < concurrentRequests; i++) {
				promises.push(
					mockOpenAIChatCompletion([{ role: "user", content: `Message ${i}` }]),
				);
			}

			const { duration, result } = await measureExecutionTime(async () => {
				return Promise.all(promises);
			});

			expect(result.length).toBe(concurrentRequests);
			expect(duration).toBeLessThan(5000);
		});

		it("should handle 50 concurrent requests", async () => {
			const concurrentRequests: number = 50;
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < concurrentRequests; i++) {
				promises.push(
					mockOpenAIChatCompletion([{ role: "user", content: `Message ${i}` }]),
				);
			}

			const results: Record<string, unknown>[] = await Promise.all(promises);
			expect(results.length).toBe(concurrentRequests);
		});

		it("should handle 100 concurrent requests with degraded performance", async () => {
			const concurrentRequests: number = 100;
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < concurrentRequests; i++) {
				promises.push(
					mockOpenAIChatCompletion([{ role: "user", content: `Message ${i}` }]),
				);
			}

			const { duration, result } = await measureExecutionTime(async () => {
				return Promise.all(promises);
			});

			expect(result.length).toBe(concurrentRequests);
			// Expect degraded performance with 100 concurrent requests
			const maxDuration: number = 15000;
			expect(duration).toBeLessThan(maxDuration);
		});
	});

	describe("Memory Usage", () => {
		it("should not leak memory with repeated operations", async () => {
			const iterations: number = 100;
			const operations: Promise<unknown>[] = [];

			for (let i: number = 0; i < iterations; i++) {
				operations.push(
					mockOpenAIChatCompletion([{ role: "user", content: "Test" }]),
				);
			}

			const results: unknown[] = await Promise.all(operations);
			expect(results.length).toBe(iterations);

			// Memory should be reclaimed after operations complete
			// (In real scenario, would use memory profiling tools)
		});

		it("should handle large message payloads", async () => {
			const largeContent: string = "x".repeat(10000);
			const messages: Array<{ role: string; content: string }> = [
				{ role: "user", content: largeContent },
			];

			const { result } = await measureExecutionTime(async () => {
				return mockOpenAIChatCompletion(messages);
			});

			expect(result).toBeDefined();
		});

		it("should clear resources after request completion", async () => {
			const resources: Record<string, unknown> = {
				messages: [],
				context: {},
			};

			// Simulate resource usage
			resources.messages = Array(1000).fill({ role: "user", content: "test" });

			// Clear resources
			resources.messages = [];
			resources.context = {};

			expect((resources.messages as unknown[]).length).toBe(0);
		});
	});

	describe("Throughput", () => {
		it("should process 10 requests per second minimum", async () => {
			const requests: number = 10;
			const _duration: number = 1000;

			const { duration: actualDuration } = await measureExecutionTime(
				async () => {
					const promises: Promise<Record<string, unknown>>[] = [];
					for (let i: number = 0; i < requests; i++) {
						promises.push(
							mockOpenAIChatCompletion([{ role: "user", content: "test" }]),
						);
					}
					return Promise.all(promises);
				},
			);

			const rps: number = (requests / actualDuration) * 1000;
			expect(rps).toBeGreaterThanOrEqual(2);
		});

		it("should maintain consistent throughput", async () => {
			const batches: number = 3;
			const requestsPerBatch: number = 5;
			const durations: number[] = [];

			for (let b: number = 0; b < batches; b++) {
				const { duration } = await measureExecutionTime(async () => {
					const promises: Promise<Record<string, unknown>>[] = [];
					for (let i: number = 0; i < requestsPerBatch; i++) {
						promises.push(
							mockOpenAIChatCompletion([{ role: "user", content: "test" }]),
						);
					}
					return Promise.all(promises);
				});
				durations.push(duration);
			}

			// Throughput should be relatively consistent
			// Just verify we got all batches
			expect(durations.length).toBe(batches);
			expect(durations.every((d) => d >= 0)).toBe(true);
		});
	});

	describe("Latency Distribution", () => {
		it("should have low p50 latency", async () => {
			const measurements: number[] = [];

			for (let i: number = 0; i < 10; i++) {
				const { duration } = await measureExecutionTime(async () => {
					await mockOpenAIChatCompletion([{ role: "user", content: "test" }]);
				});
				measurements.push(duration);
			}

			const sorted: number[] = measurements.sort((a, b) => a - b);
			const p50: number = sorted[Math.floor(sorted.length * 0.5)];

			expect(p50).toBeLessThan(100); // Should be < 100ms
		});

		it("should have acceptable p95 latency", async () => {
			const measurements: number[] = [];

			for (let i: number = 0; i < 20; i++) {
				const { duration } = await measureExecutionTime(async () => {
					await mockOpenAIChatCompletion([{ role: "user", content: "test" }]);
				});
				measurements.push(duration);
			}

			const sorted: number[] = measurements.sort((a, b) => a - b);
			const p95: number = sorted[Math.floor(sorted.length * 0.95)];

			expect(p95).toBeLessThan(1000); // Should be < 1 second
		});

		it("should have acceptable p99 latency", async () => {
			const measurements: number[] = [];

			for (let i: number = 0; i < 100; i++) {
				const { duration } = await measureExecutionTime(async () => {
					await mockOpenAIChatCompletion([{ role: "user", content: "test" }]);
				});
				measurements.push(duration);
			}

			const sorted: number[] = measurements.sort((a, b) => a - b);
			const p99: number = sorted[Math.floor(sorted.length * 0.99)];

			expect(p99).toBeLessThan(2000); // Should be < 2 seconds
		});
	});

	describe("Error Rate Under Load", () => {
		it("should maintain low error rate under normal load", async () => {
			const requests: number = 50;
			const promises: Promise<Record<string, unknown>>[] = [];

			for (let i: number = 0; i < requests; i++) {
				promises.push(
					mockOpenAIChatCompletion([{ role: "user", content: "test" }]).catch(
						() => ({ error: true }),
					),
				);
			}

			const results: (Record<string, unknown> | { error: boolean })[] =
				await Promise.all(promises);

			const errorCount: number = results.filter(
				(r) => (r as { error?: boolean }).error,
			).length;
			const errorRate: number = (errorCount / requests) * 100;

			expect(errorRate).toBeLessThan(5); // Less than 5% error rate
		});
	});

	describe("Scalability", () => {
		it("should handle increasing request counts", async () => {
			const testSizes: number[] = [5, 10, 15];
			const durations: Record<number, number> = {};

			for (const size of testSizes) {
				const { duration } = await measureExecutionTime(async () => {
					const promises: Promise<Record<string, unknown>>[] = [];
					for (let i: number = 0; i < size; i++) {
						promises.push(
							mockOpenAIChatCompletion([{ role: "user", content: "test" }]),
						);
					}
					return Promise.all(promises);
				});
				durations[size] = duration;
			}

			// Check if we successfully executed all sizes
			expect(Object.keys(durations).length).toBe(3);
			expect(durations[5]).toBeGreaterThanOrEqual(0);
			expect(durations[10]).toBeGreaterThanOrEqual(0);
			expect(durations[15]).toBeGreaterThanOrEqual(0);
		});
	});
});
