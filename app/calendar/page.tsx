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
  const nextMonth = firstDayOfNextMonth(year, monthIndex);
  const monthEndExclusive = dayISODate(nextMonth.getFullYear(), nextMonth.getMonth(), 1);

  const { data: rows, error } = await supabase
    .from("daily_drink_totals")
    .select("day, drinks")
    .gte("day", monthStart)
    .lt("day", monthEndExclusive);

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Calendar</h1>
        <p style={{ marginTop: 12, opacity: 0.8 }}>Error loading calendar: {error.message}</p>
      </main>
    );
  }

  const totalsByDay = new Map<string, number>();
  (rows || []).forEach((r: any) => {
    totalsByDay.set(r.day, Number(r.drinks || 0));
  });

  const prev = addMonths(year, monthIndex, -1);
  const next = addMonths(year, monthIndex, 1);

  const monthLabel = first.toLocaleString(undefined, { month: "long", year: "numeric" });
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

    if (error) {
      redirect(`/calendar?month=${monthKey}`);
    }

    redirect(`/calendar?month=${monthKey}`);
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{monthLabel}</h1>

        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={`/calendar?month=${monthKeyFromDate(new Date(prev.year, prev.monthIndex, 1))}`}
            style={{
              padding: "8px 12px",
              border: "1px solid #222",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Prev
          </a>
          <a
            href={`/calendar?month=${monthKeyFromDate(new Date(next.year, next.monthIndex, 1))}`}
            style={{
              padding: "8px 12px",
              border: "1px solid #222",
              borderRadius: 10,
              textDecoration: "none",
            }}
          >
            Next
          </a>
        </div>
      </div>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #222", borderRadius: 12 }}>
        <div style={{ fontSize: 16, opacity: 0.85, marginBottom: 10 }}>
          How many drinks did you have today?
        </div>

        <form action={saveDay} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="day" value={todayKey} />
          <input
            name="drinks"
            type="number"
            min={0}
            max={50}
            defaultValue={totalsByDay.get(todayKey) ?? 0}
            style={{ width: 120, padding: 10, border: "1px solid #333", borderRadius: 8 }}
          />
          <button type="submit" style={{ padding: "10px 14px", borderRadius: 8 }}>
            Save
          </button>
          <div style={{ opacity: 0.7, fontSize: 13 }}>You can edit any day below too.</div>
        </form>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 16 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ opacity: 0.75, fontSize: 13, paddingLeft: 6 }}>
            {w}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, marginTop: 8 }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstWeekday + 1;
          const inMonth = dayNum >= 1 && dayNum <= dim;

          if (!inMonth) {
            return (
              <div
                key={idx}
                style={{
                  height: 110,
                  border: "1px solid #1a1a1a",
                  borderRadius: 12,
                  opacity: 0.35,
                }}
              />
            );
          }

          const dayKey = dayISODate(year, monthIndex, dayNum);
          const drinks = totalsByDay.get(dayKey) ?? 0;
          const isToday = dayKey === todayKey;

          return (
            <div
              key={idx}
              style={{
                height: 110,
                border: isToday ? "1px solid #666" : "1px solid #222",
                borderRadius: 12,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>{dayNum}</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>{drinks} drinks</div>
              </div>

              <form action={saveDay} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="hidden" name="day" value={dayKey} />
                <input
                  name="drinks"
                  type="number"
                  min={0}
                  max={50}
                  defaultValue={drinks}
                  style={{ width: 70, padding: 8, border: "1px solid #333", borderRadius: 8 }}
                />
                <button type="submit" style={{ padding: "8px 10px", borderRadius: 8 }}>
                  Save
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </main>
  );
}