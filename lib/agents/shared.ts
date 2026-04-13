import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const anthropic = new Anthropic()

export function getModel(agentOverrideEnv?: string): string {
  if (agentOverrideEnv) {
    const override = process.env[agentOverrideEnv]
    if (override) return override
  }
  return process.env.CLAUDE_MODEL_DEFAULT ?? 'claude-sonnet-4-20250514'
}

export interface AgentCallOptions {
  model: string
  system: string
  userMessage: string
  maxTokens?: number
}

export async function callAgent(options: AgentCallOptions): Promise<string> {
  const response = await anthropic.messages.create({
    model: options.model,
    max_tokens: options.maxTokens ?? 1024,
    system: options.system,
    messages: [{ role: 'user', content: options.userMessage }],
  })

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') {
    throw new Error('No text block in agent response')
  }
  return block.text
}

export async function callAgentJSON<T>(
  options: AgentCallOptions,
  schema: z.ZodType<T>
): Promise<T> {
  const systemWithJSON =
    options.system + '\n\nRespondé ÚNICAMENTE con JSON válido, sin explicaciones ni texto adicional.'

  const raw = await callAgent({ ...options, system: systemWithJSON })

  // Extract JSON from the response (handle code fences)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Agent returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  return schema.parse(parsed)
}
