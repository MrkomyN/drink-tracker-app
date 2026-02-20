import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type DrinkRow = {
  id: string;
  name: string;
  servings: number;
  logged_at: string;
  beverage_type?: string | null;
  volume_oz?: number | null;
  abv?: number | null;
  standard_drinks?: number | null;
};

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfNDaysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function defaultLocalDateTimeValue() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// US standard drink math: grams ethanol = oz * 29.5735 * abv * 0.789
// standard drinks = grams / 14
function calcStandardDrinks(volumeOz: number, abvPercent: number) {
  const abv = abvPercent / 100;
  const grams = volumeOz * 29.5735 * abv * 0.789;
  const standard = grams / 14;
  return Math.round(standard * 100) / 100; // 2 decimals
}

function formatDayKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function last7DaysKeys() {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(formatDayKey(d));
  }
  return keys;
}

export default async function DrinksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const todayStart = startOfTodayISO();
  const weekStart = startOfNDaysAgoISO(6);

  const { data: todayRows } = await supabase
    .from("drinks")
    .select("*")
    .gte("logged_at", todayStart)
    .order("logged_at", { ascending: false });

  const todaysDrinks = (todayRows || []) as DrinkRow[];
  const totalTodayServings = todaysDrinks.reduce((sum, d) => sum + Number(d.servings || 0), 0);
  const totalTodayStandard = todaysDrinks.reduce((sum, d) => sum + Number(d.standard_drinks || 0), 0);

  const { data: weekRows } = await supabase
    .from("drinks")
    .select("*")
    .gte("logged_at", weekStart)
    .order("logged_at", { ascending: false });

  const weekDrinks = (weekRows || []) as DrinkRow[];

  const dayKeys = last7DaysKeys();
  const byDay: Record<string, { servings: number; standard: number }> = {};
  for (const k of dayKeys) byDay[k] = { servings: 0, standard: 0 };

  for (const d of weekDrinks) {
    const key = formatDayKey(new Date(d.logged_at));
    if (!byDay[key]) continue;
    byDay[key].servings += Number(d.servings || 0);
    byDay[key].standard += Number(d.standard_drinks || 0);
  }

  const { data: recentRows } = await supabase
    .from("drinks")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(50);

  const recentDrinks = (recentRows || []) as DrinkRow[];

  async function addDrink(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const preset = String(formData.get("preset") || "").trim(); // beer|wine|cocktail or blank
    const nameRaw = String(formData.get("name") || "").trim();
    const servings = Number(formData.get("servings") || 1);

    const loggedAtLocal = String(formData.get("logged_at") || "").trim();
    const logged_at = loggedAtLocal ? new Date(loggedAtLocal).toISOString() : new Date().toISOString();

    let beverage_type: string | null = null;
    let name = nameRaw;
    let volume_oz: number | null = null;
    let abv: number | null = null;

    // Presets are a starting point, user can tweak volume and abv.
    if (preset === "beer") {
      beverage_type = "beer";
      if (!name) name = "Beer";
      volume_oz = Number(formData.get("volume_oz") || 12);
      abv = Number(formData.get("abv") || 5);
    } else if (preset === "wine") {
      beverage_type = "wine";
      if (!name) name = "Wine";
      volume_oz = Number(formData.get("volume_oz") || 5);
      abv = Number(formData.get("abv") || 12);
    } else if (preset === "cocktail") {
      beverage_type = "cocktail";
      if (!name) name = "Cocktail";
      volume_oz = Number(formData.get("volume_oz") || 1.5); // typical spirit ounces
      abv = Number(formData.get("abv") || 40);
    } else {
      // Manual entry still works, optional fields:
      beverage_type = String(formData.get("beverage_type") || "").trim() || null;
      volume_oz = formData.get("volume_oz") ? Number(formData.get("volume_oz")) : null;
      abv = formData.get("abv") ? Number(formData.get("abv")) : null;
    }

    if (!name) return;

    let standard_drinks: number | null = null;
    if (volume_oz && abv) {
      standard_drinks = calcStandardDrinks(volume_oz, abv);
      // If they logged multiple servings, multiply it
      standard_drinks = Math.round(standard_drinks * servings * 100) / 100;
    }

    await supabase.from("drinks").insert({
      user_id: user.id,
      name,
      servings,
      logged_at,
      beverage_type,
      volume_oz,
      abv,
      standard_drinks,
    });

    redirect("/drinks");
  }

  async function deleteDrink(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const id = String(formData.get("id") || "");
    if (!id) return;

    await supabase.from("drinks").delete().eq("id", id);
    redirect("/drinks");
  }

  return (
    <main style={{ padding: 24, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Drinks</h1>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #222", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <div style={{ fontSize: 16, opacity: 0.8 }}>Today</div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{totalTodayServings} servings</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>{totalTodayStandard.toFixed(2)} standard drinks</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {todaysDrinks.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No drinks logged today.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {todaysDrinks.map((d) => (
                <li key={d.id} style={{ margin: "6px 0" }}>
                  <span style={{ fontWeight: 600 }}>{d.name}</span>{" "}
                  <span style={{ opacity: 0.8 }}>
                    ({d.servings} servings, {(d.standard_drinks || 0).toFixed(2)} std)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #222", borderRadius: 12 }}>
        <div style={{ fontSize: 16, opacity: 0.8, marginBottom: 10 }}>Last 7 days</div>
        <div style={{ display: "grid", gap: 8 }}>
          {dayKeys.map((k) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 10px",
                border: "1px solid #2a2a2a",
                borderRadius: 10,
              }}
            >
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.9 }}>{k}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{byDay[k].servings.toFixed(2)} servings</div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>{byDay[k].standard.toFixed(2)} standard drinks</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={addDrink}>
            <input type="hidden" name="preset" value="beer" />
            <input type="hidden" name="name" value="Beer" />
            <input type="hidden" name="servings" value="1" />
            <input type="hidden" name="volume_oz" value="12" />
            <input type="hidden" name="abv" value="5" />
            <input type="hidden" name="logged_at" value={defaultLocalDateTimeValue()} />
            <button type="submit" style={{ padding: "10px 12px", borderRadius: 10 }}>
              + Beer (12oz, 5%)
            </button>
          </form>

          <form action={addDrink}>
            <input type="hidden" name="preset" value="wine" />
            <input type="hidden" name="name" value="Wine" />
            <input type="hidden" name="servings" value="1" />
            <input type="hidden" name="volume_oz" value="5" />
            <input type="hidden" name="abv" value="12" />
            <input type="hidden" name="logged_at" value={defaultLocalDateTimeValue()} />
            <button type="submit" style={{ padding: "10px 12px", borderRadius: 10 }}>
              + Wine (5oz, 12%)
            </button>
          </form>

          <form action={addDrink}>
            <input type="hidden" name="preset" value="cocktail" />
            <input type="hidden" name="name" value="Cocktail" />
            <input type="hidden" name="servings" value="1" />
            <input type="hidden" name="volume_oz" value="1.5" />
            <input type="hidden" name="abv" value="40" />
            <input type="hidden" name="logged_at" value={defaultLocalDateTimeValue()} />
            <button type="submit" style={{ padding: "10px 12px", borderRadius: 10 }}>
              + Cocktail (1.5oz, 40%)
            </button>
          </form>
        </div>

        <form action={addDrink} style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div style={{ fontSize: 14, opacity: 0.8 }}>Custom log</div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="name"
              placeholder="Name (optional if you use presets)"
              style={{ flex: 1, padding: 10, border: "1px solid #333", borderRadius: 8 }}
            />
            <input
              name="servings"
              type="number"
              step="0.25"
              min="0.25"
              defaultValue={1}
              style={{ width: 120, padding: 10, border: "1px solid #333", borderRadius: 8 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              name="beverage_type"
              placeholder="Type (beer/wine/cocktail)"
              style={{ flex: 1, padding: 10, border: "1px solid #333", borderRadius: 8 }}
            />
            <input
              name="volume_oz"
              type="number"
              step="0.1"
              min="0"
              placeholder="Ounces"
              style={{ width: 140, padding: 10, border: "1px solid #333", borderRadius: 8 }}
            />
            <input
              name="abv"
              type="number"
              step="0.1"
              min="0"
              placeholder="ABV %"
              style={{ width: 120, padding: 10, border: "1px solid #333", borderRadius: 8 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ opacity: 0.8, width: 90 }}>Log time</label>
            <input
              name="logged_at"
              type="datetime-local"
              defaultValue={defaultLocalDateTimeValue()}
              style={{ padding: 10, border: "1px solid #333", borderRadius: 8, flex: 1 }}
            />
            <button type="submit" style={{ padding: "10px 14px", borderRadius: 8 }}>
              Log
            </button>
          </div>
        </form>
      </section>

      <h2 style={{ marginTop: 24, fontSize: 18, fontWeight: 700 }}>Recent</h2>

      <ul style={{ marginTop: 10 }}>
        {recentDrinks.map((d) => (
          <li key={d.id} style={{ padding: "12px 0", borderBottom: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {d.name}{" "}
                  <span style={{ fontWeight: 400, opacity: 0.9 }}>
                    ({d.servings} servings, {(d.standard_drinks || 0).toFixed(2)} std)
                  </span>
                </div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  {new Date(d.logged_at).toLocaleString()}
                </div>
              </div>

              <form action={deleteDrink}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" style={{ padding: "8px 10px", borderRadius: 8 }}>
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}