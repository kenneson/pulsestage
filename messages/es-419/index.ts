// Um arquivo JSON por área do app. Áreas novas entram aqui, nos outros idiomas e em src/i18n/namespaces.ts.

import type { Messages } from "../pt-BR";
import common from "./common.json";
import errors from "./errors.json";
import domain from "./domain.json";
import landing from "./landing.json";
import legal from "./legal.json";
import auth from "./auth.json";
import dashboard from "./dashboard.json";
import session from "./session.json";
import builder from "./builder.json";
import live from "./live.json";
import display from "./display.json";
import participant from "./participant.json";
import results from "./results.json";
import analytics from "./analytics.json";
import surveys from "./surveys.json";
import account from "./account.json";
import profile from "./profile.json";
import integrations from "./integrations.json";
import guide from "./guide.json";
import email from "./email.json";
import templates from "./templates.json";

// `satisfies` faz o tsc acusar qualquer chave que falte em relação ao português.
const messages = { common, errors, domain, landing, legal, auth, dashboard, session, builder, live, display, participant, results, analytics, surveys, account, profile, integrations, guide, email, templates } satisfies Messages;

export default messages;
