-- Smart Tags — retenção dos logs.
-- Mantém 30 dias de smarttags.sync_runs e smarttags.events. As tabelas
-- smarttags.accounts e smarttags.tags (catálogo) NÃO são tocadas.

select cron.unschedule('smarttags-retention')
 where exists (select 1 from cron.job where jobname = 'smarttags-retention');

-- Diariamente às 03:30 UTC.
select cron.schedule(
  'smarttags-retention',
  '30 3 * * *',
  $CRON$
    delete from smarttags.sync_runs where started_at  < now() - interval '30 days';
    delete from smarttags.events    where received_at < now() - interval '30 days';
  $CRON$
);
