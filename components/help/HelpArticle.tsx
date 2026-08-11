'use client'
import { T } from '@/lib/designTokens'
import { helpTopic, type HelpBlock, type HelpTopic } from '@/lib/help'

/**
 * One help topic, rendered.
 *
 * Shared by the ? in the header and the full help page, so the words a
 * man reads in the modal are the same words, in the same order, as the
 * ones he finds if he goes looking for them later. Two renderers would
 * drift, and help that contradicts itself is worse than none.
 *
 * Tables are two columns and nothing else. A phone is 390 points wide;
 * a third column is where a table stops being readable and starts being
 * a horizontal scroll nobody discovers.
 */

const mono = {
  fontFamily: T.mono,
  fontSize: '9px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
}

function Block({ block }: { block: HelpBlock }) {
  if (block.kind === 'p') {
    return (
      <p style={{ fontFamily: T.body, fontSize: '1rem', lineHeight: 1.7, color: T.inkFaint, margin: '0 0 0.9rem' }}>
        {block.text}
      </p>
    )
  }

  if (block.kind === 'steps') {
    return (
      <ol style={{ margin: '0 0 1rem', padding: 0, listStyle: 'none' }}>
        {block.items.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
              margin: '0 0 0.6rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                background: T.gold, color: T.bg, fontFamily: T.mono, fontSize: '10px',
                fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: '3px',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontFamily: T.body, fontSize: '1rem', lineHeight: 1.65, color: T.inkFaint }}>
              {item}
            </span>
          </li>
        ))}
      </ol>
    )
  }

  if (block.kind === 'table') {
    return (
      // min-width: 0 is what makes overflow-x actually engage inside a
      // flex or grid parent; without it the table stretches its own
      // container and the whole page scrolls sideways instead.
      <div style={{ overflowX: 'auto', minWidth: 0, margin: '0 0 1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: T.body, fontSize: '0.94rem' }}>
          {block.head && (
            <thead>
              <tr>
                {block.head.map(h => (
                  <th
                    key={h}
                    style={{
                      ...mono, color: T.gold, textAlign: 'left', padding: '6px 10px 6px 0',
                      borderBottom: `1px solid ${T.borderStrong}`, fontWeight: 400,
                      width: '46%',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '7px 10px 7px 0', verticalAlign: 'top', lineHeight: 1.55,
                      borderBottom: `1px solid ${T.border}`,
                      color: j === 0 ? T.ink : T.inkFaint,
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const warn = block.kind === 'warn'
  return (
    <div
      style={{
        borderLeft: `3px solid ${warn ? T.danger : T.gold}`,
        background: warn ? T.dangerDim : T.goldDim,
        padding: '0.7rem 0.9rem', margin: '0 0 1rem', borderRadius: '0 4px 4px 0',
      }}
    >
      <div style={{ ...mono, color: warn ? T.danger : T.gold, marginBottom: '4px' }}>
        {block.title}
      </div>
      <div style={{ fontFamily: T.body, fontSize: '0.96rem', lineHeight: 1.6, color: T.inkFaint }}>
        {block.text}
      </div>
    </div>
  )
}

export function HelpArticle({
  topic,
  onFollow,
}: {
  topic: HelpTopic
  /** Called when a "see also" is pressed, with the topic key. */
  onFollow?: (key: string) => void
}) {
  return (
    <div>
      {topic.blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}

      {topic.who && (
        <div
          style={{
            borderLeft: `3px solid ${T.info}`, background: T.infoDim,
            padding: '0.7rem 0.9rem', margin: '0 0 1rem', borderRadius: '0 4px 4px 0',
          }}
        >
          <div style={{ ...mono, color: T.info, marginBottom: '4px' }}>Who may do this</div>
          <div style={{ fontFamily: T.body, fontSize: '0.96rem', lineHeight: 1.6, color: T.inkFaint }}>
            {topic.who}
          </div>
        </div>
      )}

      {onFollow && topic.see && topic.see.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
          {topic.see.map(key => (
            <SeeAlso key={key} topicKey={key} onFollow={onFollow} />
          ))}
        </div>
      )}
    </div>
  )
}

function SeeAlso({ topicKey, onFollow }: { topicKey: string; onFollow: (key: string) => void }) {
  // A key that names no topic renders nothing rather than a dead
  // button — a "see also" that goes nowhere is a bug report waiting.
  const topic = helpTopic(topicKey)
  if (!topic) return null
  return (
    <button
      onClick={() => onFollow(topicKey)}
      style={{
        background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4,
        color: T.gold, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
        textTransform: 'uppercase', padding: '7px 11px', cursor: 'pointer',
      }}
    >
      {topic.title} &rarr;
    </button>
  )
}
