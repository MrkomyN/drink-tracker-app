import CalendarClient from "./CalendarClient";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function parseMonthParam(month: string | null) {
  // month format: YYYY-MM
  const now = new Date();
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  }
  const [y, m] = month.split("-").map(Number);
  return { year: y, monthIndex: m - 1 };
}

function firstDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function firstDayOfNextMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dayISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function addMonths(year: number, monthIndex: number, delta: number) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}: {
  // Next.js 16 can pass this as a Promise in server components
  searchParams: any;
}) {
  const sp = await Promise.resolve(searchParams);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { year, monthIndex } = parseMonthParam(sp?.month || null);
  const first = firstDayOfMonth(year, monthIndex);
  const dim = daysInMonth(year, monthIndex);

  // Use real month boundaries: [monthStart, nextMonthStart)
  const monthStart = dayISODate(year, monthIndex, 1);
  const nextMonthDate = firstDayOfNextMonth(year, monthIndex);
  const monthEndExclusive = dayISODate(
    nextMonthDate.getFullYear(),
    nextMonthDate.getMonth(),
    1
  );

  const { data: rows, error } = await supabase
    .from("daily_drink_totals")
    .select("day, drinks")
    .gte("day", monthStart)
    .lt("day", monthEndExclusive);

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Calendar</h1>
        <p style={{ marginTop: 12, opacity: 0.8 }}>
          Error loading calendar: {error.message}
        </p>
      </main>
    );
  }

  const totalsByDay = new Map<string, number>();
  (rows || []).forEach((r: any) => {
    totalsByDay.set(r.day, Number(r.drinks || 0));
  });

  // IMPORTANT: client components can't receive a Map. Convert to a plain object.
  const totalsObj: Record<string, number> = Object.fromEntries(totalsByDay);

  const prev = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);

  const monthLabel = first.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const firstWeekday = first.getDay();
  const totalCells = 42;

  const today = new Date();
  const todayKey = dayISODate(today.getFullYear(), today.getMonth(), today.getDate());

  async function saveDay(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const day = String(formData.get("day") || "");
    const drinksRaw = String(formData.get("drinks") || "0");
    const drinks = Math.max(0, Math.min(50, parseInt(drinksRaw, 10) || 0)); // clamp 0..50

    const { error } = await supabase.from("daily_drink_totals").upsert(
      {
        user_id: user.id,
        day,
        drinks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,day" }
    );

    const monthKey = monthKeyFromDate(new Date(year, monthIndex, 1));

    // We redirect either way so the UI refreshes with correct data
    if (error) {
      redirect(`/calendar?month=${monthKey}`);
    }

    redirect(`/calendar?month=${monthKey}`);
  }

  // Build month nav hrefs on the server
  const prevMonthHref = `/calendar?month=${monthKeyFromDate(
    new Date(prev.year, prev.monthIndex, 1)
  )}`;
  const nextMonthHref = `/calendar?month=${monthKeyFromDate(
    new Date(next.year, next.monthIndex, 1)
  )}`;

  // ✅ Render the client component and pass it what it needs
  return (
    <CalendarClient
      monthLabel={monthLabel}
      prevMonthHref={prevMonthHref}
      nextMonthHref={nextMonthHref}
      weekdays={WEEKDAYS}
      year={year}
      monthIndex={monthIndex}
      dim={dim}
      firstWeekday={firstWeekday}
      totalCells={totalCells}
      todayKey={todayKey}
      totalsByDay={totalsObj}
      saveDay={saveDay}
    />
  );
}