import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { SECRETARY_TOOLS, runSecretaryTool } from '@/lib/ai/secretaryTools'

const MODEL = 'claude-sonnet-5'
const MAX_TOOL_ROUNDS = 5 // hard ceiling so a confused loop can't run away and rack up API cost

const SYSTEM_PROMPT = `You are the AI Secretary for a Masonic lodge, built into LodgeOS. You help the lodge Secretary and other officers with two things:

1. Answering questions about the lodge using the tools available to you — dues status, roster, candidates, events, petitions, attendance. ALWAYS use a tool to look up real data rather than guessing or estimating. If a question needs data you don't have a tool for, say so plainly rather than making something up.

2. Drafting text — meeting minutes from rough notes, condolence letters, dues reminder language, event announcements — in a tone appropriate to Masonic correspondence: respectful, fraternal, not overly formal or archaic. Address brothers as "Brother [Name]" or "Bro. [Name]" where natural. You draft; you do not send. Every draft you produce is for a human to review and send through the app's own tools.

You cannot send emails, change any records, approve or deny petitions, or mark anything as paid — you are read-only for data and draft-only for text. If asked to actually perform an action (not draft text about one), explain that you can prepare the content but the human needs to take the actual action through the relevant page in the app.

Keep answers concise and direct. This is a busy volunteer officer, not a chat audience.`

export async function POST(request: Request) {
  try {
    const { tenantId, messages } = await request.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages array' }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI Secretary is not configured — ANTHROPIC_API_KEY is missing from the environment.' }, { status: 500 })
    }
    console.log(
  'ANTHROPIC KEY EXISTS:',
  !!process.env.ANTHROPIC_API_KEY
)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const supabase = await createClient()

    let conversation: Anthropic.MessageParam[] = messages

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      console.log('Calling Anthropic...')
      const response = await anthropic.messages.create({
        
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: SECRETARY_TOOLS,
        messages: conversation,
      })
      console.log('Anthropic responded')
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      if (toolUseBlocks.length === 0) {
        conversation = [...conversation, { role: 'assistant', content: response.content }]
        const finalText = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n')
        return NextResponse.json({ reply: finalText, conversation })
      }

      conversation = [...conversation, { role: 'assistant', content: response.content }]

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        // `as any`: the SDK types tool_use.name as a bare string, since it
        // has no way to know our specific tool names at its own compile
        // time. Safe because runSecretaryTool's switch has a default case
        // returning a clean error object rather than throwing.
        const result = await runSecretaryTool(supabase, tenantId, block.name as any)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      conversation = [...conversation, { role: 'user', content: toolResults }]
    }

    return NextResponse.json({ error: 'The AI Secretary made too many tool calls without reaching an answer. Try rephrasing your question.' }, { status: 500 })
  } catch (error: any) {
    console.error('AI Secretary error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
