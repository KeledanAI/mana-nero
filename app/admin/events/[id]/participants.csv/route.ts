import { getEventRegistrationsForStaff } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase } = await requireUserWithRole("staff");
  const registrations = await getEventRegistrationsForStaff(supabase, id);

  const rows = [
    ["registration_id", "user_id", "full_name", "email", "status", "waitlist_position"],
    ...registrations.map((registration) => {
      const profile = registration.profiles;
      return [
        registration.id,
        registration.user_id,
        profile?.full_name ?? "",
        profile?.email ?? "",
        registration.status,
        registration.waitlist_position?.toString() ?? "",
      ];
    }),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="event-${id}-participants.csv"`,
    },
  });
}
