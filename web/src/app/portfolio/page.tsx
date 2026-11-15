import { AskScopeSetter } from "@/components/Ask";
import { Masthead } from "@/components/Masthead";
import { PortfolioView } from "@/components/PortfolioView";
import { holdings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Portfolio() {
  const rows = await holdings();
  const dayMove = rows.reduce((acc, r) => acc + (r.move ?? 0) * (r.weight / 100), 0);
  return (
    <>
      <AskScopeSetter scope={{ screen: "portfolio" }} />
      <Masthead title="Portfolio" sub={`${rows.length} holdings · latest market close`} brand />
      <PortfolioView rows={rows} dayMove={dayMove} />
    </>
  );
}
