import { db, cors } from '../lib/db.js';

const EDITABLE = ['slug', 'name', 'color', 'greeting', 'knowledge', 'hours', 'booking_rules', 'qualify_questions',
  'internal_knowledge', 'internal_code', 'wa_phone_number_id', 'wa_token', 'plan', 'trial_ends_at', 'active'];

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.ADMIN_PASSWORD || req.headers['x-admin-key'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }

  if (req.method === 'GET') {
    const slug = req.query.company;
    if (!slug) {
      const { data } = await db.from('companies').select('slug, name, plan, trial_ends_at, active').order('created_at');
      return res.status(200).json({ companies: data || [] });
    }
    const { data: c } = await db.from('companies').select('*').eq('slug', slug).maybeSingle();
    if (!c) return res.status(404).json({ error: 'غير موجودة' });
    const [leads, bookings, handoffs, messages] = await Promise.all([
      db.from('leads').select('*').eq('company_id', c.id).order('created_at', { ascending: false }).limit(200),
      db.from('bookings').select('*').eq('company_id', c.id).order('date', { ascending: false }).limit(200),
      db.from('handoffs').select('*').eq('company_id', c.id).order('created_at', { ascending: false }).limit(200),
      db.from('messages').select('channel, user_key, role, content, created_at').eq('company_id', c.id)
        .order('created_at', { ascending: false }).limit(400)
    ]);
    return res.status(200).json({
      company: c,
      leads: leads.data || [], bookings: bookings.data || [],
      handoffs: handoffs.data || [], messages: messages.data || []
    });
  }

  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'save_company') {
      const input = req.body.company || {};
      const row = {};
      for (const k of EDITABLE) if (k in input) row[k] = input[k] === '' ? null : input[k];
      if (!row.slug || !row.name) return res.status(400).json({ error: 'المعرّف والاسم مطلوبة' });
      row.slug = String(row.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const { data, error } = await db.from('companies').upsert(row, { onConflict: 'slug' }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ company: data });
    }

    if (action === 'set_status') {
      const { table, id, status } = req.body;
      if (!['bookings', 'handoffs'].includes(table)) return res.status(400).json({ error: 'جدول غير مسموح' });
      const { error } = await db.from(table).update({ status }).eq('id', id);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  res.status(400).json({ error: 'طلب غير معروف' });
}
