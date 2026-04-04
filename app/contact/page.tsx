import { PublicShell } from "@/components/public-shell";
import { SectionHeading } from "@/components/section-heading";
import { SocialLinksLabeled } from "@/components/social-links";
import { siteMedia } from "@/lib/design/media";

export default function ContactPage() {
  return (
    <PublicShell>
      <main className="page-frame py-12">
        <SectionHeading
          eyebrow="Vieni a trovarci"
          title="Mana Nero Fumetteria — il cuore ludico di Tradate."
          description="Fumetti, giochi di carte, giochi da tavolo e serate in compagnia. Passa a trovarci!"
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div
            className="min-h-[26rem] rounded-[2rem] border border-white/10"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(6,10,22,0.18) 0%, rgba(6,10,22,0.82) 100%), url(${siteMedia.store})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="glass-panel rounded-[2rem] p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300/65">
              Il negozio
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-white">Mana Nero Fumetteria</h2>
            <div className="mt-6 space-y-4 text-sm leading-8 text-white/65">
              <div>
                <p className="font-medium text-white">Indirizzo</p>
                <p>Via Alessandro Volta 16, 21049 Tradate (VA)</p>
              </div>
              <div>
                <p className="font-medium text-white">Telefono</p>
                <p>0331 171 2653</p>
              </div>
              <div>
                <p className="font-medium text-white">Email</p>
                <p>mananerofumetteria@gmail.com</p>
              </div>
              <div>
                <p className="font-medium text-white">Orari</p>
                <p>Mar e Gio: 10–12, 13:30–19:30, 21–00</p>
                <p>Mer e Ven: 13:30–19:30, 21–00</p>
                <p>Sab: 10–12, 13:30–19:30</p>
                <p>Dom: 13:30–19:30</p>
              </div>
              <div>
                <p className="font-medium text-white">Seguici</p>
                <SocialLinksLabeled className="mt-3" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
