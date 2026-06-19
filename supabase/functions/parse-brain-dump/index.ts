import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Models supporting structured_outputs (JSON schema mode)
// First model is the default. All must exist on OpenRouter.
const FALLBACK_MODELS = [
  "google/gemma-2-27b-it",
  "meta-llama/llama-3.1-8b-instruct",
  "mistralai/mistral-nemo",
];
const HALLUCINATION_WINDOW_DAYS = 365;
const MAX_RETRIES = 3;

const LOG_PREFIX = "[parse-brain-dump]";

interface ParsedEventPayload {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
}

interface ParseResponse {
  events: ParsedEventPayload[];
  warnings?: string[];
  error?: string;
  reset_session?: boolean;
}

const JSON_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "calendar_extraction",
    strict: true,
    schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              start_time: { type: "string" },
              end_time: { type: "string" },
              is_all_day: { type: "boolean" },
            },
            required: [
              "title",
              "description",
              "start_time",
              "end_time",
              "is_all_day",
            ],
          },
        },
      },
      required: ["events"],
    },
  },
};

function isValidISO(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
  } catch {
    return false;
  }
}

function isWithinWindow(
  dateStr: string,
  referenceDate: string,
  windowDays: number,
): boolean {
  try {
    const ref = new Date(referenceDate).getTime();
    const date = new Date(dateStr).getTime();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    return date >= ref - windowMs && date <= ref + windowMs;
  } catch {
    return false;
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

Deno.serve(async (req: Request) => {
  const startTime = performance.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const body = await req.json();
    const { text, user_timezone, current_reference_date, model_config_id, api_key } =
      body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(
        JSON.stringify({ events: [], error: "No text provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const tz = user_timezone || "UTC";
    const rawDateStr = current_reference_date || new Date().toISOString();
    const refDate = new Date(rawDateStr.split(' (')[0]).toISOString();
    const refDateDisplay = rawDateStr;

    // Get auth headers
    const authHeader = req.headers.get("Authorization");
    let apiKey = "";
    let modelId = FALLBACK_MODELS[0];

    // Priority: 1) api_key from body (user's global key from Settings)
    //           2) model_config_id → fetch from Vault
    //           3) OPENROUTER_API_KEY env var

    if (api_key && typeof api_key === "string" && api_key.trim()) {
      apiKey = api_key.trim();
      console.log(`${LOG_PREFIX} [${requestId}] Using API key from request body`);
    } else if (model_config_id && authHeader) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (!userError && user) {
          const { data: secret, error: rpcError } = await supabase.rpc(
            "get_decrypted_model_key",
            { p_config_id: model_config_id },
          );

          if (!rpcError && secret) {
            apiKey = secret;

            const { data: config } = await supabase
              .from("user_model_configs")
              .select("model_id")
              .eq("id", model_config_id)
              .single();

            if (config?.model_id) {
              modelId = config.model_id;
            }
          } else {
            console.warn(
              `${LOG_PREFIX} [${requestId}] Failed to retrieve model key, falling back to default`,
            );
          }
        }
      } catch (vaultErr) {
        console.warn(
          `${LOG_PREFIX} [${requestId}] Vault error: ${vaultErr}, using default model`,
        );
      }
    }

    // Fallback to env var if no key provided from body or Vault
    if (!apiKey) {
      apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          events: [],
          error: "No API key configured. Add a model in Settings or set OPENROUTER_API_KEY.",
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Build system prompt
    const systemPrompt =
      `You are a precise calendar event extraction engine. Your task is to parse natural language text and extract event details.

CRITICAL RULES:
1. The user's current reference date is ${refDateDisplay}.
2. The user's timezone is ${tz}.
3. ALL relative date expressions ("tomorrow", "next Thursday", "in 2 weeks", "this weekend", "saturday 10pm") MUST be calculated from the current reference date in the user's timezone, then converted to ISO 8601 UTC format.
4. If only a start time is given (e.g. "10pm"), infer the end_time based on the activity type: dinner=2h, movie=2.5h, meeting=1h, workout=1.5h, default=2h.
5. If no time is mentioned at all, default to 9:00 AM for start and 11:00 AM for end.
6. If no year is mentioned, assume the current year or next occurrence.
7. Return ONLY valid ISO 8601 UTC datetime strings for start_time and end_time.
8. NEVER output an end_time before start_time.
9. Set is_all_day to true ONLY if the text explicitly indicates an all-day event (e.g., "all day", "whole day").
10. If the text mentions something that is NOT an event (e.g., general conversation, questions), do NOT create an event for it.
11. Be comprehensive: extract EVERY event-like mention, including implicit ones.
12. Output valid JSON matching the schema exactly.`;

    console.log(
      `${LOG_PREFIX} [${requestId}] Parsing with model=${modelId}, input_length=${text.length}`,
    );

    // Call OpenRouter with retry + fallback models
    let openRouterRes: Response | null = null;
    let lastError = "";
    let lastErrorStatus = 0;

    const modelsToTry = [modelId, ...FALLBACK_MODELS.filter((m) => m !== modelId)];

    for (const tryModel of modelsToTry) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`${LOG_PREFIX} [${requestId}] Retry ${attempt}/${MAX_RETRIES} for ${tryModel} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }

        openRouterRes = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "https://memrys.app",
            "X-Title": "Memrys Brain Dump Parser",
          },
          body: JSON.stringify({
            model: tryModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            response_format: JSON_SCHEMA,
            temperature: 0,
            max_tokens: 4096,
          }),
        });

        if (openRouterRes.ok) break;

        const errBody = await openRouterRes.text().catch(() => "Unknown error");
        lastError = errBody.slice(0, 500);
        lastErrorStatus = openRouterRes.status;
        const isRateLimited = openRouterRes.status === 429;
        const isContextLimit = openRouterRes.status === 400 &&
          (errBody.includes("context_length") || errBody.includes("too long"));

        console.error(
          `${LOG_PREFIX} [${requestId}] ${tryModel} attempt ${attempt}: ${openRouterRes.status}: ${lastError}`,
        );

        // Context limit is not recoverable with retries
        if (isContextLimit) {
          return new Response(
            JSON.stringify({
              events: [],
              error: "Input is too long for the model. Try shortening your text or using a model with larger context.",
              reset_session: true,
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders() } },
          );
        }

        // If not rate limited and not context limit, it's a different error — give up on this model
        if (!isRateLimited) break;
      }

      if (openRouterRes?.ok) break;
      // Rate limited even after retries — try next fallback model
    }

    if (!openRouterRes?.ok) {
      const isRateLimited = lastErrorStatus === 429;
      return new Response(
        JSON.stringify({
          events: [],
          error: isRateLimited
            ? "AI service is rate limited on all available models. Please wait a moment and try again."
            : `AI service returned error ${lastErrorStatus}. The model may be unavailable.`,
          reset_session: isRateLimited || undefined,
        }),
        {
          status: isRateLimited ? 429 : 400,
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        },
      );
    }

    const aiResponse = await openRouterRes.json();
    const content = aiResponse?.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`${LOG_PREFIX} [${requestId}] Empty AI response`);
      return new Response(
        JSON.stringify({ events: [], error: "AI returned empty response. Try again." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    // Parse the AI response
    let parsed: { events?: ParsedEventPayload[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error(`${LOG_PREFIX} [${requestId}] Failed to parse AI JSON: ${content.slice(0, 200)}`);
      return new Response(
        JSON.stringify({
          events: [],
          warnings: ["AI returned invalid JSON format. Try again with clearer input."],
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
      );
    }

    const rawEvents = parsed?.events ?? [];

    // Validate and filter events
    const warnings: string[] = [];
    const validEvents: ParsedEventPayload[] = [];

    for (const ev of rawEvents) {
      if (!ev.title || typeof ev.title !== "string") {
        warnings.push("Skipped event with missing title");
        continue;
      }

      if (!isValidISO(ev.start_time) || !isValidISO(ev.end_time)) {
        warnings.push(
          `Skipped "${ev.title}": invalid date format from AI`,
        );
        continue;
      }

      if (
        !isWithinWindow(ev.start_time, refDate, HALLUCINATION_WINDOW_DAYS) ||
        !isWithinWindow(ev.end_time, refDate, HALLUCINATION_WINDOW_DAYS)
      ) {
        warnings.push(
          `Skipped "${ev.title}": dates outside valid range (hallucination guard)`,
        );
        continue;
      }

      validEvents.push({
        title: ev.title,
        description: ev.description || "",
        start_time: ev.start_time,
        end_time: ev.end_time,
        is_all_day: Boolean(ev.is_all_day),
      });
    }

    const duration = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(
      `${LOG_PREFIX} [${requestId}] Done: ${validEvents.length} events, ${warnings.length} warnings, ${duration}s`,
    );

    return new Response(
      JSON.stringify({
        events: validEvents,
        warnings: warnings.length > 0 ? warnings : undefined,
      } satisfies ParseResponse),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  } catch (err) {
    console.error(`${LOG_PREFIX} [${requestId}] Unhandled error:`, err);
    return new Response(
      JSON.stringify({
        events: [],
        error: "Internal server error. Please try again.",
      } satisfies ParseResponse),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
