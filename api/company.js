import { cors } from '../lib/db.js';
import { getCompany, companyStatus } from '../lib/agent.js';

// إعدادات عامة للويدجت فقط (بدون أي بيانات داخلية)
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const c = await getCompany('slug', String(req.query.slug || ''));
  if (!c) return res.status(404).json({ error: 'not found' });
  res.setHeader('Cache-Control', 's-maxage=60');
  res.status(200).json({
    name: c.name,
    color: c.color,
    greeting: c.greeting,
    status: companyStatus(c)
  });
}
