import { NextResponse } from "next/server";

import { isAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

function csvEscape(value: string | number | null | undefined) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatPlacementLabels(value: string[] | null | undefined) {
  if (!value?.length) return "";
  return value.join("; ");
}

function formatUuidList(value: string[] | null | undefined) {
  if (!value?.length) return "";
  return value.join(";");
}

export async function GET() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("quote_requests")
      .select(
        [
          "id",
          "company_name",
          "contact_name",
          "email",
          "phone",
          "service_type",
          "product_color",
          "quantity",
          "placement_labels",
          "logo_file_url",
          "product_id",
          "embroidery_position_id",
          "embroidery_position_ids",
          "printing_position_id",
          "printing_position_ids",
          "pipeline_stage",
          "lead_source",
          "created_at",
          "next_follow_up_at",
          "last_contacted_at",
          "automation_paused",
          "notes",
        ].join(", "),
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type ExportRow = {
      id: string;
      company_name: string;
      contact_name: string;
      email: string;
      phone: string | null;
      service_type: string | null;
      product_color: string | null;
      quantity: number | null;
      placement_labels: string[] | null;
      logo_file_url: string | null;
      product_id: string | null;
      embroidery_position_id: string | null;
      embroidery_position_ids: string[] | null;
      printing_position_id: string | null;
      printing_position_ids: string[] | null;
      pipeline_stage?: string | null;
      lead_source?: string | null;
      created_at: string;
      next_follow_up_at?: string | null;
      last_contacted_at?: string | null;
      automation_paused?: boolean | null;
      notes: string | null;
    };

    const headers = [
      "id",
      "company_name",
      "contact_name",
      "email",
      "phone",
      "service_type",
      "product_color",
      "quantity",
      "placement_labels",
      "logo_file_url",
      "product_id",
      "embroidery_position_id",
      "embroidery_position_ids",
      "printing_position_id",
      "printing_position_ids",
      "pipeline_stage",
      "lead_source",
      "created_at",
      "next_follow_up_at",
      "last_contacted_at",
      "automation_paused",
      "notes",
    ];

    const lines = [headers.join(",")];
    for (const raw of data ?? []) {
      const row = raw as unknown as ExportRow;
      lines.push(
        [
          csvEscape(row.id),
          csvEscape(row.company_name),
          csvEscape(row.contact_name),
          csvEscape(row.email),
          csvEscape(row.phone),
          csvEscape(row.service_type ?? ""),
          csvEscape(row.product_color ?? ""),
          csvEscape(row.quantity === null || row.quantity === undefined ? "" : row.quantity),
          csvEscape(formatPlacementLabels(row.placement_labels)),
          csvEscape(row.logo_file_url ?? ""),
          csvEscape(row.product_id ?? ""),
          csvEscape(row.embroidery_position_id ?? ""),
          csvEscape(formatUuidList(row.embroidery_position_ids)),
          csvEscape(row.printing_position_id ?? ""),
          csvEscape(formatUuidList(row.printing_position_ids)),
          csvEscape(row.pipeline_stage ?? ""),
          csvEscape(row.lead_source ?? ""),
          csvEscape(row.created_at),
          csvEscape(row.next_follow_up_at ?? ""),
          csvEscape(row.last_contacted_at ?? ""),
          csvEscape(String(row.automation_paused ?? "")),
          csvEscape(row.notes),
        ].join(","),
      );
    }

    const csv = lines.join("\n");
    const filename = `quote-leads-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
