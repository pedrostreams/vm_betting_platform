"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export type Row = Record<string, string | number | null>;

// Columns that are text / fixed (not treated as sortable numeric stats).
const TEXT_KEYS = new Set(["team", "group", "titleProb", "player", "position"]);

const POSITION_LABEL: Record<string, string> = {
  G: "Keeper",
  D: "Forsvar",
  M: "Midtbane",
  F: "Angrep",
};

// Norwegian labels for the common Sofascore keys; unknown keys are humanized.
const LABELS: Record<string, string> = {
  matches: "Kamper",
  appearances: "Kamper",
  avgRating: "Rating",
  rating: "Rating",
  goalsScored: "Mål",
  goals: "Mål",
  goalsConceded: "Baklengs",
  assists: "Assist",
  goalsAssistsSum: "M+A",
  cleanSheets: "Nullkamper",
  averageBallPossession: "Besittelse",
  shots: "Skudd",
  totalShots: "Skudd",
  shotsOnTarget: "Skudd på mål",
  bigChances: "Store sjanser",
  bigChancesCreated: "Store sjanser skapt",
  bigChancesMissed: "Store sjanser brent",
  goalsFromInsideTheBox: "Mål i 16-meter",
  goalsFromOutsideTheBox: "Mål utenfor 16",
  penaltyGoals: "Straffemål",
  freeKickGoals: "Frisparkmål",
  headedGoals: "Hodemål",
  hitWoodwork: "Stolpe/tverrl.",
  totalPasses: "Pasninger",
  accuratePasses: "Korrekte pasn.",
  accuratePassesPercentage: "Pasning%",
  keyPasses: "Målgivende pasn.",
  accurateLongBalls: "Lange baller",
  accurateLongBallsPercentage: "Lange baller%",
  accurateCrossesPercentage: "Innlegg%",
  successfulDribbles: "Driblinger",
  corners: "Hjørnespark",
  tackles: "Taklinger",
  interceptions: "Brytninger",
  clearances: "Klareringer",
  saves: "Redninger",
  duelsWonPercentage: "Dueller vunnet%",
  aerialDuelsWonPercentage: "Luftdueller%",
  groundDuelsWonPercentage: "Bakkedueller%",
  possessionLost: "Tap av ball",
  fouls: "Frispark begått",
  offsides: "Offside",
  yellowCards: "Gule kort",
  redCards: "Røde kort",
  errorsLeadingToGoal: "Feil → mål",
};

const PCT_KEYS = new Set(["averageBallPossession"]);

function humanize(key: string): string {
  const s = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").toLowerCase().trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const label = (key: string) => LABELS[key] ?? humanize(key);
const isPct = (key: string) => key.endsWith("Percentage") || PCT_KEYS.has(key);
const isRating = (key: string) => key === "rating" || key === "avgRating";

function fmt(key: string, v: unknown): string {
  if (v == null || typeof v !== "number") return "–";
  if (isPct(key)) return `${Math.round(v)}%`;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// Priority ordering for stat columns (rest follow alphabetically by label).
const ORDER_TEAM = [
  "matches", "avgRating", "goalsScored", "goalsConceded", "cleanSheets",
  "averageBallPossession", "shots", "shotsOnTarget", "bigChances", "bigChancesMissed",
  "accuratePassesPercentage", "totalPasses", "keyPasses", "successfulDribbles",
  "tackles", "interceptions", "clearances", "saves", "duelsWonPercentage",
  "aerialDuelsWonPercentage", "fouls", "offsides", "corners", "yellowCards", "redCards",
];
const ORDER_PLAYER = [
  "appearances", "rating", "goals", "assists", "goalsAssistsSum", "totalShots",
  "shotsOnTarget", "bigChancesCreated", "bigChancesMissed", "keyPasses",
  "accuratePasses", "successfulDribbles", "tackles", "interceptions", "clearances",
  "possessionLost",
];

function SortHeader({ column, text }: { column: any; text: string }) {
  const sorted = column.getIsSorted();
  return (
    <button
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="flex items-center gap-1 whitespace-nowrap hover:text-foreground"
    >
      {text}
      {sorted === "asc" ? (
        <ArrowUp className="size-3" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

function RatingBadge({ value }: { value: unknown }) {
  if (typeof value !== "number") return <span className="text-muted-foreground">–</span>;
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        value >= 7.0
          ? "bg-[var(--win)] text-[var(--win-foreground)]"
          : value >= 7
            ? "bg-[var(--draw)] text-[var(--draw-foreground)]"
            : "bg-secondary text-muted-foreground",
      )}
    >
      {value.toFixed(2)}
    </span>
  );
}

function statColumns(rows: Row[], order: string[]): ColumnDef<Row, unknown>[] {
  const present = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!TEXT_KEYS.has(k) && typeof r[k] === "number") present.add(k);
    }
  }
  const ordered = [
    ...order.filter((k) => present.has(k)),
    ...[...present].filter((k) => !order.includes(k)).sort((a, b) => label(a).localeCompare(label(b))),
  ];
  return ordered.map((key) => ({
    accessorKey: key,
    header: ({ column }) => <SortHeader column={column} text={label(key)} />,
    sortUndefined: "last",
    cell: (c) =>
      isRating(key) ? (
        <RatingBadge value={c.getValue()} />
      ) : (
        <span className="tabular-nums">{fmt(key, c.getValue())}</span>
      ),
  }));
}

