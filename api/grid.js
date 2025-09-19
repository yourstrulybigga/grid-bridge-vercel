import { Client as NotionClient } from '@notionhq/client';
import OpenAI from 'openai';

// Environment
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_SECRET = process.env.NOTION_SECRET;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
if (!NOTION_SECRET) throw new Error('Missing NOTION_SECRET');

const notion = new NotionClient({ auth: NOTION_SECRET });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DEFAULT_GRID_SYSTEM_PROMPT = `You are Grid, a creative, witty, blunt, encouraging digital right-hand for an entrepreneur named YoursTru. Use a poetic, lyrical tone, tell it like it is — no sugarcoating. Do not invent facts. Keep responses concise, practical, and include step-by-step next actions when helpful. When asked to produce templates or code, provide copy-paste ready output. Sign off occasionally with: ‘— Grid’.`;

// Utility: read a Notion page property plain-text
async function readPropertyPlain(pageId, propName) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  if (!props[propName]) return null;
  const prop = props[propName];
  const propId = prop.id;
  const val = await notion.pages.properties.retrieve({ page_id: pageId, property_id: propId });
  // Handle rich_text/title
  if (val.type === 'property_item' && val.property_item) { /* newer SDK may differ */ }
  // Fallback parse
  const toText = (v) => {
    if (!v) return '';
    const arr = v.results || v.rich_text || v.title || [];
    return arr.map(r => (r[r.type]?.plain_text) || r.plain_text || '').join('');
  };
  return toText(val);
}

// Utility: write to a rich_text property
async function writeRichText(pageId, propName, text) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  if (!props[propName]) throw new Error(`Property "${propName}" not found on page`);
  const rich = [{ type: 'text', text: { content: text } }];
  const payload = { page_id: pageId, properties: {} };
  payload.properties[propName] = { rich_text: rich };
  return notion.pages.update(payload);
}

// Utility: set a Select property
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
    const { page_id, question, grid_system_prompt, model } = req.body || {};
    if (!page_id) return res.status(400).json({ ok: false, error: 'Missing page_id' });

    const userQuestion = question || (await readPropertyPlain(page_id, 'User Question'));
    if (!userQuestion || userQuestion.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'No User Question found on page and none provided' });
    }

    const sysPrompt = grid_system_prompt || DEFAULT_GRID_SYSTEM_PROMPT;
    const useModel = model || DEFAULT_MODEL;

    const chat = await openai.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userQuestion }
      ],
      temperature: 0.6,
      max_tokens: 700
    });

    const reply = chat.choices?.[0]?.message?.content?.trim() || '(no reply)';
    await writeRichText(page_id, 'Grid Reply', reply);
    await setSelect(page_id, 'Status', 'Replied');

    return res.status(200).json({ ok: true, page_id, reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
