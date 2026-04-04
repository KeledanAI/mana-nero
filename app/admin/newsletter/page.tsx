import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, getNewsletterSubscribersForStaff } from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";

export default async function AdminNewsletterPage() {
  const { supabase } = await requireUserWithRole("staff");
  const subscribers = await getNewsletterSubscribersForStaff(supabase);

  return (
    <section className="grid gap-6">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Iscritti newsletter</CardTitle>
          <p className="text-sm font-normal text-foreground/65">
            Elenco in sola lettura (RLS: staff). Esporta manualmente o integra un provider in V2.
          </p>
        </CardHeader>
        <CardContent>
          {subscribers.length === 0 ? (
            <p className="text-sm text-foreground/70">Nessun iscritto ancora.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border/70 bg-secondary/50 text-foreground/70">
                  <tr>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Opt-in</th>
                    <th className="px-4 py-3 font-medium">Fonte</th>
                    <th className="px-4 py-3 font-medium">Iscrizione</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((row) => (
                    <tr key={row.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3 font-medium">{row.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.opted_in ? "default" : "outline"}>
                          {row.opted_in ? "sì" : "no"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-foreground/70">{row.source ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground/70">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
