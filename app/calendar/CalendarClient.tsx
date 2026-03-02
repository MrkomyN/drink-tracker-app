'use client'

import { useState } from 'react'

type Props = {
  monthLabel: string
  prevMonthHref: string
  nextMonthHref: string
  weekdays: string[]
  year: number
  monthIndex: number
  dim: number
  firstWeekday: number
  totalCells: number
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
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedDrinks, setSelectedDrinks] = useState<number>(0)

  const todayValue = totalsByDay[todayKey] ?? 0
  const [todayDrinks, setTodayDrinks] = useState<number>(todayValue)

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

  // Explicit button styling so dark mode never makes these unreadable
  const smallBtn: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid #cfcfcf',
    background: '#f6f6f6',
    color: '#111',
    fontSize: 18,
    lineHeight: '36px',
  }

  const headerLink: React.CSSProperties = {
    padding: '8px 10px',
    border: '1px solid #666',
    borderRadius: 10,
    textDecoration: 'none',
    color: '#fff',
  }

  return (
    <main style={{ padding: 12, maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{monthLabel}</h1>

        <div style={{ display: 'flex', gap: 8 }}>
          <a href={prevMonthHref} style={headerLink}>
            Prev
          </a>
          <a href={nextMonthHref} style={headerLink}>
            Next
          </a>
        </div>
      </div>

      {/* Today (forced readable in dark mode) */}
      <section
        style={{
          marginTop: 10,
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 12,
          background: '#ffffff',
          color: '#111111',
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 8, color: '#111', fontWeight: 600 }}>
          How many drinks did you have today?
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTodayDrinks((v) => clamp(v - 1))} style={smallBtn}>
            –
          </button>

          <div style={{ minWidth: 40, textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#111' }}>
            {todayDrinks}
          </div>

          <button type="button" onClick={() => setTodayDrinks((v) => clamp(v + 1))} style={smallBtn}>
            +
          </button>

          <button
            type="button"
            onClick={submitToday}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#111',
              color: '#fff',
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Save
          </button>
        </div>
      </section>

      {/* Weekdays */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 10 }}>
        {weekdays.map((w) => (
          <div key={w} style={{ fontSize: 11, textAlign: 'center' }}>
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 4 }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstWeekday + 1
          const inMonth = dayNum >= 1 && dayNum <= dim

          if (!inMonth) {
            return (
              <div
                key={idx}
                style={{
                  height: 48,
                  border: '1px solid #333',
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
                height: 48,
                border: isToday ? '1px solid #fff' : '1px solid #666',
                borderRadius: 12,
                padding: 7,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'left',
                background: 'transparent',
                color: 'inherit',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 12 }}>{dayNum}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{drinks}</div>
            </button>
          )
        })}
      </div>

      {/* Bottom Sheet */}
      {selectedDay && (
        <>
          <div
            onClick={closeEditor}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              background: '#fff',
              color: '#111',
              padding: '18px 18px calc(28px + env(safe-area-inset-bottom))',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              boxShadow: '0 -10px 28px rgba(0,0,0,0.22)',
            }}
          >
            {/* Grab handle */}
            <div
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                background: '#d9d9d9',
                margin: '0 auto 14px',
              }}
            />

            <div style={{ fontSize: 16, marginBottom: 14, fontWeight: 800 }}>
              {formatNiceDay(selectedDay)}
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setSelectedDrinks((v) => clamp(v - 1))}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  fontSize: 26,
                  color: '#111',
                }}
              >
                –
              </button>

              <div style={{ fontSize: 30, fontWeight: 900, minWidth: 52, textAlign: 'center' }}>
                {selectedDrinks}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDrinks((v) => clamp(v + 1))}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  border: '1px solid #ddd',
                  background: '#f5f5f5',
                  fontSize: 26,
                  color: '#111',
                }}
              >
                +
              </button>

              <button
                type="button"
                onClick={submitSelectedDay}
                style={{
                  marginLeft: 'auto',
                  padding: '14px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: '#111',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}