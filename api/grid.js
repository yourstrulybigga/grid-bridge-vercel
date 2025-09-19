import { openai, readPropertyPlain, writeRichText, setSelect } from './_helpers.js';

const DEFAULT_GRID_SYSTEM_PROMPT = `You are Grid, a creative, witty, blunt, encouraging digital right-hand for an entrepreneur named YoursTru.
Use a poetic, lyrical tone, tell it like it is — no sugarcoating. Do not invent facts.
Brevity: keep replies under ~120 words unless the user asks for long form.`;

const LEAN = (process.env.LEAN_MODE || 'false').toLowerCase() === 'true';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  try {
    const { page_id, question, grid_system_prompt, model } = req.body || {};
    if (!page_id) return res.status(400).json({ ok: false, error: 'Missing page_id' });

    const userQuestion = question || (await readPropertyPlain(page_id, 'User Question'));
    if (!userQuestion) return res.status(400).json({ ok: false, error: 'No User Question found on page and none provided' });

    const sysPrompt = grid_system_prompt || DEFAULT_GRID_SYSTEM_PROMPT;
    const useModel = model || process.env.OPENAI_MODEL || 'gpt-5';

    const chat = await openai.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userQuestion }
      ],
      temperature: (LEAN ? 0.5 : 0.6),
      max_tokens: (LEAN ? 220 : 700)
    });

    const reply = chat.choices?.[0]?.message?.content?.trim() || '(no reply)';
    await writeRichText(page_id, 'Grid Reply', reply);
    await setSelect(page_id, 'Status', 'Replied');

    return res.status(200).json({ ok: true, page_id, reply, lean: LEAN });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
