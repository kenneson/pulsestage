# E-mails de login (Supabase Auth) em três idiomas

O Supabase manda um e-mail por template, sem escolher idioma sozinho. Estes templates usam o
`user_metadata.locale` gravado no cadastro (`features/auth/actions.ts`) para escrever em português, espanhol
ou inglês. `printf "%v"` evita erro de comparação em contas antigas, que não têm `locale` (essas recebem em português).

Como aplicar em produção: **Supabase → Authentication → Emails**, cole o HTML de cada arquivo no template
correspondente e use o assunto indicado.

| Arquivo | Template no Supabase | Assunto |
|---|---|---|
| `confirmation.html` | Confirm signup | Confirme seu e-mail · Confirma tu correo · Confirm your email — PulseStage |
| `recovery.html` | Reset password | Redefinir senha · Restablecer contraseña · Reset your password — PulseStage |
| `email_change.html` | Change email address | Confirme o novo e-mail · Confirma el nuevo correo · Confirm your new email — PulseStage |

Localmente (no `supabase/config.toml` criado por `supabase init`), aponte `[auth.email.template.confirmation]` para `./supabase/templates/confirmation.html`.
