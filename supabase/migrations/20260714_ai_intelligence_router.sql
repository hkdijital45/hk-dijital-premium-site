-- HK Intelligence Router uses server environment variables for provider secrets.
-- Legacy plaintext provider secrets were never consumed by the runtime adapters.
delete from public.agent_provider_secrets;

comment on table public.agent_provider_secrets is
  'Deprecated secret input store. HK Intelligence Router reads provider credentials only from server environment variables.';

revoke all on table public.agent_provider_secrets from anon, authenticated;

notify pgrst, 'reload schema';
