import { observeOpenAI } from "langfuse";
import type OpenAI from "openai";

// Env vars used (all read by the langfuse SDK's internal singleton):
//   LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY  — required, gate the no-op path
//   LANGFUSE_BASEURL                          — e.g. https://us.cloud.langfuse.com
//   LANGFUSE_TRACING_ENVIRONMENT              — e.g. production
function enabled(): boolean {
	return !!(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

export interface TraceOpts {
	generationName: string;
	sessionId?: string;
	userId?: string;
	metadata?: Record<string, unknown>;
}

export function traced<T extends OpenAI>(openai: T, opts: TraceOpts): T {
	if (!enabled()) return openai;
	return observeOpenAI(openai, opts) as unknown as T;
}

// Ships queued events to Langfuse. Serverless runtimes (Vercel, Lambda) freeze
// the process between requests without firing `beforeExit`, so the SDK's
// in-memory queue is discarded unless we flush explicitly per request.
// Safe to call on the raw client too — it's a no-op when observeOpenAI didn't wrap.
export async function flush(client: unknown): Promise<void> {
	const fn = (client as { flushAsync?: () => Promise<unknown> })?.flushAsync;
	if (typeof fn === "function") await fn.call(client).catch(() => {});
}
