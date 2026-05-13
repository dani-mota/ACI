import Link from "next/link";
import { redirect } from "next/navigation";
import { User, Users, UserCheck, Bell, Palette, type LucideIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { canManageTeam } from "@/lib/rbac";

// PRO-190: settings hub page linking to existing and placeholder
// settings surfaces. Wired from the top-right user menu's Settings
// item. Tile visibility gates on the same role check the destination
// page enforces — users don't see links they'd 403/redirect on.
export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tiles: TileProps[] = [
    {
      href: "/profile",
      icon: User,
      label: "Account",
      desc: "Personal information and account details",
    },
    ...(canManageTeam(session.user.role)
      ? [
          {
            href: "/settings/team",
            icon: Users,
            label: "Team",
            desc: "Manage org members and roles",
          },
        ]
      : []),
    {
      href: "/settings/my-team",
      icon: UserCheck,
      label: "My team",
      desc: "People who report to you",
    },
    { href: null, icon: Bell, label: "Notifications", desc: "Coming soon" },
    { href: null, icon: Palette, label: "Appearance", desc: "Coming soon" },
  ];

  return (
    <div className="px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, team, and preferences.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  href: string | null;
  icon: LucideIcon;
  label: string;
  desc: string;
}

function Tile({ href, icon: Icon, label, desc }: TileProps) {
  // hover:bg-accent only on enabled tiles — disabled ones already have
  // opacity-50 + cursor-not-allowed; adding a hover color change would
  // be inconsistent with "this isn't clickable."
  const content = (
    <div className="flex items-start gap-3 p-4 border border-border bg-card transition-colors">
      <Icon className="w-4 h-4 mt-0.5 text-aci-blue" />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
  // Disabled placeholders render as <div> (no Link) so they're not
  // announced as actionable to screen readers.
  if (!href) {
    return <div className="opacity-50 cursor-not-allowed">{content}</div>;
  }
  return (
    <Link href={href} className="block hover:bg-accent transition-colors">
      {content}
    </Link>
  );
}
