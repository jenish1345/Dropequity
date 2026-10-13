import type { Metadata } from "next";
import { CreateView } from "@/components/CreateView";

export const metadata: Metadata = { title: "Launch a campaign" };

export default function CreatePage() {
  return <CreateView />;
}
