import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { SECRETARY_TOOLS, runSecretaryTool } from '@/lib/ai/secretaryTools'

const MODEL = 'claude-sonnet-5'

/** Hard ceiling so a confused loop cannot run away and rack up cost. */
const MAX_TOOL_ROUNDS = 5

/**
 * 1024 truncated real work. A set of minutes or a condolence letter —
 * the two drafting jobs this exists for — runs well past it, and the
 * officer got a draft that stopped mid-sentence with no indication it
 * had been cut. Answers to data questions stay short because the prompt
 * asks them to, not because the ceiling forces it.
 */
const MAX_TOKENS = 3000

/**
 * How many turns of history to resend.
 *
 * The whole conversation, tool results included, went back to the model
 * on every message — so a long session paid for its own transcript
 * again with each question, and the cost grew with the square of its
 * length. Recent turns carry the thread; older ones rarely change an
 * answer about who owes dues.
 */
const MAX_HISTORY_MESSAGES = 20

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { tenantId, messages } = await request.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing messages array' }, { status: 400 })
    }

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI Secretary is not configured — ANTHROPIC_API_KEY is missing from the environment.' },
        { status: 500 }
      )
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const supabase = await createClient()

    /**
     * The model was told nothing about WHERE or WHEN it was working, so
     * "next month's stated communication" and "this year's dues" were
     * guesses against its training cutoff rather than against today.
     * One cheap read fixes both.
     */
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, number')
      .eq('id', tenantId)
      .maybeSingle()

    const lodgeName = tenant ? `${(tenant as any).name} #${(tenant as any).number}` : 'this lodge'
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

    const systemPrompt = `You are the AI Secretary for ${lodgeName}, built into LodgeOS. Today is ${today}.

You help the lodge Secretary and other officers with two things:

1. ANSWERING QUESTIONS about the lodge using your tools — dues, roster, individual brothers, attendance, candidates, events, petitions. ALWAYS use a tool rather than guessing or estimating. When a question names a particular brother, use find_member rather than pulling the whole roster. When a tool reports "truncated": true, say so rather than answering as though you saw everything. If a question needs data you have no tool for, say so plainly.

2. DRAFTING TEXT — meeting minutes from rough notes, condolence letters, dues reminder language, event announcements — in a tone appropriate to Masonic correspondence: respectful, fraternal, not archaic. Address brothers as "Brother [Name]" or "Bro. [Name]" where natural. You draft; you do not send. Every draft is for a human to review and send through the app's own tools.

You cannot send emails, change records, approve petitions, or mark anything paid — you are read-only for data and draft-only for text. If asked to perform an action, prepare the content and say which page the officer takes it to.

STYLE. Answering a data question: lead with the answer in one sentence, then only the detail that supports it. Use a short list when naming more than three brothers. No preamble, no restating the question, no offers of further help. This is a busy volunteer officer between other duties, not a chat audience. Drafting is the exception — there, produce the full piece.`

    // Keep the system prompt and the opening of the thread; drop the
    // middle of a long session rather than the question just asked.
    const history: Anthropic.MessageParam[] = messages.length > MAX_HISTORY_MESSAGES
      ? messages.slice(-MAX_HISTORY_MESSAGES)
      : messages

    let conversation: Anthropic.MessageParam[] = history

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: [...SECRETARY_TOOLS],
        messages: conversation,
      })

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUseBlocks.length === 0) {
        conversation = [...conversation, { role: 'assistant', content: response.content }]
        const finalText = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map(b => b.text)
          .join('\n')
        return NextResponse.json({ reply: finalText, conversation })
      }

      conversation = [...conversation, { role: 'assistant', content: response.content }]

      /**
       * In parallel. These are independent reads against the same
       * database; running them one after another added a round trip per
       * tool to a wait the officer is already sitting through.
       *
       * `as any` on the name: the SDK types tool_use.name as a bare
       * string, having no way to know our tool names at its compile
       * time. Safe because runSecretaryTool's switch has a default case
       * returning an error object rather than throwing.
       */
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          try {
            const result = await runSecretaryTool(
              supabase,
              tenantId,
              block.name as any,
              (block.input ?? {}) as Record<string, any>
            )
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            }
          } catch (toolError: any) {
            // Hand the failure back to the model rather than collapsing
            // the whole request: it can tell the officer which lookup
            // failed, which is more use than a 500.
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: toolError?.message ?? 'That lookup failed.' }),
              is_error: true,
            }
          }
        })
      )

      conversation = [...conversation, { role: 'user', content: toolResults }]
    }

    return NextResponse.json(
      { error: 'The AI Secretary made too many tool calls without reaching an answer. Try rephrasing your question.' },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('AI Secretary error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
