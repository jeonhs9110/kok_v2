import { unstable_cache } from 'next/cache';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

// Suppress the "OPENAI_API_KEY not set" warning after the first emit
// per process — every product-detail request hits this path in dev
// deploys that don't ship the key, and a chatbot outage / config
// drift can push thousands of duplicate warnings/minute through
// CloudWatch ingest. One line per process cold-start is enough to
// tell an operator the config isn't wired.
let missingKeyLogged = false;

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  cn: 'Simplified Chinese',
  jp: 'Japanese',
  vn: 'Vietnamese',
  th: 'Thai',
};

export interface TranslatableProduct {
  name: string;
  summary: string;
  description: string;
  ingredient: string;
}

// Internal – raw API call, not cached
async function callOpenAI(
  fields: TranslatableProduct,
  targetLang: string
): Promise<TranslatableProduct> {
  if (!OPENAI_API_KEY) {
    if (!missingKeyLogged) {
      console.warn('[translate] OPENAI_API_KEY not set – returning original.');
      missingKeyLogged = true;
    }
    return fields;
  }

  const langName = LANG_NAMES[targetLang];
  if (!langName) return fields; // 'kr' → no translation needed

  const prompt = `You are a professional Korean beauty (K-beauty) product copywriter and translator.
Translate the following Korean skincare product fields into ${langName}.

Rules:
- Keep ingredient codes and cosmetic terms (PDRN, EGF, CICA, RETINOL, SPF, etc.) unchanged.
- Keep the brand voice: clean, premium, and concise.
- Return ONLY valid JSON with the exact same 4 keys: name, summary, description, ingredient.

Input:
${JSON.stringify(fields, null, 2)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    // Allow up to 20s for the API call
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'No error body');
    console.warn(`[translate] OpenAI API error ${res.status}: ${errText}`);
    return fields;
  }

  const data = await res.json();
  try {
    const translated = JSON.parse(data.choices[0].message.content) as Partial<TranslatableProduct>;
    return {
      name:        translated.name        || fields.name,
      summary:     translated.summary     || fields.summary,
      description: translated.description || fields.description,
      ingredient:  translated.ingredient  || fields.ingredient,
    };
  } catch {
    console.warn('[translate] Failed to parse GPT response');
    return fields;
  }
}

// Cached wrapper – stores translation in Next.js data cache for 30 days.
// Product copy rarely changes; a 24-hour TTL was re-translating the
// full catalog every day at 5 langs × N products = high OpenAI cost
// with no benefit. Admin saves invalidate via the 'products' tag
// (revalidateHomepageData('products') at useProductForm.ts), so
// operator edits still flush the cache within a minute — the 30-day
// TTL is a bound on drift for products the operator never touches.
export const translateProduct = unstable_cache(
  async (
    _productId: string,
    lang: string,
    name: string,
    summary: string,
    description: string,
    ingredient: string
  ): Promise<TranslatableProduct> => {
    return callOpenAI({ name, summary, description, ingredient }, lang);
  },
  ['openai-product-translation-v2'], // Version 2 cache bust
  { revalidate: 60 * 60 * 24 * 30, tags: ['products'] } // 30-day cache, admin-save-invalidated
);

// Batch version for product listings (name + summary only, cheaper)
async function callOpenAIBatch(
  products: Array<{ id: string; name: string; summary: string }>,
  targetLang: string
): Promise<Record<string, { name: string; summary: string }>> {
  if (!OPENAI_API_KEY || !LANG_NAMES[targetLang]) {
    return Object.fromEntries(products.map(p => [p.id, { name: p.name, summary: p.summary }]));
  }

  const langName = LANG_NAMES[targetLang];

  const prompt = `You are a Korean beauty product translator. Translate these product names and summaries into ${langName}.
Keep cosmetic ingredient codes (PDRN, EGF, CICA, etc.) unchanged. Be concise and premium.
Return ONLY a JSON object where each key is the product id and value has "name" and "summary" fields.

Input:
${JSON.stringify(
  Object.fromEntries(products.map(p => [p.id, { name: p.name, summary: p.summary }])),
  null, 2
)}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.warn('[translate-batch] OpenAI API error', res.status);
    return Object.fromEntries(products.map(p => [p.id, { name: p.name, summary: p.summary }]));
  }

  const data = await res.json();
  try {
    const translated = JSON.parse(data.choices[0].message.content) as Record<string, { name: string; summary: string }>;
    // Merge with originals as fallback for any missing entries
    return Object.fromEntries(
      products.map(p => [
        p.id,
        {
          name:    translated[p.id]?.name    || p.name,
          summary: translated[p.id]?.summary || p.summary,
        },
      ])
    );
  } catch {
    return Object.fromEntries(products.map(p => [p.id, { name: p.name, summary: p.summary }]));
  }
}

// Cached batch translation – key: lang + all product ids joined
export const translateProductsBatch = unstable_cache(
  async (
    lang: string,
    products: Array<{ id: string; name: string; summary: string }>
  ): Promise<Record<string, { name: string; summary: string }>> => {
    // See translateProduct comment — same log removed for the same
    // CloudWatch-noise + key-leak reason.
    return callOpenAIBatch(products, lang);
  },
  ['openai-products-batch-translation-v2'], // Version 2 cache bust
  { revalidate: 60 * 60 * 24 } // 24-hour cache
);
