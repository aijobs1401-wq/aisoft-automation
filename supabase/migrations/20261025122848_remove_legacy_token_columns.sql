-- Access tokens must only exist in the encrypted, locked-down secret table.
alter table public.whatsapp_connections
  drop column if exists token_ciphertext,
  drop column if exists token_key_version;
