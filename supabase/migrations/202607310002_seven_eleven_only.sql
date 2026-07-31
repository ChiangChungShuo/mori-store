update public.settings
set value = '{"text":"為 0–12 歲孩子挑選親膚、耐穿、自在活動的日常服，支援 7-ELEVEN 取貨。"}'::jsonb
where key = 'site_description'
  and value ->> 'text' ilike '%全家%';
