import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { SERVICE_REGISTRY } from "../_components/service-config";
import { ServiceDetailClient } from "./_components/service-detail-client";

type Props = { params: Promise<{ key: string }> };

export default async function ServiceDetailPage({ params }: Props) {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const { key } = await params;
  const service = SERVICE_REGISTRY.find((s) => s.key === key);
  if (!service) notFound();

  return <ServiceDetailClient serviceKey={key} />;
}
