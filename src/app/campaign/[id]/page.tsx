import type { Metadata } from "next";
import { CampaignView } from "@/components/CampaignView";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = /^\d{1,6}$/.test(id) ? Number(id) : -1;
  return <CampaignView id={parsed} />;
}
