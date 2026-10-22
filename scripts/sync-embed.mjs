/**
 * Regenerates public/chat-widget-inline.liquid from the canonical widget
 * sources (public/chat-widget.css + public/chat-widget.js).
 *
 * Why this exists:
 *  - The Shopify embed used to be a hand-maintained copy of the standalone
 *    widget. It silently drifted and, worse, its UTF-8 bytes were corrupted
 *    (emoji turned into mojibake like "dY`" / "dY>?�,?"), which shipped
 *    garbage text to the live store.
 *  - Generating the embed removes the copy/paste step entirely, so encoding
 *    corruption and drift are no longer possible.
 *
 * Usage: bun run sync:embed
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (relativePath) =>
	readFileSync(join(ROOT, relativePath), "utf8");

const css = read("public/chat-widget.css");
const js = read("public/chat-widget.js");

/**
 * Store-specific values for the Shopify theme embed. Everything here is
 * applied on top of the widget's own defaults via AIChatbot.init().
 */
const embed = {
	// Production API. The widget in the Shopify theme MUST point at the
	// deployed backend — using window.location.origin would call the store
	// domain and fail.
	apiUrl: "https://shopify-chatbot-seven.vercel.app",
	title: "Flexifit Outerwear",
	subtitle: "Online • Shopping & Support",
	placeholder: "Ask about products…",
	// The store already has a WhatsApp button in the bottom-right corner,
	// so the chat widget is docked bottom-left to avoid overlapping it.
	position: "bottom-left",
	theme: "light",
	strategyType: "ecommerce",
	enableTeaser: true,
	teaserMessage: "Hello! Need help with products or tracking your order?",
};

const header = [
	"<!-- ================= AI Chatbot Widget (INLINE) ================= -->",
	"<!-- Paste this whole block right before </body> in the PUBLISHED theme's layout/theme.liquid -->",
	"<!--",
	"  AUTO-GENERATED FILE — do not edit by hand.",
	"  Source: public/chat-widget.css + public/chat-widget.js",
	"  Regenerate with: bun run sync:embed",
	"-->",
].join("\n");

const initBlock = [
	"<!-- Initialize Chatbot on your Shopify Store -->",
	"<script>",
	"  (function() {",
	"    function initAIChatbot() {",
	"      if (window.AIChatbot) {",
	"        AIChatbot.init({",
	"          apiUrl: " + JSON.stringify(embed.apiUrl) + ",",
	"          title: " + JSON.stringify(embed.title) + ",",
	"          subtitle: " + JSON.stringify(embed.subtitle) + ",",
	"          placeholder: " + JSON.stringify(embed.placeholder) + ",",
	"          position: " + JSON.stringify(embed.position) + ",",
	"          theme: " + JSON.stringify(embed.theme) + ",",
	"          strategyType: " + JSON.stringify(embed.strategyType) + ",",
	"          enableTeaser: " + JSON.stringify(embed.enableTeaser) + ",",
	"          teaserMessage: " + JSON.stringify(embed.teaserMessage),
	"        });",
	"      }",
	"    }",
	"",
	"    if (document.readyState === 'loading') {",
	"      document.addEventListener('DOMContentLoaded', initAIChatbot);",
	"    } else {",
	"      initAIChatbot();",
	"    }",
	"  })();",
	"</script>",
].join("\n");

// Plain concatenation (not a template literal) so the widget's own template
// literals and `${}` sequences are passed through untouched.
const liquid = [
	header,
	"<style>",
	css.trimEnd(),
	"</style>",
	"",
	"<script>",
	js.trimEnd(),
	"</script>",
	"",
	initBlock,
	"",
].join("\n");

writeFileSync(join(ROOT, "public/chat-widget-inline.liquid"), liquid, "utf8");

console.log(
	"[sync-embed] wrote public/chat-widget-inline.liquid (" +
		liquid.length +
		" chars)",
);
