import { useState, type ReactNode } from 'react'
import type { CollectionBreakdownItem } from '../types'

type Props = { title: string; subtitle: string; icon: ReactNode; items: CollectionBreakdownItem[]; onSelect?: (item: CollectionBreakdownItem) => void; selectedLabel?: string; formatLabel?: (item: CollectionBreakdownItem) => string }

function compact(items: CollectionBreakdownItem[]): CollectionBreakdownItem[] {
  if (items.length <= 5) return items
  return [...items.slice(0, 4), { label: 'Autres', count: items.slice(4).reduce((total, item) => total + item.count, 0) }]
}

export function StatisticsBreakdown({ title, subtitle, icon, items, onSelect, selectedLabel, formatLabel = (item) => item.label }: Props) {
  const [expanded, setExpanded] = useState(false)
  const displayed = expanded ? items : compact(items)
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const maximum = Math.max(...displayed.map((item) => item.count), 1)
  return <article className="breakdown-card"><div className="breakdown-head"><span>{icon}</span><div><small>{title}</small><p>{subtitle}</p></div></div><div className="breakdown-list">{displayed.length ? displayed.map((item, index) => {
    const aggregate = !expanded && items.length > 5 && index === 4
    const label = aggregate ? item.label : formatLabel(item)
    const content = <><div><strong title={label}>{label}</strong><span>{item.count.toLocaleString('fr-FR')} · {total ? Math.round(item.count / total * 100) : 0}%</span></div><i><b style={{ width: `${item.count / maximum * 100}%` }} /></i></>
    return onSelect ? <button type="button" className="breakdown-row breakdown-action" key={aggregate ? 'aggregate' : `item-${item.label}`} aria-label={aggregate ? 'Afficher les autres catégories' : `Filtrer : ${label}`} aria-pressed={aggregate ? undefined : selectedLabel === item.label} onClick={() => aggregate ? setExpanded(true) : onSelect(item)}>{content}</button> : <div className="breakdown-row" key={item.label}>{content}</div>
  }) : <p className="breakdown-empty">Aucune donnée disponible</p>}</div></article>
}
