import type { ReactNode } from 'react'
import type { CollectionBreakdownItem } from '../types'

type Props = { title: string; subtitle: string; icon: ReactNode; items: CollectionBreakdownItem[] }

function compact(items: CollectionBreakdownItem[]): CollectionBreakdownItem[] {
  if (items.length <= 5) return items
  return [...items.slice(0, 4), { label: 'Autres', count: items.slice(4).reduce((total, item) => total + item.count, 0) }]
}

export function StatisticsBreakdown({ title, subtitle, icon, items }: Props) {
  const displayed = compact(items)
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const maximum = Math.max(...displayed.map((item) => item.count), 1)
  return <article className="breakdown-card"><div className="breakdown-head"><span>{icon}</span><div><small>{title}</small><p>{subtitle}</p></div></div><div className="breakdown-list">{displayed.length ? displayed.map((item) => <div className="breakdown-row" key={item.label}><div><strong>{item.label}</strong><span>{item.count} · {total ? Math.round(item.count / total * 100) : 0}%</span></div><i><b style={{ width: `${item.count / maximum * 100}%` }} /></i></div>) : <p className="breakdown-empty">Aucune donnée disponible</p>}</div></article>
}
