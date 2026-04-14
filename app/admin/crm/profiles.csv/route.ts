import { getAllProfilesForStaff } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export async function GET() {
  const { supabase } = await requireUserWithRole("staff");
  const profiles = await getAllProfilesForStaff(supabase);

  const rows = [
    [
      "id",
      "email",
      "full_name",
      "role",
      "newsletter_opt_in",
      "marketing_consent",
      "phone",
      "crm_tags",
      "lead_stage",
      "interests",
      "stock_notification_lookahead_days",
    ],
    ...profiles.map((p) => [
      p.id,
      p.email ?? "",
      p.full_name ?? "",
      p.role,
      p.newsletter_opt_in ? "true" : "false",
      p.marketing_consent ? "true" : "false",
      p.phone ?? "",
      (p.crm_tags ?? []).join("|"),
      p.lead_stage ?? "",
      (p.interests ?? []).join("|"),
      p.stock_notification_lookahead_days != null ? String(p.stock_notification_lookahead_days) : "",
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="crm-profiles.csv"',
    },
  });
}