function DataTable({
  columns,
  data,
  initialSort,
  searchPlaceholder,
  renderFilters,
}: {
  columns: ColumnDef<Row, any>[];
  data: Row[];
  initialSort: SortingState;
  searchPlaceholder: string;
  renderFilters?: (table: ReturnType<typeof useReactTable<Row>>) => React.ReactNode;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-9 max-w-xs"
        />
        {renderFilters?.(table)}
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
          {table.getRowModel().rows.length} rader
        </span>
      </div>

      <div className="max-h-[calc(100dvh-14rem)] overflow-auto rounded-xl border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="whitespace-nowrap bg-card">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Ingen treff.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GroupFilter({ table }: { table: any }) {
  const values = useMemo(() => {
    const set = new Set<string>();
    table.getCoreRowModel().rows.forEach((r: any) => {
      const v = r.getValue("group");
      if (v) set.add(v as string);
    });
    return [...set].sort();
  }, [table]);
  const current = (table.getColumn("group")?.getFilterValue() as string) ?? "all";
  return (
    <Select
      value={current}
      onValueChange={(v) => table.getColumn("group")?.setFilterValue(v === "all" ? undefined : v)}
    >
      <SelectTrigger className="h-9 w-36">
        <SelectValue placeholder="Gruppe" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alle grupper</SelectItem>
        {values.map((g) => (
          <SelectItem key={g} value={g}>
            {g}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatsExplorer({ teamRows, playerRows }: { teamRows: Row[]; playerRows: Row[] }) {
  const teamColumns: ColumnDef<Row, any>[] = [
    {
      accessorKey: "team",
      header: ({ column }) => <SortHeader column={column} text="Lag" />,
      cell: (c) => <span className="font-medium">{c.getValue() as string}</span>,
    },
    { accessorKey: "group", header: "Gruppe", filterFn: "equals", cell: (c) => <span className="text-muted-foreground">{(c.getValue() as string) || "–"}</span> },
    {
      accessorKey: "titleProb",
      header: ({ column }) => <SortHeader column={column} text="VM-odds" />,
      sortUndefined: "last",
      cell: (c) => {
        const v = c.getValue() as number | null;
        return <span className="tabular-nums">{v == null ? "–" : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`}</span>;
      },
    },
    ...statColumns(teamRows, ORDER_TEAM),
  ];

  const playerColumns: ColumnDef<Row, any>[] = [
    {
      accessorKey: "player",
      header: ({ column }) => <SortHeader column={column} text="Spiller" />,
      cell: (c) => <span className="font-medium">{c.getValue() as string}</span>,
    },
    { accessorKey: "team", header: ({ column }) => <SortHeader column={column} text="Lag" />, cell: (c) => <span className="text-muted-foreground">{c.getValue() as string}</span> },
    { accessorKey: "position", header: "Pos", filterFn: "equals", cell: (c) => { const v = c.getValue() as string | null; return <span className="text-muted-foreground">{v ? POSITION_LABEL[v] ?? v : "–"}</span>; } },
    { accessorKey: "group", header: "Gruppe", filterFn: "equals", cell: (c) => <span className="text-muted-foreground">{(c.getValue() as string) || "–"}</span> },
    ...statColumns(playerRows, ORDER_PLAYER),
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Statistikk</h1>
        <p className="text-sm text-muted-foreground">
          All lag- og spillerdata fra VM-kvalifiseringen. Klikk kolonneoverskrifter for å sortere, scroll for flere.
        </p>
      </div>

      <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams">Lag</TabsTrigger>
          <TabsTrigger value="players">Spillere</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-4">
          <DataTable
            columns={teamColumns}
            data={teamRows}
            initialSort={[{ id: "avgRating", desc: true }]}
            searchPlaceholder="Søk lag …"
            renderFilters={(table) => <GroupFilter table={table} />}
          />
        </TabsContent>

        <TabsContent value="players" className="mt-4">
          <DataTable
            columns={playerColumns}
            data={playerRows}
            initialSort={[{ id: "goals", desc: true }]}
            searchPlaceholder="Søk spiller eller lag …"
            renderFilters={(table) => (
              <>
                <Select
                  defaultValue="all"
                  onValueChange={(v) => table.getColumn("position")?.setFilterValue(v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="h-9 w-36">
                    <SelectValue placeholder="Posisjon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle posisjoner</SelectItem>
                    <SelectItem value="G">Keeper</SelectItem>
                    <SelectItem value="D">Forsvar</SelectItem>
                    <SelectItem value="M">Midtbane</SelectItem>
                    <SelectItem value="F">Angrep</SelectItem>
                  </SelectContent>
                </Select>
                <GroupFilter table={table} />
              </>
            )}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
