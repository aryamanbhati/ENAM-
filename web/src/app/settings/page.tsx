import { Masthead } from "@/components/Masthead";
import { TriggerSettings } from "@/components/TriggerSettings";
import { triggers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const t = await triggers();
  return (
    <>
      <Masthead title="Alerts" back={{ href: "/", label: "Today" }} />
      <TriggerSettings initial={t} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
    </>
  );
}
