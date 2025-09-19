import { Client as NotionClient } from '@notionhq/client';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_SECRET = process.env.NOTION_SECRET;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
if (!NOTION_SECRET) throw new Error('Missing NOTION_SECRET');

const notion = new NotionClient({ auth: NOTION_SECRET });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DEFAULT_RECAP_SYSTEM_PROMPT = `You are Grid, writing weekly recaps for Last Squad Standing.
Tone: lyrical, hype, sports-announcer energy with clever wordplay.
Format: exactly 2 short paragraphs (5–7 sentences total).
Include: week number, the biggest upset (by name), the number eliminated, the number still alive, and one tease for next week.
Keep it clean and punchy. Avoid repetitive stats and avoid team over-hype; focus on story and drama.
Sign off with — Grid only if asked.`;

// Utility helpers
async function readPropertyPlain(pageId, propName) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  if (!props[propName]) return null;
  const propId = props[propName].id;
  const val = await notion.pages.properties.retrieve({ page_id: pageId, property_id: propId });
  const toText = (v) => {
    if (!v) return '';
    const arr = v.results || v.rich_text || v.title || [];
    return arr.map(r => (r[r.type]?.plain_text) || r.plain_text || '').join('');
  };
  return toText(val);
}

async function writeRichText(pageId, propName, text) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  if (!props[propName]) throw new Error(`Property "${propName}" not found on page`);
  const rich = [{ type: 'text', text: { content: text } }];
  const payload = { page_id: pageId, properties: {} };
  payload.properties[propName] = { rich_text: rich };
  return notion.pages.update(payload);
}

async function setSelect(pageId, propName, optionName) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!page.properties[propName]) return;
  const payload = { page_id: pageId, properties: {} };
  payload.properties[propName] = { select: { name: optionName } };
  return notion.pages.update(payload);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const { page_id, week, summary, biggest_upset, eliminated, alive, notes, model, system_prompt } = req.body || {};
    if (!page_id) return res.status(400).json({ ok: false, error: 'Missing page_id' });

    // Pull data from Notion if not provided directly
    const Week = week || (await readPropertyPlain(page_id, 'Week'));
    const Summary = summary || (await readPropertyPlain(page_id, 'Standings Summary'));
    const Upset = biggest_upset || (await readPropertyPlain(page_id, 'Biggest Upset'));
    const Eliminated = eliminated || (await readPropertyPlain(page_id, 'Eliminated'));
    const Alive = alive || (await readPropertyPlain(page_id, 'Still Alive'));
    const Notes = notes || (await readPropertyPlain(page_id, 'Notes'));

    const promptUser = `Create a Last Squad Standing recap.
Week: ${Week || ''}
Standings Summary: ${Summary || ''}
Biggest Upset: ${Upset || ''}
Eliminated: ${Eliminated || ''}
Still Alive: ${Alive || ''}
Notes: ${Notes || ''}`.trim();

    const sysPrompt = system_prompt || DEFAULT_RECAP_SYSTEM_PROMPT;
    const useModel = model || DEFAULT_MODEL;

    const chat = await openai.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: promptUser }
      ],
      temperature: 0.65,
      max_tokens: 500
    });

    const reply = chat.choices?.[0]?.message?.content?.trim() || '(no recap)';
    await writeRichText(page_id, 'Recap', reply);
    await setSelect(page_id, 'Status', 'Replied');

    return res.status(200).json({ ok: true, page_id, recap: reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
