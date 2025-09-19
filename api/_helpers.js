import { Client as NotionClient } from '@notionhq/client';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NOTION_SECRET = process.env.NOTION_SECRET;

if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
if (!NOTION_SECRET) throw new Error('Missing NOTION_SECRET');

export const notion = new NotionClient({ auth: NOTION_SECRET });
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function readPropertyPlain(pageId, propName) {
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

export async function writeRichText(pageId, propName, text) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  const props = page.properties;
  if (!props[propName]) throw new Error(`Property "${propName}" not found on page`);
  const rich = [{ type: 'text', text: { content: text } }];
  const payload = { page_id: pageId, properties: {} };
  payload.properties[propName] = { rich_text: rich };
  return notion.pages.update(payload);
}

export async function setSelect(pageId, propName, optionName) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!page.properties[propName]) return;
  const payload = { page_id: pageId, properties: {} };
  payload.properties[propName] = { select: { name: optionName } };
  return notion.pages.update(payload);
}
