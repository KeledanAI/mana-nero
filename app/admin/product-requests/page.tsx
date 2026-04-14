import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  formatDateTime,
  formatForDatetimeLocalInput,
  formatProductRequestStatus,
  getProductRequestsForStaff,
} from "@/lib/gamestore/data";
import { requireUserWithRole } from "@/lib/gamestore/authz";
import { updateProductRequestStatus } from "../actions";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminProductRequestsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const { supabase } = await requireUserWithRole("staff");
  const requests = await getProductRequestsForStaff(supabase);

  return (
    <section className="grid gap-6">
      <Card className="border-border/70 bg-card/85">
        <CardHeader>
          <CardTitle>Richieste prodotto</CardTitle>
          <p className="text-sm font-normal text-foreground/65">
            Aggiorna stato e note interne. I clienti vedono le proprie richieste nell’area utente. Per lo stato{" "}
            <code className="rounded bg-secondary px-1 text-xs">awaiting_stock</code>, se è impostata una{" "}
            <strong>consegna prevista</strong> nel passato (o è vuota), il cron giornaliero{" "}
            <code className="rounded bg-secondary px-1 text-xs">/api/cron/product-stock-notifications</code> può
            accodare un&apos;email outbox e valorizzare <strong>Notifica arrivo merce</strong> automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {firstParam(params.success) ? (
            <p className="text-sm text-emerald-700">{firstParam(params.success)}</p>
          ) : null}
          {firstParam(params.error) ? (
            <p className="text-sm text-destructive">{firstParam(params.error)}</p>
          ) : null}

          {requests.length === 0 ? (
            <p className="text-sm text-foreground/70">Nessuna richiesta registrata.</p>
          ) : (
            requests.map((request) => (
              <div key={request.id} className="rounded-2xl border border-border/70 bg-secondary/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{request.product_name}</p>
                    <p className="text-sm text-foreground/65">
                      {formatDateTime(request.created_at)}
                      {request.user_id ? ` · utente ${request.user_id.slice(0, 8)}…` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{formatProductRequestStatus(request.status)}</Badge>
                    {request.priority_flag ? <Badge variant="secondary">Priorità</Badge> : null}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-foreground/75">
                  {request.category ? <p>Categoria: {request.category}</p> : null}
                  {request.quantity != null ? <p>Quantità: {request.quantity}</p> : null}
                  {request.desired_price != null ? <p>Prezzo desiderato: {request.desired_price} €</p> : null}
                  {request.notes ? <p>Note: {request.notes}</p> : null}
                  {request.expected_fulfillment_at ? (
                    <p>Consegna prevista: {formatDateTime(request.expected_fulfillment_at)}</p>
                  ) : null}
                  {request.stock_notified_at ? (
                    <p>Notifica arrivo merce: {formatDateTime(request.stock_notified_at)}</p>
                  ) : null}
                </div>
                <form action={updateProductRequestStatus} className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
                  <input type="hidden" name="id" value={request.id} />
                  <div className="grid gap-2">
                    <Label htmlFor={`status-${request.id}`}>Stato</Label>
                    <select
                      id={`status-${request.id}`}
                      name="status"
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      defaultValue={request.status}
                    >
                      <option value="new">new</option>
                      <option value="in_review">in_review</option>
                      <option value="fulfilled">fulfilled</option>
                      <option value="cancelled">cancelled</option>
                      <option value="awaiting_stock">awaiting_stock</option>
                    </select>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor={`notes-${request.id}`}>Note (aggiornano il campo note)</Label>
                    <textarea
                      id={`notes-${request.id}`}
                      name="notes"
                      rows={3}
                      className="rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      defaultValue={request.notes ?? ""}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 sm:col-span-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`expected-${request.id}`}>Consegna prevista (opzionale)</Label>
                      <Input
                        id={`expected-${request.id}`}
                        name="expected_fulfillment_at"
                        type="datetime-local"
                        defaultValue={
                          request.expected_fulfillment_at
                            ? formatForDatetimeLocalInput(request.expected_fulfillment_at)
                            : ""
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`stock-${request.id}`}>Notifica arrivo merce (opzionale)</Label>
                      <Input
                        id={`stock-${request.id}`}
                        name="stock_notified_at"
                        type="datetime-local"
                        defaultValue={
                          request.stock_notified_at
                            ? formatForDatetimeLocalInput(request.stock_notified_at)
                            : ""
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-foreground/60 sm:col-span-2">
                    Lascia vuoti i campi data per azzerare consegna prevista / notifica merce al salvataggio.
                  </p>
                  <SubmitButton className="w-fit sm:col-span-2" pendingLabel="Aggiornamento...">
                    Salva stato
                  </SubmitButton>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
