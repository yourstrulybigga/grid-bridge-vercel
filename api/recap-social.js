import { openai, readPropertyPlain, writeRichText } from './_helpers.js';

const SOCIAL_PROMPT = `You are Grid. Turn a weekly Last Squad Standing recap into FIVE social-ready outputs:
1) X/Twitter (<=280 chars, punchy, 1-2 emojis, include a single hashtag if provided, no links).
2) Instagram caption (2-4 short lines, 3-6 hashtags max, include CTA if provided).
3) YouTube description (2 short paragraphs, include CTA and hashtags if provided).
4) Facebook post (2-4 sentences, friendly tone, include CTA and up to 3 hashtags).
5) TikTok caption (1-2 short lines, 2-4 hashtags max).

Tone: hype, clean, high-energy sports voice with a dash of lyrical flair. Avoid overusing emojis or hashtags.
Brevity: keep each output tight and platform-appropriate.`;

function cap280(text){
  if(!text) return '';
  const max=280;
  if(text.length<=max) return text;
  let slice=text.slice(0,max-1).trim();
  const lastSpace=slice.lastIndexOf(' ');
  if(lastSpace>200) slice=slice.slice(0,lastSpace).trim();
  return slice+'…';
}

const LEAN = (process.env.LEAN_MODE || 'false').toLowerCase() === 'true';

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const { page_id, recap, hashtags, cta, model } = req.body || {};
    if(!page_id) return res.status(400).json({ok:false,error:'Missing page_id'});
    const Recap = recap || (await readPropertyPlain(page_id,'Recap'));
    const Hashtags = hashtags || (await readPropertyPlain(page_id,'Hashtags')) || '';
    const CTA = cta || (await readPropertyPlain(page_id,'CTA')) || '';
    if(!Recap) return res.status(400).json({ok:false,error:'No recap found. Generate with /api/recap first or pass recap in body.'});
    const useModel = model || process.env.OPENAI_MODEL || 'gpt-5';
    const userContent = `Recap:\n${Recap}\n\nOptional Hashtags: ${Hashtags}\nOptional CTA: ${CTA}`;
    const chat = await openai.chat.completions.create({ model: useModel, messages:[{role:'system',content:SOCIAL_PROMPT},{role:'user',content:userContent}], temperature:(LEAN?0.6:0.7), max_tokens:(LEAN?420:700) });
    const raw = chat.choices?.[0]?.message?.content?.trim() || '';
    const lines = raw.split('\n').map(l=>l.trim());
    const pick=(label)=>{const i=lines.findIndex(l=>l.toLowerCase().startsWith(label)); if(i===-1) return ''; const out=[]; for(let j=i+1;j<lines.length;j++){const L=lines[j]; if(/^(1\)|2\)|3\)|4\)|5\))/i.test(L)) break; out.push(L);} return out.join('\n').trim();};
    const xPost = pick('1)') || pick('x/twitter') || '';
    const igCaption = pick('2)') || pick('instagram') || '';
    const ytDesc = pick('3)') || pick('youtube') || '';
    const fbPost = pick('4)') || pick('facebook') || '';
    const tiktokCap = pick('5)') || pick('tiktok') || '';
    if(xPost) await writeRichText(page_id,'X Post',cap280(xPost));
    if(igCaption) await writeRichText(page_id,'IG Caption',igCaption);
    if(ytDesc) await writeRichText(page_id,'YT Description',ytDesc);
    if(fbPost) await writeRichText(page_id,'Facebook Post',fbPost);
    if(tiktokCap) await writeRichText(page_id,'TikTok Caption',tiktokCap);
    return res.status(200).json({ok:true,page_id,xPost:cap280(xPost),igCaption,ytDesc,facebook:fbPost,tiktok:tiktokCap,lean:LEAN});
  }catch(e){ console.error(e); return res.status(500).json({ok:false,error:e.message});}
}
