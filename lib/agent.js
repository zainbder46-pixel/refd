import { db } from './db.js';

const MODEL = () => process.env.GEMINI_MODEL || 'gemini-flash-latest';
const HISTORY_LIMIT = 20;

export async function getCompany(field, value) {
  const { data } = await db.from('companies').select('*').eq(field, value).maybeSingle();
  return data;
}

export function companyStatus(c) {
  if (!c || !c.active) return 'inactive';
  if (c.plan === 'trial' && c.trial_ends_at && new Date(c.trial_ends_at) < new Date()) return 'expired';
  return 'ok';
}

function riyadhNow() {
  const d = new Date();
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long' });
  return `${day} ${date} الساعة ${time} (توقيت السعودية)`;
}

function customerPrompt(c, ctx) {
  return `أنت المساعد الذكي الرسمي لـ «${c.name}». تتكلم باللهجة السعودية البيضاء، بأسلوب محترم وودود ومختصر.
الوقت الحالي: ${riyadhNow()}.
القناة: ${ctx.channel === 'whatsapp' ? 'واتساب' : 'موقع الشركة'}.${ctx.phone ? `\nرقم جوال العميل معروف: ${ctx.phone} (لا تسأله عنه).` : ''}

مهامك:
1) خدمة العملاء: جاوب على الأسئلة من «معلومات الشركة» تحت فقط. إذا ما لقيت الجواب لا تخترع أبدًا، قل إنك بتحوّله لموظف واستخدم handoff_to_human.
2) تأهيل العملاء: إذا العميل مهتم بخدمة، اسأله أسئلة التأهيل بشكل طبيعي (سؤال أو سؤالين بالرسالة، مو كلها مرة وحدة). أول ما تعرف احتياجه واسمه ورقمه، استخدم save_lead وقيّمه: hot (جاهز وميزانيته واضحة وقريب)، warm (مهتم بس مو مستعجل)، cold (يستكشف).
3) حجز المواعيد: إذا طلب موعد، تأكد من الاسم والجوال والتاريخ والوقت حسب أوقات العمل، ثم استخدم book_appointment. حوّل الكلام مثل «بكرة» و«الأحد الجاي» لتاريخ فعلي. إذا الموعد محجوز اقترح أقرب وقت بعده.
4) التحويل لموظف: إذا العميل طلب إنسان، أو زعلان، أو عنده شكوى، أو سؤال خارج معلوماتك، استخدم handoff_to_human.

قواعد:
- رسائلك قصيرة (سطرين لأربعة) ومناسبة للجوال. بدون جداول أو تنسيق ثقيل.
- لا تعطي أسعار أو وعود غير مكتوبة في معلومات الشركة.
- لا تذكر إنك نموذج ذكاء اصطناعي من شركة معيّنة، أنت «المساعد الذكي لـ ${c.name}».
- إذا كتب العميل بالإنجليزي رد بالإنجليزي.

=== معلومات الشركة ===
${c.knowledge || '—'}

=== أوقات العمل ===
${c.hours || '—'}

=== قواعد الحجز ===
${c.booking_rules || 'الموعد ساعة، يحتاج اسم ورقم جوال.'}

=== أسئلة التأهيل ===
${c.qualify_questions || 'وش الخدمة المطلوبة؟ الميزانية؟ متى تحتاجها؟'}`;
}

function internalPrompt(c) {
  return `أنت المساعد الداخلي لموظفي «${c.name}». تجاوب الموظفين باللهجة السعودية وبشكل مباشر ودقيق، من «المعرفة الداخلية» و«معلومات الشركة» تحت فقط.
إذا ما لقيت الجواب قل بوضوح إنه غير موجود في ملفات الشركة واقترح يراجع المدير. لا تخترع.
الوقت الحالي: ${riyadhNow()}.

=== المعرفة الداخلية ===
${c.internal_knowledge || '—'}

=== معلومات الشركة ===
${c.knowledge || '—'}`;
}

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'save_lead',
      description: 'حفظ عميل محتمل بعد معرفة احتياجه، مع تقييم جديته',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          phone: { type: 'STRING' },
          need: { type: 'STRING', description: 'وش يبي العميل بالضبط' },
          budget: { type: 'STRING' },
          timeline: { type: 'STRING', description: 'متى يحتاج الخدمة' },
          score: { type: 'STRING', enum: ['hot', 'warm', 'cold'] },
          notes: { type: 'STRING' }
        },
        required: ['need', 'score']
      }
    },
    {
      name: 'book_appointment',
      description: 'حجز موعد للعميل. التاريخ بصيغة YYYY-MM-DD والوقت HH:MM بنظام 24 ساعة',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          phone: { type: 'STRING' },
          date: { type: 'STRING' },
          time: { type: 'STRING' },
          purpose: { type: 'STRING' }
        },
        required: ['name', 'phone', 'date', 'time']
      }
    },
    {
      name: 'handoff_to_human',
      description: 'تحويل المحادثة لموظف بشري',
      parameters: {
        type: 'OBJECT',
        properties: {
          reason: { type: 'STRING' },
          name: { type: 'STRING' },
          phone: { type: 'STRING' }
        },
        required: ['reason']
      }
    }
  ]
}];

