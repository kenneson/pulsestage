-- =============================================================================
-- Idiomas: português (pt-BR), espanhol latino neutro (es-419) e inglês americano (en-US).
-- - profiles.locale: idioma do painel e padrão das sessões novas (vem do cadastro).
-- - sessions.locale: idioma do telão, do celular da plateia, do filtro de palavrões, da nuvem e da IA.
-- - survey_templates.locale: modelos da plataforma em cada idioma (mesmo slug).
-- Regras puras em lib/domain/locale.ts.
-- =============================================================================

alter table public.profiles
  add column locale text not null default 'pt-BR' check (locale in ('pt-BR', 'es-419', 'en-US'));

alter table public.sessions
  add column locale text not null default 'pt-BR' check (locale in ('pt-BR', 'es-419', 'en-US'));

-- Cadastro: nome e foto do provedor, o idioma em que a pessoa se cadastrou e o fuso do navegador
-- (um palestrante em Santiago não deve ter os horários interpretados no fuso de São Paulo).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
  v_tz text := new.raw_user_meta_data ->> 'time_zone';
begin
  insert into public.profiles (id, name, avatar_url, locale, time_zone)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), ''),
    case when v_locale in ('pt-BR', 'es-419', 'en-US') then v_locale else 'pt-BR' end,
    case
      when char_length(v_tz) between 1 and 64 and exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz)
        then v_tz
      else 'America/Sao_Paulo'
    end
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Modelos de pesquisa por idioma
-- -----------------------------------------------------------------------------
alter table public.survey_templates
  add column locale text not null default 'pt-BR' check (locale in ('pt-BR', 'es-419', 'en-US'));

alter table public.survey_templates drop constraint survey_templates_slug_key;
alter table public.survey_templates add constraint survey_templates_slug_locale_key unique (slug, locale);

