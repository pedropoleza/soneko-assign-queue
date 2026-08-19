-- IG Opportunities — retenção do log de execuções.
-- Mantém 30 dias de igopps.runs; a tabela igopps.created NÃO é tocada (é o
-- registro permanente de dedup "uma vez por seguidor, para sempre").

select cron.unschedule('igopps-retention')
 where exists (select 1 from cron.job where jobname = 'igopps-retention');

-- Diariamente às 03:20 UTC.
select cron.schedule(
  'igopps-retention',
  '20 3 * * *',
  $CRON$
    delete from igopps.runs where started_at < now() - interval '30 days';
  $CRON$
);
