// ════════════════════════════════════════════════════════════════
// Vercel AI Gateway — standalone test script.
//
// Two ways to authenticate (the gateway reads either, in this order):
//   1. AI_GATEWAY_API_KEY  (a vck_... key you create at vercel.com)
//   2. VERCEL_OIDC_TOKEN   (auto-injected when deployed on Vercel)
//
// Run locally:
//   1. npm install            (already done — installs the `ai` SDK)
//   2. echo "AI_GATEWAY_API_KEY=vck_your_key" > .env.local
//      (or, on Vercel:  vc env pull .env.local  — pulls VERCEL_OIDC_TOKEN)
//   3. node --env-file=.env.local index.mjs
//
// The gateway is OpenAI-compatible, so we point @ai-sdk/openai-compatible
// at https://ai-gateway.vercel.sh/v1. Models use the "provider/model"
// format, e.g. openai/gpt-5.5, anthropic/claude-opus-4.8, google/gemini-3-flash.
// ════════════════════════════════════════════════════════════════

import { streamText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN

if (!apiKey) {
  console.error('✗ No AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN found.')
  console.error('  Create a .env.local with:  AI_GATEWAY_API_KEY=vck_...')
  console.error('  Or on Vercel run:          vc env pull .env.local')
  process.exit(1)
}

// Point the OpenAI-compatible provider at the Vercel AI Gateway.
const gateway = createOpenAICompatible({
  name: 'vercel-ai-gateway',
  baseURL: 'https://ai-gateway.vercel.sh/v1',
  apiKey,
})

// Pick a model in "provider/model" form. Cheap default for testing.
const MODEL = process.env.GATEWAY_MODEL || 'openai/gpt-4o-mini'
console.log(`→ Model: ${MODEL}\n`)

const result = streamText({
  model: gateway(MODEL),
  prompt: 'Explain quantum computing in simple terms.',
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
process.stdout.write('\n')
