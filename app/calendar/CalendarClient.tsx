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

  return (
    <main style={{ padding: 12, maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{monthLabel}</h1>

        <div style={{ display: 'flex', gap: 8 }}>
          <a href={prevMonthHref} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 }}>
            Prev
          </a>
          <a href={nextMonthHref} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 }}>
            Next
          </a>
        </div>
      </div>

      {/* Today */}
      <section
        style={{
          marginTop: 10,
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 10,
          background: '#fff',
        }}
      >
        <div style={{ fontSize: 14, marginBottom: 8 }}>
          How many drinks did you have today?
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setTodayDrinks((v) => clamp(v - 1))}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #ccc' }}
          >
            -
          </button>

          <div style={{ minWidth: 40, textAlign: 'center', fontSize: 20, fontWeight: 700 }}>
            {todayDrinks}
          </div>

          <button
            type="button"
            onClick={() => setTodayDrinks((v) => clamp(v + 1))}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #ccc' }}
          >
            +
          </button>

          <button
            type="button"
            onClick={submitToday}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
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
                  border: '1px solid #eee',
                  borderRadius: 10,
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
                border: isToday ? '1px solid #666' : '1px solid #ddd',
                borderRadius: 10,
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12 }}>{dayNum}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{drinks}</div>
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
              background: 'rgba(0,0,0,0.4)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              background: '#fff',
              padding: 16,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              {formatNiceDay(selectedDay)}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => setSelectedDrinks((v) => clamp(v - 1))}>-</button>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedDrinks}</div>
              <button onClick={() => setSelectedDrinks((v) => clamp(v + 1))}>+</button>

              <button
                onClick={submitSelectedDay}
                style={{ marginLeft: 'auto', padding: '8px 12px' }}
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