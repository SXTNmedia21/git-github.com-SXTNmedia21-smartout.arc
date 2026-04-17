import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";
import { InvoiceDetail } from "../_components/invoice-detail";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [adminId, { id }] = await Promise.all([getSuperAdminId(), params]);
  if (!adminId) redirect("/");

  return <InvoiceDetail invoiceId={id} />;
}
