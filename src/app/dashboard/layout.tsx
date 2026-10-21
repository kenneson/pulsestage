import { getSpeakerProfile } from "@/lib/data/profile";
import { countUnreadContacts } from "@/lib/data/speaker-profile";
import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/dashboard/nav-links";
import { LiveRoomFrame } from "@/components/live/live-room-frame";
import { MotionProvider } from "@/components/motion/motion-provider";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSpeakerProfile();
  const unreadInvites = await countUnreadContacts(await createClient());

  // A barra lateral vai sempre: a moldura a esconde na sala ao vivo (decidido no navegador, pelo caminho).
  // Motion no painel: sala ao vivo (resultados, ranking, seletor do telão) e prévia das perguntas.
  return (
    <MotionProvider>
      <LiveRoomFrame
        sidebar={<DashboardSidebar name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} unreadInvites={unreadInvites} />}
      >
        {children}
      </LiveRoomFrame>
    </MotionProvider>
  );
}
