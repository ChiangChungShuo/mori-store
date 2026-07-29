insert into public.store_settings (key, value)
values
  ('site_title', '{"text":"mori 童裝商城｜0–12 歲孩子的日常選衣"}'::jsonb),
  ('site_description', '{"text":"為 0–12 歲孩子挑選親膚、耐穿、自在活動的日常服，支援 7-ELEVEN 與全家取貨。"}'::jsonb),
  ('site_keywords', '{"items":["童裝","兒童服飾","親膚童裝","0–12 歲穿搭","超商取貨"]}'::jsonb),
  ('google_analytics_id', '{"id":null}'::jsonb)
on conflict (key) do nothing;
