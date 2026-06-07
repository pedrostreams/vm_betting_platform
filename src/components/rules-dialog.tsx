"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="text-sm text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <BookOpen className="size-4" />
        Regler
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Regler</DialogTitle>
          <DialogDescription>Slik fungerer VM-tippingen.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-4">
            <Section title="Format">
              Konkurransen går i tre deler: <b>gruppespill</b>, <b>sluttspill</b> og{" "}
              <b>special bets</b>. Alle tipper på samme fasit; resultatene grupperes i private
              ligaer.
            </Section>

            <Section title="Gruppespill">
              Tipp <b>H</b> (hjemme), <b>U</b> (uavgjort) eller <b>B</b> (borte) på alle 72
              kamper. <b>2 poeng</b> for riktig utfall. Avgjøres på stillingen etter ordinær tid
              (90 min).
            </Section>

            <Section title="Sluttspill">
              Tipp <b>hvem som går videre</b> (H eller B) — uavgjort finnes ikke. Avgjøres på
              hvem som faktisk avanserer (inkludert ekstraomganger og straffer). Poeng øker per
              runde:
              <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
                <li>16-delsfinale: <b>3 p</b></li>
                <li>8-delsfinale: <b>4 p</b></li>
                <li>Kvartfinale: <b>6 p</b></li>
                <li>Semifinale: <b>8 p</b></li>
                <li>Bronsefinale: <b>8 p</b></li>
                <li>Finale: <b>12 p</b></li>
              </ul>
            </Section>

            <Section title="Special bets">
              Velg favoritter for hele turneringen (kandidater og odds fra Polymarket):
              <ul className="mt-1.5 space-y-0.5 tabular-nums">
                <li>Hvem vinner VM? — <b>10 p</b></li>
                <li>Toppscorer — <b>8 p</b></li>
                <li>Assistkonge — <b>6 p</b></li>
                <li>Land med toppscorer — <b>5 p</b></li>
                <li>Rent bur (keeper med flest) — <b>4 p</b></li>
              </ul>
            </Section>

            <Section title="Frister">
              Hver kamp låses <b>15 minutter før avspark</b> — du kan endre tipset fritt frem til
              da. Alle kamper er synlige fra start, så du kan fylle ut alt i én omgang. Special
              bets låses ved VMs <b>første avspark</b>.
            </Section>

            <Section title="Ligaer">
              Opprett en liga og del invitasjonskoden, eller bli med via en kode. Du kan være med
              i flere ligaer — tipsene dine teller i alle.
            </Section>

            <Section title="Rangering ved poenglikhet">
              1) Flest totalpoeng → 2) flest rette i sluttspillet → 3) flest rette special bets →
              4) delt plassering.
            </Section>

            <Section title="Innsats">
              Buy-in er <b>200 kr</b> per deltaker. Oppgjøret skjer utenfor appen.
            </Section>

            <p className="rounded-lg bg-secondary/60 p-3 text-sm">
              Maks mulig poengsum: <b className="text-foreground">317</b> (144 gruppespill + 140
              sluttspill + 33 special bets).
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
