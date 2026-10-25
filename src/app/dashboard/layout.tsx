import { getSpeakerProfile } from "@/lib/data/profile";
import { countUnreadContacts } from "@/lib/data/speaker-profile";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard/nav-links";
import { MobileTabBar, MobileTopBar } from "@/components/dashboard/mobile-nav";
import { LiveRoomFrame } from "@/components/live/live-room-frame";
import { MotionProvider } from "@/components/motion/motion-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSpeakerProfile();
  const unreadInvites = await countUnreadContacts(await createClient());

  // A barra lateral vai sempre: a moldura a esconde na sala ao vivo (decidido no navegador, pelo caminho).
  // Motion no painel: sala ao vivo (resultados, ranking, seletor do telão) e prévia das perguntas.
  const nav = { name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl, unreadInvites };
  // Barra lateral no computador; no celular, barra superior e abas embaixo (mobile-nav.tsx).
  return (
    <MotionProvider>
      <LiveRoomFrame
        sidebar={<DashboardSidebar {...nav} />}
        mobileHeader={<MobileTopBar {...nav} />}
        mobileTabBar={<MobileTabBar {...nav} />}
      >
        {children}
      </LiveRoomFrame>
    </MotionProvider>
  );
}
