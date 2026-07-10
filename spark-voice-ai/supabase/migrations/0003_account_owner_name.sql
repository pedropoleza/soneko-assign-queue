-- Nome do usuário GHL que instalou/opera a conta (titular padrão da voz).
-- Preenchido no callback do OAuth via GHL API (/users/{userId}).
alter table spark.accounts add column if not exists owner_name text;
