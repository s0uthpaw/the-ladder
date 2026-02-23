import { redirect } from "next/navigation";
import { getDraftRoomData } from "@/lib/actions/draft";
import { DraftRoom } from "./draft-room";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const data = await getDraftRoomData(leagueId);

  if (!data || data.draft.status === "pre_draft") {
    redirect(`/dashboard/${leagueId}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <DraftRoom {...(data as any)} sport={data.sport ?? "nfl"} />;
}
