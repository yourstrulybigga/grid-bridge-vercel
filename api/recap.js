import { openai, readPropertyPlain, writeRichText, setSelect } from './_helpers.js';

const DEFAULT_RECAP_SYSTEM_PROMPT = `You are Grid, writing weekly recaps for Last Squad Standing.
Tone: lyrical, hype, sports-announcer energy with clever wordplay.
Format: exactly 2 short paragraphs (5–7 sentences total).
Include: week number, the biggest upset (by name), the number eliminated, the number still alive, and one tease for next week.
Keep it clean and punchy. Avoid repetitive stats; focus on story and drama.
Brevity: keep the two paragraphs tight; aim for ~120–160 words total.`;

const LEAN = (process.env.LEAN_MODE || 'false').toLowerCase() === 'true';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { page_id, week, summary, biggest_upset, eliminated, alive, notes, model, system_prompt } = req.body || {};
    if (!page_id) return res.status(400).json({ ok: false, error: 'Missing page_id' });

    const Week = week || (await readPropertyPlain(page_id, 'Week'));
    const Summary = summary || (await readPropertyPlain(page_id, 'Standings Summary'));
    const Upset = biggest_upset || (await readPropertyPlain(page_id, 'Biggest Upset'));
    const Eliminated = eliminated || (await readPropertyPlain(page_id, 'Eliminated'));
    const Alive = alive || (await readPropertyPlain(page_id, 'Still Alive'));
    const Notes = notes || (await readPropertyPlain(page_id, 'Notes'));

    const userPrompt = `Create a Last Squad Standing recap.
Week: ${Week || ''}
Standings Summary: ${Summary || ''}
Biggest Upset: ${Upset || ''}
Eliminated: ${Eliminated || ''}
Still Alive: ${Alive || ''}
Notes: ${Notes || ''}`.trim();

    const sysPrompt = system_prompt || DEFAULT_RECAP_SYSTEM_PROMPT;
    const useModel = model || process.env.OPENAI_MODEL || 'gpt-5';

    const chat = await openai.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: (LEAN ? 0.55 : 0.65),
      max_tokens: (LEAN ? 320 : 500)
    });

    const reply = chat.choices?.[0]?.message?.content?.trim() || '(no recap)';
    await writeRichText(page_id, 'Recap', reply);
    await setSelect(page_id, 'Status', 'Replied');
    return res.status(200).json({ ok: true, page_id, recap: reply, lean: LEAN });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
