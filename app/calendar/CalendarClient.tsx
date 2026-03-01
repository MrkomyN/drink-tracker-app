'use client'

import { useMemo, useState } from 'react'

type Props = {
  monthLabel: string
  prevMonthHref: string
  nextMonthHref: string
  weekdays: string[]
  year: number
  monthIndex: number // 0-11
  dim: number
  firstWeekday: number // 0-6
  totalCells: number // usually 42
  todayKey: string
  totalsByDay: Record<string, number>
  saveDay: (formData: FormData) => void | Promise<void>
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function dayISODate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function formatNiceDay(iso: string) {
  // iso = YYYY-MM-DD
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function CalendarClient({
  monthLabel,
  prevMonthHref,
  nextMonthHref,
  weekdays,
  year,
  monthIndex,
  dim,
  firstWeekday,
  totalCells,
  todayKey,
  totalsByDay,
  saveDay,
}: Props) {
  // Bottom sheet state
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDrinks, setSelectedDrinks] = useState<number>(0)

  // Today quick editor state
  const todayValue = totalsByDay[todayKey] ?? 0
  const [todayDrinks, setTodayDrinks] = useState<number>(todayValue)

  // If totalsByDay changes (after redirect refresh), keep todayDrinks in sync
  // (simple approach: recompute when month changes or todayKey changes)
  useMemo(() => {
    setTodayDrinks(todayValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, todayValue, monthLabel])

  function clamp(n: number) {
    return Math.max(0, Math.min(50, n))
  }

  function openEditor(dayKey: string) {
    setSelectedDay(dayKey)
    setSelectedDrinks(totalsByDay[dayKey] ?? 0)
  }

  function closeEditor() {
    setSelectedDay(null)
  }

  async function submitSelectedDay() {
    if (!selectedDay) return
    const fd = new FormData()
    fd.set('day', selectedDay)
    fd.set('drinks', String(clamp(selectedDrinks)))
    await saveDay(fd)
  }

  async function submitToday() {
    const fd = new FormData()
    fd.set('day', todayKey)
    fd.set('drinks', String(clamp(todayDrinks)))
    await saveDay(fd)
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{monthLabel}</h1>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={prevMonthHref}
            style={{
              padding: '10px 12px',
              border: '1px solid #222',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Prev
          </a>
          <a
            href={nextMonthHref}
            style={{
              padding: '10px 12px',
              border: '1px solid #222',
              borderRadius: 10,
              textDecoration: 'none',
            }}
          >
            Next
          </a>
        </div>
      </div>

      {/* Today - mobile friendly stepper */}
      <section
        style={{
          marginTop: 12,
          padding: 14,
          border: '1px solid #222',
          borderRadius: 12,
          position: 'sticky',
          top: 8,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 5,
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 10 }}>
          How many drinks did you have today?
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTodayDrinks((v) => clamp(v - 1))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid #333',
              fontSize: 20,
            }}
            aria-label="Decrease today drinks"
          >
            -
          </button>

          <div
            style={{
              minWidth: 56,
              textAlign: 'center',
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {todayDrinks}
          </div>

          <button
            type="button"
            onClick={() => setTodayDrinks((v) => clamp(v + 1))}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              border: '1px solid #333',
              fontSize: 20,
            }}
            aria-label="Increase today drinks"
          >
            +
          </button>

          <button
            type="button"
            onClick={submitToday}
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #333',
              fontWeight: 600,
            }}
          >
            Save
          </button>

          <div style={{ opacity: 0.7, fontSize: 12 }}>Tap any day below to edit it.</div>
        </div>
      </section>

      {/* Weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ opacity: 0.75, fontSize: 12, paddingLeft: 6 }}>
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid - tap to edit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 6 }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstWeekday + 1
          const inMonth = dayNum >= 1 && dayNum <= dim

          if (!inMonth) {
            return (
              <div
                key={idx}
                style={{
                  minHeight: 62,
                  border: '1px solid #1a1a1a',
                  borderRadius: 12,
                  opacity: 0.35,
                }}
              />
            )
          }

          const dayKey = dayISODate(year, monthIndex, dayNum)
          const drinks = totalsByDay[dayKey] ?? 0
          const isToday = dayKey === todayKey

          return (
            <button
              key={idx}
              type="button"
              onClick={() => openEditor(dayKey)}
              style={{
                minHeight: 62,
                width: '100%',
                border: isToday ? '1px solid #666' : '1px solid #222',
                borderRadius: 12,
                padding: 10,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{dayNum}</div>
                <div style={{ opacity: 0.85, fontSize: 13 }}>{drinks}</div>
              </div>

              <div style={{ opacity: 0.7, fontSize: 12 }}>{drinks === 1 ? 'drink' : 'drinks'}</div>
            </button>
          )
        })}
      </div>

      {/* Bottom sheet editor */}
      {selectedDay && (
        <>
          {/* Overlay */}
          <div
            onClick={closeEditor}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 50,
            }}
          />

          {/* Sheet */}
          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 60,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              border: '1px solid #222',
              background: '#0b0b0b',
              padding: 16,
              maxWidth: 900,
              margin: '0 auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, opacity: 0.8 }}>Edit day</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{formatNiceDay(selectedDay)}</div>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #333',
                  fontSize: 18,
                }}
                aria-label="Close editor"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSelectedDrinks((v) => clamp(v - 1))}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: '1px solid #333',
                  fontSize: 22,
                }}
                aria-label="Decrease drinks"
              >
                -
              </button>

              <div style={{ minWidth: 64, textAlign: 'center', fontSize: 28, fontWeight: 800 }}>
                {selectedDrinks}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDrinks((v) => clamp(v + 1))}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: '1px solid #333',
                  fontSize: 22,
                }}
                aria-label="Increase drinks"
              >
                +
              </button>

              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {[0, 1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelectedDrinks(n)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid #333',
                      fontWeight: 600,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={submitSelectedDay}
                style={{
                  flex: 1,
                  padding: '14px 14px',
                  borderRadius: 12,
                  border: '1px solid #333',
                  fontWeight: 700,
                }}
              >
                Save
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Tip: tap outside this panel to close it.
            </div>
          </div>
        </>
      )}
    </main>
  )
}