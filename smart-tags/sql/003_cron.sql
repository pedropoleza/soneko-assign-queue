-- Smart Tags — admin secret + reconciliador agendado.
--
-- Este arquivo NÃO contém o secret real. Gere um e grave assim (uma vez):
--
--   insert into smarttags.app_config (key, value)
--   values ('admin_secret', encode(extensions.gen_random_bytes(24), 'hex'))
--   on conflict (key) do nothing;
--
--   select value from smarttags.app_config where key = 'admin_secret';

-- O cron lê o secret do banco, então nada sensível fica no comando agendado.
select cron.unschedule('smarttags-sync')
 where exists (select 1 from cron.job where jobname = 'smarttags-sync');

select cron.schedule(
  'smarttags-sync',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/smart-tags-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-smarttags-admin', (select value from smarttags.app_config where key = 'admin_secret')
      ),
      body := jsonb_build_object('trigger', 'cron'),
      timeout_milliseconds := 120000
    );
  $$
);
