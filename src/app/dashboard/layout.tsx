import { getSpeakerProfile } from "@/lib/data/profile";
import { DashboardSidebar } from "@/components/dashboard/nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSpeakerProfile();

  return (
    <div className="min-h-dvh bg-muted/30 md:flex print:bg-transparent">
      <DashboardSidebar name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} />
      <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-10 print:p-0">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
