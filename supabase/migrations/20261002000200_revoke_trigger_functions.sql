-- Funções de trigger não devem ser chamáveis via /rest/v1/rpc (alerta do Security Advisor).
-- O Postgres só checa EXECUTE na criação do trigger, então os triggers continuam funcionando.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_session_live_state() from public, anon, authenticated;
revoke execute on function public.sync_active_interaction() from public, anon, authenticated;
revoke execute on function public.increment_participant_count() from public, anon, authenticated;
revoke execute on function public.apply_response_to_results() from public, anon, authenticated;
-- is_session_owner continua executável: as policies públicas dependem dela e ela
-- só responde se o próprio usuário é dono da sessão.
