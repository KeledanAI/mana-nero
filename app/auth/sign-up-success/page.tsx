import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Controlla la email",
  description: "Conferma l'indirizzo email per attivare il tuo account Mana Nero.",
};

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Grazie per esserti registrato!
              </CardTitle>
              <CardDescription>Controlla la tua email per confermare</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ti sei registrato correttamente. Controlla la tua email per
                confermare l&apos;account prima di accedere.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
