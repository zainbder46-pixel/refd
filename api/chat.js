import { cors } from '../lib/db.js';
import { getCompany, runAgent } from '../lib/agent.js';

// POST { company, userKey, text, mode?: 'internal', code? }
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { company, userKey, text, mode, code } = req.body || {};
  if (!company || !userKey || !text) return res.status(400).json({ error: 'company, userKey, text مطلوبة' });

  const c = await getCompany('slug', String(company));
  if (!c) return res.status(404).json({ error: 'الشركة غير موجودة' });

  let channel = 'web';
  if (mode === 'internal') {
    if (!c.internal_code || code !== c.internal_code) return res.status(401).json({ error: 'رمز الدخول غير صحيح' });
    channel = 'internal';
  }

  const out = await runAgent(c, { channel, userKey: String(userKey).slice(0, 80) }, text);
  res.status(200).json({ reply: out.reply });
}
