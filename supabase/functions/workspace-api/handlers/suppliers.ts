import { executeWithWorkspaceContext } from "../../_shared/api-key-auth.ts";
import { requireScope } from "../../_shared/scope-middleware.ts";
import { jsonOk } from "../index.ts";
import { corsHeaders } from "../../_shared/cors.ts";

interface SupplierRow {
  supplier_id: string;
  name: string;
  org_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  category: string | null;
  payment_terms: string | null;
  is_active: boolean;
  created_at: string;
}

interface SupplierOrderRow {
  order_id: string;
  supplier_id: string;
  department_id: string | null;
  order_date: string;
  delivery_date: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string;
  delivery_rating: number | null;
  notes: string | null;
  created_at: string;
}

export async function handleGetSuppliers(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  if (
    !requireScope(
      {
        method: "api_key",
        scopes: auth.scopes,
        userId: null,
        workspaceId: auth.workspaceId,
        keyId: null,
        rateLimitKey: "",
        rateLimitPerMinute: 0,
      },
      "suppliers:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: suppliers:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let query = `
    SELECT supplier_id, name, org_number, contact_name, contact_email,
           contact_phone, address, city, postal_code, country,
           category, payment_terms, is_active, created_at
    FROM supplier
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  const category = url.searchParams.get("category");
  if (category) {
    query += ` AND category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }

  query += ` ORDER BY name ASC`;

  const rows = await executeWithWorkspaceContext<SupplierRow>(auth.workspaceId, query, params);

  return jsonOk({ suppliers: rows });
}

export async function handleGetSupplierOrders(
  auth: { workspaceId: string; scopes: string[] },
  url: URL,
): Promise<Response> {
  if (
    !requireScope(
      {
        method: "api_key",
        scopes: auth.scopes,
        userId: null,
        workspaceId: auth.workspaceId,
        keyId: null,
        rateLimitKey: "",
        rateLimitPerMinute: 0,
      },
      "suppliers:read",
    )
  ) {
    return new Response(JSON.stringify({ error: "Missing scope: suppliers:read" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  let query = `
    SELECT order_id, supplier_id, department_id, order_date, delivery_date,
           total_amount, currency, status, delivery_rating, notes, created_at
    FROM supplier_order
    WHERE workspace_id = $1
  `;
  const params: unknown[] = [auth.workspaceId];
  let paramIdx = 2;

  const supplierId = url.searchParams.get("supplier_id");
  if (supplierId) {
    query += ` AND supplier_id = $${paramIdx}`;
    params.push(supplierId);
    paramIdx++;
  }

  const dateFrom = url.searchParams.get("date_from");
  if (dateFrom) {
    query += ` AND order_date >= $${paramIdx}`;
    params.push(dateFrom);
    paramIdx++;
  }

  const dateTo = url.searchParams.get("date_to");
  if (dateTo) {
    query += ` AND order_date <= $${paramIdx}`;
    params.push(dateTo);
    paramIdx++;
  }

  query += ` ORDER BY order_date DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, offset);

  const rows = await executeWithWorkspaceContext<SupplierOrderRow>(auth.workspaceId, query, params);

  return jsonOk({ orders: rows, limit, offset });
}