async function runTool(name, args, c, ctx) {
  const base = { company_id: c.id, channel: ctx.channel, user_key: ctx.userKey };
  const phone = args.phone || ctx.phone || null;

  if (name === 'save_lead') {
    const { error } = await db.from('leads').insert({ ...base, ...args, phone });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  if (name === 'book_appointment') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || !/^\d{2}:\d{2}$/.test(args.time)) {
      return { ok: false, reason: 'صيغة التاريخ أو الوقت غير صحيحة' };
    }
    const { data: taken } = await db.from('bookings').select('id')
      .eq('company_id', c.id).eq('date', args.date).eq('time', args.time)
      .neq('status', 'cancelled').limit(1);
    if (taken && taken.length) return { ok: false, reason: 'الموعد محجوز، اقترح وقت ثاني' };
    const { error } = await db.from('bookings').insert({ ...base, ...args, phone });
    return error ? { ok: false, error: error.message } : { ok: true, message: 'تم الحجز، الفريق بيأكد مع العميل' };
  }

  if (name === 'handoff_to_human') {
    const { error } = await db.from('handoffs').insert({ ...base, ...args, phone });
    return error ? { ok: false, error: error.message } : { ok: true, message: 'تم إبلاغ الفريق' };
  }

  return { ok: false, error: 'أداة غير معروفة' };
}

async function callGemini(body) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body)
    }
  );
  if (!r.ok) {
    const err = new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * يشغّل الوكيل على رسالة وحدة ويرجع الرد
 * ctx = { channel: 'web'|'whatsapp'|'internal', userKey, phone? }
 */
export async function runAgent(c, ctx, text) {
  const status = companyStatus(c);
  if (status === 'expired') return { reply: 'شكرًا لتواصلك! المساعد الذكي متوقف مؤقتًا، وبيتواصل معك فريقنا قريب.', actions: [] };
  if (status === 'inactive') return { reply: 'الخدمة غير متاحة حاليًا.', actions: [] };

  text = String(text || '').slice(0, 2000).trim();
  if (!text) return { reply: '', actions: [] };

  const internal = ctx.channel === 'internal';

  const { data: hist } = await db.from('messages').select('role, content')
    .eq('company_id', c.id).eq('channel', ctx.channel).eq('user_key', ctx.userKey)
    .order('created_at', { ascending: false }).limit(HISTORY_LIMIT);

  const contents = (hist || []).reverse().map(m => ({ role: m.role, parts: [{ text: m.content }] }));
  // جيميني لازم يبدأ بـ user
  while (contents.length && contents[0].role !== 'user') contents.shift();
  contents.push({ role: 'user', parts: [{ text }] });

  const body = {
    systemInstruction: { parts: [{ text: internal ? internalPrompt(c) : customerPrompt(c, ctx) }] },
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
  };
  if (!internal) body.tools = TOOLS;

  const actions = [];
  let reply = '';

  try {
    for (let step = 0; step < 4; step++) {
      const out = await callGemini(body);
      const content = out?.candidates?.[0]?.content;
      const parts = content?.parts || [];
      const calls = parts.filter(p => p.functionCall);

      if (!calls.length) {
        reply = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
        break;
      }

      // نرجّع رد النموذج كما هو (يحفظ thought signatures) ثم نتائج الأدوات
      body.contents.push(content);
      const responses = [];
      for (const p of calls) {
        const { name, args = {} } = p.functionCall;
        const result = await runTool(name, args, c, ctx);
        actions.push({ name, args, result });
        responses.push({ functionResponse: { name, response: result } });
      }
      body.contents.push({ role: 'user', parts: responses });
    }
  } catch (e) {
    console.error(e);
    reply = e.status === 429
      ? 'فيه ضغط على النظام الحين، جرّب بعد دقيقة لو سمحت 🙏'
      : 'صار خلل بسيط، جرّب مرة ثانية أو انتظر يتواصل معك فريقنا.';
    return { reply, actions, error: true };
  }

  if (!reply) reply = 'تمام، وصلت. فيه شي ثاني أقدر أساعدك فيه؟';

  await db.from('messages').insert([
    { company_id: c.id, channel: ctx.channel, user_key: ctx.userKey, role: 'user', content: text },
    { company_id: c.id, channel: ctx.channel, user_key: ctx.userKey, role: 'model', content: reply }
  ]);

  return { reply, actions };
}
