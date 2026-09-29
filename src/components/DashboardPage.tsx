import { useEffect, useState } from 'react'
import { Box, CalendarDays, Palette, Puzzle, Tags, UserRound } from 'lucide-react'
import { collectionApi } from '../api'
import { minifigureApi, type MiniCollection } from '../minifigures'
import type { CollectionSummary, CollectionFilters, CollectionBreakdownItem } from '../types'
import { StatisticsBreakdown } from './StatisticsBreakdown'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
function breakdown(labels: string[]): CollectionBreakdownItem[] {
  const counts = new Map<string, number>()
  labels.forEach((label) => counts.set(label, (counts.get(label) || 0) + 1))
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function DashboardPage({ onSelect }: { onSelect: (filters: Partial<CollectionFilters>) => void }) {
  const [data, setData] = useState<{ summary: CollectionSummary; minis: MiniCollection } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    Promise.all([collectionApi.summary(), minifigureApi.list()]).then(([summary, minis]) => { if (active) setData({ summary, minis }) }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible') })
    return () => { active = false }
  }, [retry])
  if (!data) return <section className="dashboard-page"><div className="pick-page-heading"><h1>Dashboard</h1></div>{error ? <div role="alert">{error}<button className="button" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div> : <p role="status">Chargement des statistiques…</p>}</section>
  const { summary, minis } = data
  const copies = minis.copies.filter((copy) => !copy.deletedAt)
  const characters = new Set(copies.filter((copy) => copy.characterId).map((copy) => copy.characterId))
  const duplicates = copies.filter((copy) => copy.characterId).length - characters.size
  const series = minis.series.filter((item) => !item.isStandalone)
  const progress = series.map((item) => {
    const owned = new Set(copies.filter((copy) => copy.seriesId === item.id && copy.characterId).map((copy) => copy.characterId)).size
    const total = Math.max(item.expectedCount || 0, item.characters.length)
    return total > 0 && owned >= total ? 'Complètes' : 'À compléter'
  })
  const invested = copies.reduce((total, copy) => total + (copy.isGift || copy.includedInSet ? 0 : Number(copy.purchasePrice)), 0)
  return <section className="dashboard-page"><div className="pick-page-heading"><span className="eyebrow">VUE D’ENSEMBLE</span><h1>Dashboard</h1><p>Les statistiques de vos sets et de vos minifigurines, réunies au même endroit.</p></div>
    <section aria-labelledby="set-stats-heading"><h2 id="set-stats-heading">Stats sets</h2><div className="mini-summary"><span><strong>{summary.itemCount}</strong><small>EXEMPLAIRES</small></span><span><strong>{summary.totalParts.toLocaleString('fr-FR')}</strong><small>BRIQUES</small></span><span><strong>{euro.format(Number(summary.totalInvested) - Number(summary.minifigureInvested || 0))}</strong><small>INVESTIS HORS MINIFIGURINES</small></span></div>
      <section className="stats breakdown-stats" id="stats">
        <StatisticsBreakdown title="RÉPARTITION PAR MARQUE" subtitle="Marques de votre collection" icon={<Box />} items={summary.brands} onSelect={(item) => onSelect({ brand: item.label as CollectionFilters['brand'] })} />
        <StatisticsBreakdown title="NOMBRE DE BRIQUES PAR MARQUE" subtitle="Total des pièces renseignées" icon={<Puzzle />} items={summary.partsByBrand ?? []} onSelect={(item) => onSelect({ brand: item.label as CollectionFilters['brand'] })} />
        <StatisticsBreakdown title="RÉPARTITION PAR THÈME" subtitle="Univers les plus présents" icon={<Palette />} items={summary.themes} formatLabel={(item) => item.brands?.length ? `${item.label} (${item.brands.join(', ')})` : item.label} onSelect={(item) => onSelect({ theme: item.label })} />
        <StatisticsBreakdown title="CONDITIONS D’ACHAT" subtitle="Sets achetés neufs ou d’occasion" icon={<Tags />} items={summary.conditions} />
        <StatisticsBreakdown title="ANNÉES D’ACHAT" subtitle="Chronologie de la collection" icon={<CalendarDays />} items={summary.purchaseYears} />
      </section>
    </section>
    <section aria-labelledby="mini-stats-heading"><h2 id="mini-stats-heading">Stats minifigurines</h2><div className="mini-summary"><span><strong>{copies.length}</strong><small>EXEMPLAIRES</small></span><span><strong>{characters.size}</strong><small>PERSONNAGES</small></span><span><strong>{duplicates}</strong><small>DOUBLONS</small></span><span><strong>{euro.format(invested)}</strong><small>INVESTIS EN MINIFIGURINES</small></span></div>
    <div className="stats breakdown-stats">
      <StatisticsBreakdown title="RÉPARTITION PAR SÉRIE" subtitle="Nombre d’exemplaires possédés" icon={<UserRound />} items={breakdown(copies.map((copy) => { const item = minis.series.find((s) => s.id === copy.seriesId); return item?.isStandalone ? 'Hors série' : item ? `${item.name}${item.reference ? ` · #${item.reference}` : ''}` : 'Série inconnue' }))} />
      <StatisticsBreakdown title="PROGRESSION DES SÉRIES" subtitle="Séries ajoutées à votre collection" icon={<Puzzle />} items={breakdown(progress)} />
      <StatisticsBreakdown title="CONDITIONS D’ACHAT" subtitle="Minifigurines neuves ou d’occasion" icon={<Tags />} items={breakdown(copies.map((copy) => copy.condition))} />
      <StatisticsBreakdown title="ANNÉES D’ACHAT" subtitle="Chronologie des exemplaires" icon={<CalendarDays />} items={breakdown(copies.map((copy) => copy.purchaseDate?.slice(0, 4) || 'Non renseignée'))} />
      <StatisticsBreakdown title="ACCESSOIRES" subtitle="Complétude des exemplaires" icon={<Box />} items={breakdown(copies.map((copy) => copy.accessoriesComplete ? 'Complets' : 'Incomplets'))} />
    </div></section>
  </section>
}
