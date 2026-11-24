import { db } from '../lib/db.js';
import { getCompany, runAgent } from '../lib/agent.js';

async function sendWhatsApp(phoneNumberId, token, to, text) {
  const v = process.env.WA_GRAPH_VERSION || 'v23.0';
  const r = await fetch(`https://graph.facebook.com/${v}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
  });
  if (!r.ok) console.error('WA send failed', r.status, await r.text());
}

export default async function handler(req, res) {
  // تحقق Meta من الـ webhook
  if (req.method === 'GET') {
    const q = req.query;
    if (q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(q['hub.challenge']);
    }
    return res.status(403).send('forbidden');
  }
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    if (!msg) return res.status(200).json({ ok: true }); // تحديثات حالة، نتجاهلها

    // منع الرد مرتين لو Meta أعادت الإرسال
    const { error: dup } = await db.from('wa_processed').insert({ id: msg.id });
    if (dup) return res.status(200).json({ ok: true, duplicate: true });

    const phoneNumberId = value.metadata?.phone_number_id;
    const c = await getCompany('wa_phone_number_id', phoneNumberId);
    if (!c) return res.status(200).json({ ok: true, note: 'no company for this number' });

    const token = c.wa_token || process.env.WA_TOKEN;
    const from = msg.from;

    let text = '';
    if (msg.type === 'text') text = msg.text?.body;
    else if (msg.type === 'button') text = msg.button?.text;
    else if (msg.type === 'interactive') text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title;

    if (!text) {
      await sendWhatsApp(phoneNumberId, token, from, 'حياك! حاليًا أقدر أقرأ الرسائل النصية فقط، اكتب لي طلبك لو سمحت 🙏');
      return res.status(200).json({ ok: true });
    }

    const out = await runAgent(c, { channel: 'whatsapp', userKey: from, phone: from }, text);
    if (out.reply) await sendWhatsApp(phoneNumberId, token, from, out.reply);
  } catch (e) {
    console.error(e);
  }
  res.status(200).json({ ok: true });
}
