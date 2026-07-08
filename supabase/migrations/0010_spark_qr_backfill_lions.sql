-- One-time backfill: the QR codes that existed before multi-location was added
-- belong to the Lions account. They were created with location_id = '' (the
-- default main panel); move them to Lions so they show up under that account's
-- menu link and stop appearing in every location.
--
-- Scoped to the two known slugs so re-running can never sweep a legitimately
-- main-panel QR into Lions.

update qr.qr_codes
set location_id = 'jIqId5fQTEscL0KB2neG'
where location_id = ''
  and slug in ('f4gyu2', 't9ifvc');
