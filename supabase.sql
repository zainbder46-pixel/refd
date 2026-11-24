-- شغّل هذا الملف كاملًا في Supabase > SQL Editor

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text default '#0f766e',
  greeting text default 'هلا والله! كيف أقدر أخدمك اليوم؟',
  knowledge text default '',            -- الخدمات، الأسعار، الأسئلة الشائعة، العنوان...
  hours text default '',                -- أوقات العمل والمواعيد المتاحة
  booking_rules text default '',        -- مدة الموعد، أنواعه، شروطه
  qualify_questions text default '',    -- أسئلة تأهيل العميل
  internal_knowledge text default '',   -- سياسات وملفات داخلية للموظفين
  internal_code text default '',        -- رمز دخول المساعد الداخلي
  wa_phone_number_id text unique,       -- Phone number ID من واتساب
  wa_token text,                        -- اختياري: توكن خاص بالشركة
  plan text default 'trial',            -- trial | paid
  trial_ends_at timestamptz default (now() + interval '14 days'),
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  company_id uuid references companies(id) on delete cascade,
  channel text not null,        -- web | whatsapp | internal
  user_key text not null,
  role text not null,           -- user | model
  content text not null,
  created_at timestamptz default now()
);
create index if not exists messages_conv_idx on messages(company_id, channel, user_key, created_at desc);

create table if not exists leads (
  id bigint generated always as identity primary key,
  company_id uuid references companies(id) on delete cascade,
  channel text, user_key text,
  name text, phone text, need text, budget text, timeline text,
  score text,                   -- hot | warm | cold
  notes text,
  created_at timestamptz default now()
);

create table if not exists bookings (
  id bigint generated always as identity primary key,
  company_id uuid references companies(id) on delete cascade,
  channel text, user_key text,
  name text, phone text,
  date date not null, time text not null,
  purpose text,
  status text default 'pending', -- pending | confirmed | cancelled | done
  created_at timestamptz default now()
);

create table if not exists handoffs (
  id bigint generated always as identity primary key,
  company_id uuid references companies(id) on delete cascade,
  channel text, user_key text,
  name text, phone text, reason text,
  status text default 'open',   -- open | closed
  created_at timestamptz default now()
);

create table if not exists wa_processed (
  id text primary key,
  created_at timestamptz default now()
);

-- القفل: لا أحد يقرأ الجداول من المتصفح، فقط السيرفر بمفتاح service role
alter table companies enable row level security;
alter table messages enable row level security;
alter table leads enable row level security;
alter table bookings enable row level security;
alter table handoffs enable row level security;
alter table wa_processed enable row level security;

-- شركة تجريبية للعرض
insert into companies (slug, name, color, greeting, knowledge, hours, booking_rules, qualify_questions, internal_knowledge, internal_code, plan, trial_ends_at)
values (
  'demo',
  'شركة تجريبية للعقارات',
  '#0f766e',
  'هلا والله! معك المساعد الذكي لشركة تجريبية للعقارات 👋 تبي تستفسر عن عقار، أو تحجز معاينة؟',
  'نبيع ونؤجر شقق وفلل في شمال جدة (أبحر، الشراع، الياقوت).
شقق 3 غرف تبدأ من 650 ألف ريال، فلل تبدأ من 1.8 مليون.
إيجار الشقق السنوي يبدأ من 45 ألف.
نوفر تمويل عقاري بالتعاون مع البنوك.
العنوان: جدة، طريق الملك عبدالعزيز.',
  'من الأحد إلى الخميس، 9 صباحًا إلى 9 مساءً. السبت 4 العصر إلى 9 مساءً. الجمعة إجازة.',
  'المعاينة مدتها ساعة. تبدأ على رأس الساعة. لازم الاسم ورقم الجوال.',
  'هل الطلب شراء أو إيجار؟ نوع العقار؟ الحي المفضل؟ الميزانية؟ متى ناوي تنتقل؟ تحتاج تمويل؟',
  'سياسة الإجازات: 30 يوم سنويًا. العمولة: 2.5% من قيمة البيع. طلبات الصيانة ترفع لمشرف العقار خلال 24 ساعة.',
  '1234',
  'trial',
  now() + interval '14 days'
) on conflict (slug) do nothing;