-- Sem modelo válido, a sessão usa o "geral" no idioma dela (ou o português).
create or replace function public.take_survey_snapshot(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template uuid;
begin
  if exists (select 1 from public.session_surveys where session_id = p_session_id) then
    return;
  end if;

  select t.id into v_template
    from public.sessions s
    join public.survey_templates t on t.id = s.survey_template_id
   where s.id = p_session_id
     and (t.owner_id is null or t.owner_id = s.speaker_id);

  if v_template is null then
    select t.id into v_template
      from public.survey_templates t
      left join public.sessions s on s.id = p_session_id
     where t.slug = 'geral'
     order by (t.locale = s.locale) desc, (t.locale = 'pt-BR') desc
     limit 1;
  end if;
  if v_template is null then
    return;
  end if;

  insert into public.session_surveys (session_id, template_id, name)
  select p_session_id, t.id, t.name from public.survey_templates t where t.id = v_template;

  insert into public.session_survey_questions (session_id, position, kind, label, dimension, required, settings)
  select p_session_id, q.position, q.kind, q.label, q.dimension, q.required, q.settings
    from public.survey_template_questions q
   where q.template_id = v_template;
end;
$$;

-- O formulário antigo era em português.
create or replace function public.convert_legacy_feedback()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_geral uuid;
begin
  select id into v_geral from public.survey_templates where slug = 'geral' and locale = 'pt-BR';

  update public.sessions s
     set survey_template_id = v_geral
   where s.survey_template_id is null
     and exists (select 1 from public.feedback f where f.session_id = s.id);

  perform public.take_survey_snapshot(x.session_id)
     from (select distinct session_id from public.feedback) x;

  insert into public.survey_responses (id, session_id, participant_id, created_at)
  select f.id, f.session_id, f.participant_id, f.created_at
    from public.feedback f
    join public.session_surveys ss on ss.session_id = f.session_id and ss.template_id = v_geral
  on conflict (id) do nothing;

  insert into public.survey_answers (response_id, question_id, value_int, value_text)
  select f.id, q.id, v.vi, nullif(btrim(v.vt), '')
    from public.feedback f
    join public.session_surveys ss on ss.session_id = f.session_id and ss.template_id = v_geral
    join public.session_survey_questions q on q.session_id = f.session_id
    cross join lateral (values
      (1, f.overall_rating, null::text),
      (2, f.clarity_rating, null),
      (3, f.engagement_rating, null),
      (4, f.content_rating, null),
      (5, f.applicability_rating, null),
      (6, null, f.most_valuable_part),
      (7, null, f.improvement),
      (8, null, f.comment)
    ) as v(pos, vi, vt)
   where q.position = v.pos
     and (v.vi is not null or nullif(btrim(v.vt), '') is not null)
  on conflict do nothing;
end;
$$;

revoke execute on function public.convert_legacy_feedback() from public, anon, authenticated;
revoke execute on function public.take_survey_snapshot(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Modelos da plataforma em espanhol e inglês (mesmas dimensões e tipos dos em português)
-- -----------------------------------------------------------------------------
do $$
declare
  t uuid;
begin
  -- ---------------------------------------------------------------- es-419
  insert into public.survey_templates (slug, locale, name, description)
  values ('geral', 'es-419', 'Evaluación general', 'El formulario clásico: utilidad, cuatro dimensiones y comentarios.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',   'Del 0 al 10, ¿qué tan útil fue esta sesión para ti?', 'utilidade', true, '{"minLabel":"Nada útil","maxLabel":"Extremadamente útil"}'),
    (t, 2, 'scale', 'Claridad de la presentación', 'clareza', false, '{"minLabel":"Muy mala","maxLabel":"Excelente"}'),
    (t, 3, 'scale', 'Capacidad de mantener tu atención', 'atencao', false, '{"minLabel":"Muy mala","maxLabel":"Excelente"}'),
    (t, 4, 'scale', 'Calidad del contenido', 'conteudo', false, '{"minLabel":"Muy mala","maxLabel":"Excelente"}'),
    (t, 5, 'scale', 'Qué tanto puedes aplicar lo que viste', 'aplicabilidade', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 6, 'text',  '¿Qué fue lo más valioso?', null, false, '{}'),
    (t, 7, 'text',  '¿Qué se podría mejorar?', null, false, '{}'),
    (t, 8, 'text',  'Comentario libre', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('satisfacao', 'es-419', 'Satisfacción y NPS', 'Corta y directa: recomendación, satisfacción, expectativas y qué cambiar.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',    'Del 0 al 10, ¿qué tan probable es que recomiendes esta sesión a un colega?', 'recomendacao', true, '{"minLabel":"No la recomendaría","maxLabel":"Sin duda"}'),
    (t, 2, 'scale',  'En general, ¿qué tan satisfecho estás con la sesión?', 'satisfacao', false, '{"minLabel":"Muy insatisfecho","maxLabel":"Muy satisfecho"}'),
    (t, 3, 'choice', '¿La sesión cumplió tus expectativas?', null, false, '{"options":["Quedó por debajo","Las cumplió","Las superó"]}'),
    (t, 4, 'text',   '¿Qué fue lo que más te gustó?', null, false, '{}'),
    (t, 5, 'text',   '¿Qué debería cambiar?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('atencao', 'es-419', 'Atención y participación', 'Descubre dónde el público se mantuvo involucrado y dónde se distrajo.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  '¿Qué tanto lograste mantener la atención durante la sesión?', 'atencao', true, '{"minLabel":"Casi nada","maxLabel":"Todo el tiempo"}'),
    (t, 2, 'choice', '¿En qué momento te distrajiste más?', null, false, '{"options":["Al inicio","A la mitad","Al final","No me distraje"]}'),
    (t, 3, 'choice', 'El ritmo de la presentación fue:', null, false, '{"options":["Demasiado lento","Adecuado","Demasiado rápido"]}'),
    (t, 4, 'scale',  '¿Las actividades interactivas te ayudaron a involucrarte?', 'engajamento', false, '{"minLabel":"Nada","maxLabel":"Mucho"}'),
    (t, 5, 'scale',  '¿El contenido mantuvo tu interés?', 'conteudo', false, '{"minLabel":"Nada","maxLabel":"Mucho"}'),
    (t, 6, 'text',   'Si perdiste la atención, ¿qué lo causó?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('didatica', 'es-419', 'Didáctica (clases)', 'Para docentes: claridad de la explicación, ejemplos, comprensión y dudas.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  '¿La explicación fue clara?', 'clareza', true, '{"minLabel":"Nada clara","maxLabel":"Muy clara"}'),
    (t, 2, 'scale',  '¿Los ejemplos te ayudaron a entender el contenido?', 'didatica', false, '{"minLabel":"Nada","maxLabel":"Mucho"}'),
    (t, 3, 'choice', '¿Cuánto del contenido entendiste?', null, false, '{"options":["Casi nada","Una parte","La mayor parte","Todo"]}'),
    (t, 4, 'choice', 'El ritmo de la clase fue:', null, false, '{"options":["Demasiado lento","Adecuado","Demasiado rápido"]}'),
    (t, 5, 'scale',  '¿Te sentiste con confianza para hacer preguntas?', 'didatica', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 6, 'text',   '¿Qué duda te quedó después de la clase?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('treinamento', 'es-419', 'Capacitación corporativa', 'Evaluación de reacción: relevancia, aplicación en el trabajo y conducción.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  '¿El contenido es relevante para tu trabajo?', 'relevancia', true, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 2, 'scale',  '¿Vas a poder aplicar lo que aprendiste en el día a día?', 'aplicabilidade', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 3, 'scale',  '¿El instructor demostró dominio del tema?', 'dominio', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 4, 'scale',  '¿La capacitación estuvo bien organizada?', 'organizacao', false, '{"minLabel":"Nada","maxLabel":"Totalmente"}'),
    (t, 5, 'choice', 'La duración fue:', null, false, '{"options":["Demasiado corta","Adecuada","Demasiado larga"]}'),
    (t, 6, 'nps',    'Del 0 al 10, ¿qué tan probable es que recomiendes esta capacitación a un colega?', 'recomendacao', false, '{"minLabel":"No la recomendaría","maxLabel":"Sin duda"}'),
    (t, 7, 'text',   '¿Qué vas a aplicar primero?', null, false, '{}'),
    (t, 8, 'text',   '¿Qué podría ser mejor?', null, false, '{}');

  -- ---------------------------------------------------------------- en-US
  insert into public.survey_templates (slug, locale, name, description)
  values ('geral', 'en-US', 'General feedback', 'The classic form: usefulness, four dimensions, and comments.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',   'On a scale of 0 to 10, how useful was this session for you?', 'utilidade', true, '{"minLabel":"Not useful at all","maxLabel":"Extremely useful"}'),
    (t, 2, 'scale', 'Clarity of the presentation', 'clareza', false, '{"minLabel":"Very poor","maxLabel":"Excellent"}'),
    (t, 3, 'scale', 'Ability to hold your attention', 'atencao', false, '{"minLabel":"Very poor","maxLabel":"Excellent"}'),
    (t, 4, 'scale', 'Quality of the content', 'conteudo', false, '{"minLabel":"Very poor","maxLabel":"Excellent"}'),
    (t, 5, 'scale', 'How much you can apply what you saw', 'aplicabilidade', false, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 6, 'text',  'What was most valuable?', null, false, '{}'),
    (t, 7, 'text',  'What could be improved?', null, false, '{}'),
    (t, 8, 'text',  'Additional comments', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('satisfacao', 'en-US', 'Satisfaction and NPS', 'Short and to the point: recommendation, satisfaction, expectations, and what to change.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'nps',    'On a scale of 0 to 10, how likely are you to recommend this session to a colleague?', 'recomendacao', true, '{"minLabel":"Not likely","maxLabel":"Definitely"}'),
    (t, 2, 'scale',  'Overall, how satisfied are you with the session?', 'satisfacao', false, '{"minLabel":"Very dissatisfied","maxLabel":"Very satisfied"}'),
    (t, 3, 'choice', 'Did the session meet your expectations?', null, false, '{"options":["Fell short","Met them","Exceeded them"]}'),
    (t, 4, 'text',   'What did you like most?', null, false, '{}'),
    (t, 5, 'text',   'What should change?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('atencao', 'en-US', 'Attention and engagement', 'Find out where the audience stayed engaged and where it drifted.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'How well were you able to stay focused during the session?', 'atencao', true, '{"minLabel":"Barely","maxLabel":"The whole time"}'),
    (t, 2, 'choice', 'When did your attention drift the most?', null, false, '{"options":["At the beginning","In the middle","At the end","It didn''t drift"]}'),
    (t, 3, 'choice', 'The pace of the presentation was:', null, false, '{"options":["Too slow","Just right","Too fast"]}'),
    (t, 4, 'scale',  'Did the interactive activities help you get involved?', 'engajamento', false, '{"minLabel":"Not at all","maxLabel":"A lot"}'),
    (t, 5, 'scale',  'Did the content hold your interest?', 'conteudo', false, '{"minLabel":"Not at all","maxLabel":"A lot"}'),
    (t, 6, 'text',   'If you lost focus, what caused it?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('didatica', 'en-US', 'Teaching (classes)', 'For teachers: clarity of explanation, examples, understanding, and questions.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'Was the explanation clear?', 'clareza', true, '{"minLabel":"Not clear at all","maxLabel":"Very clear"}'),
    (t, 2, 'scale',  'Did the examples help you understand the content?', 'didatica', false, '{"minLabel":"Not at all","maxLabel":"A lot"}'),
    (t, 3, 'choice', 'How much of the content did you understand?', null, false, '{"options":["Almost nothing","Some of it","Most of it","All of it"]}'),
    (t, 4, 'choice', 'The pace of the class was:', null, false, '{"options":["Too slow","Just right","Too fast"]}'),
    (t, 5, 'scale',  'Did you feel comfortable asking questions?', 'didatica', false, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 6, 'text',   'What question do you still have after the class?', null, false, '{}');

  insert into public.survey_templates (slug, locale, name, description)
  values ('treinamento', 'en-US', 'Corporate training', 'Reaction evaluation: relevance, on-the-job application, and delivery.')
  returning id into t;
  insert into public.survey_template_questions (template_id, position, kind, label, dimension, required, settings) values
    (t, 1, 'scale',  'Is the content relevant to your work?', 'relevancia', true, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 2, 'scale',  'Will you be able to apply what you learned day to day?', 'aplicabilidade', false, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 3, 'scale',  'Did the instructor demonstrate command of the subject?', 'dominio', false, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 4, 'scale',  'Was the training well organized?', 'organizacao', false, '{"minLabel":"Not at all","maxLabel":"Completely"}'),
    (t, 5, 'choice', 'The length of the training was:', null, false, '{"options":["Too short","Just right","Too long"]}'),
    (t, 6, 'nps',    'On a scale of 0 to 10, how likely are you to recommend this training to a colleague?', 'recomendacao', false, '{"minLabel":"Not likely","maxLabel":"Definitely"}'),
    (t, 7, 'text',   'What will you apply first?', null, false, '{}'),
    (t, 8, 'text',   'What could be better?', null, false, '{}');
end;
$$;
