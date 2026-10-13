import type { Metadata } from "next";
import { GovernanceView } from "@/components/GovernanceView";

export const metadata: Metadata = { title: "Governance" };

export default async function GovernancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = /^\d{1,6}$/.test(id) ? Number(id) : -1;
  return <GovernanceView id={parsed} />;
}
