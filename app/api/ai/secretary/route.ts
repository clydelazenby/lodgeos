import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { SECRETARY_TOOLS, runSecretaryTool } from '@/lib/ai/secretaryTools'
import { toolLabel } from '@/lib/ai/toolLabels'

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

/**
 * THE REPLY STREAMS.
 *
 * This used to be one JSON response at the end of everything: the
 * officer asked a question and then watched a static "Working…" for as
 * long as it took to run up to five rounds of database lookups and
 * write three thousand tokens of minutes. Nothing was wrong, but there
 * was no way to tell that from the outside, and the honest reading of a
 * frozen box is that it has hung — which is exactly what was reported.
 *
 * The wire format is NDJSON, one JSON object per line:
 *
 *   {"t":"text","v":"…"}      a fragment of the answer, as written
 *   {"t":"tools","v":[…]}     lookups now running; the text so far in
 *                             this round was preamble ("let me check")
 *                             and the client discards it
 *   {"t":"done","reply":…,"conversation":[…]}
 *   {"t":"error","v":"…"}
 *
 * NDJSON rather than SSE because there is no EventSource here — the
 * client already has to POST a body, so it reads the response with a
 * reader either way, and newline-delimited JSON is the simpler thing to
 * parse correctly.
 *
 * Failures BEFORE the stream opens (auth, missing key, bad body) stay
 * ordinary JSON with a real status code. Once bytes are on the wire the
 * status is already 200 and the only honest way to report a failure is
 * an error line inside the stream.
 */
export async function POST(request: Request) {
  let tenantId: string
  let messages: Anthropic.MessageParam[]

  try {
    const body = await request.json()
    tenantId = body.tenantId
    messages = body.messages
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 })
  }

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

2. DRAFTING TEXT — meeting minutes, condolence letters, dues reminder language, event announcements.

MINUTES SPECIFICALLY. When asked for minutes, call get_meeting_record FIRST. The lodge already recorded the agenda as it was worked through, who answered the roll, and which visiting brethren signed the register — build the minutes from that rather than asking the officer to retype it, and fold in any rough notes he adds. Name the visiting brethren and their lodges; that is what minutes of a stated communication traditionally do. If the tool reports minutes already exist for that meeting, say so and ask before drafting a second set.

All drafting is done in a tone appropriate to Masonic correspondence: respectful, fraternal, not archaic. Address brothers as "Brother [Name]" or "Bro. [Name]" where natural. You draft; you do not send. Every draft is for a human to review and send through the app's own tools.

MARKING A DRAFT. When what you produce is meant to be sent or recorded — minutes, a letter, a notice, an announcement — wrap it in these markers, each on its own line:
<<<DRAFT>>>
Subject: a short subject line, when the draft is something that would be emailed
the draft itself
<<<END>>>
Keep any commentary outside the markers. The app shows what is inside them as a document with its own Copy and Send-as-notice actions, so nothing but the draft belongs there. Do NOT use the markers for an answer to a data question — an answer is not a draft.

You cannot send emails, change records, approve petitions, or mark anything paid — you are read-only for data and draft-only for text. If asked to perform an action, prepare the content and say which page the officer takes it to.

STYLE. Answering a data question: lead with the answer in one sentence, then only the detail that supports it. Use a short list when naming more than three brothers. No preamble, no restating the question, no offers of further help. This is a busy volunteer officer between other duties, not a chat audience. Drafting is the exception — there, produce the full piece.`

  // Keep the opening of the thread and the question just asked; drop the
  // middle of a long session rather than either end.
  const history: Anthropic.MessageParam[] =
    messages.length > MAX_HISTORY_MESSAGES ? messages.slice(-MAX_HISTORY_MESSAGES) : messages

  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const line = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
        } catch {
          // The officer navigated away or hit Stop; the stream is closed
          // and there is nowhere left to write. The loop below sees the
          // abort signal and stops on its own.
        }
      }

      try {
        let conversation: Anthropic.MessageParam[] = history

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const stream = anthropic.messages.stream(
            {
              model: MODEL,
              max_tokens: MAX_TOKENS,
              system: systemPrompt,
              tools: [...SECRETARY_TOOLS],
              messages: conversation,
            },
            // Stop paying for tokens the moment the officer hits Stop or
            // closes the tab, rather than generating a full answer into
            // a socket nobody is holding.
            { signal: request.signal }
          )

          // The SDK triggers a bare Promise.reject() — an unhandled
          // rejection, which takes the whole function down — if a
          // stream errors with nothing listening. The iterator below
          // registers a listener of its own, but only once it is
          // running; this closes the gap before it starts. The real
          // handling is the try/catch around all of this.
          stream.on('error', () => {})

          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta' &&
              event.delta.text
            ) {
              line({ t: 'text', v: event.delta.text })
            }
          }

          const response = await stream.finalMessage()

          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          conversation = [...conversation, { role: 'assistant', content: response.content }]

          if (toolUseBlocks.length === 0) {
            const finalText = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
            line({ t: 'done', reply: finalText, conversation })
            controller.close()
            return
          }

          // The text streamed in THIS round was a preamble to a lookup
          // ("Let me check the dues ledger…"), not part of the answer.
          // Telling the client which lookups are running is both the
          // progress report and the signal to clear that preamble, so
          // the finished reply is the answer alone.
          line({ t: 'tools', v: toolUseBlocks.map((b) => toolLabel(b.name)) })

          /**
           * In parallel. These are independent reads against the same
           * database; running them one after another added a round trip
           * per tool to a wait the officer is already sitting through.
           *
           * `as any` on the name: the SDK types tool_use.name as a bare
           * string, having no way to know our tool names at its compile
           * time. Safe because runSecretaryTool's switch has a default
           * case returning an error object rather than throwing.
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
                // Hand the failure back to the model rather than
                // collapsing the whole request: it can tell the officer
                // which lookup failed, which is more use than a 500.
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

        line({
          t: 'error',
          v: 'The AI Secretary made too many lookups without reaching an answer. Try rephrasing the question.',
        })
        controller.close()
      } catch (error: any) {
        // An abort is the officer pressing Stop, not a fault. Saying
        // nothing is right: the client already knows it cancelled.
        if (error?.name === 'AbortError' || request.signal.aborted) {
          try { controller.close() } catch { /* already closed */ }
          return
        }
        console.error('AI Secretary error:', error)
        line({ t: 'error', v: error?.message ?? 'The AI Secretary hit an error.' })
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      // Without this, nginx-style proxies hold the whole response to
      // buffer it, which would undo every bit of the streaming above.
      'X-Accel-Buffering': 'no',
    },
  })
}
