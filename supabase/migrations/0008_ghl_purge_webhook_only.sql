-- Switch to a pure event-driven (webhook) model: remove the pg_cron polling job.
-- The function is now driven solely by a GHL "Contact Created" webhook, so there
-- is no recurring scan, no list traffic, and no log pollution.

select cron.unschedule('ghl-purge-scan')
where exists (select 1 from cron.job where jobname = 'ghl-purge-scan');

-- The polling-era dedup guard is no longer used by the function (each Contact
-- Created webhook fires once per contact). Left in place; harmless if present.
