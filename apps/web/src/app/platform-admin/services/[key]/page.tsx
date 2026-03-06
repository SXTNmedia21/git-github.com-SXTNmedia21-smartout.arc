import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { ServiceDetailClient } from "./_components/service-detail-client";

type Props = { params: Promise<{ key: string }> };

export default async function ServiceDetailPage({ params }: Props) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { key } = await params;

  return <ServiceDetailClient serviceKey={key} />;
}
