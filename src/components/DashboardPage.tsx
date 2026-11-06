import { useEffect, useState } from 'react'
import { Box, CalendarDays, Palette, Puzzle, Tags, UserRound } from 'lucide-react'
import { minifigureApi, type MiniSummary } from '../minifigures'
import type { CollectionSummary, CollectionFilters } from '../types'
import { StatisticsBreakdown } from './StatisticsBreakdown'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export function DashboardPage({ onSelect, summary, summaryError, onRetrySummary }: { onSelect: (filters: Partial<CollectionFilters>) => void; summary: CollectionSummary | null; summaryError: string; onRetrySummary: () => void }) {
  const [data, setData] = useState<MiniSummary | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    minifigureApi.summary().then((minis) => { if (active) setData(minis) }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible') })
    return () => { active = false }
  }, [retry])
  const retryLoading = () => { if (summaryError) onRetrySummary(); if (error) setRetry((value) => value + 1) }
  const loadingError = summaryError || error
  if (!data || !summary) return <section className="dashboard-page"><div className="pick-page-heading"><h1>Dashboard</h1></div>{loadingError ? <div role="alert">{loadingError}<button className="button" onClick={retryLoading}>Réessayer</button></div> : <p role="status">Chargement des statistiques…</p>}</section>
  const minis = data
  return <section className="dashboard-page">{loadingError && <div className="error" role="alert">{loadingError}<button onClick={retryLoading}>Réessayer les statistiques</button></div>}<div className="pick-page-heading"><span className="eyebrow">VUE D’ENSEMBLE</span><h1>Dashboard</h1><p>Les statistiques de vos sets et de vos minifigurines, réunies au même endroit.</p></div>
    <section aria-labelledby="set-stats-heading"><h2 id="set-stats-heading">Stats sets</h2><div className="mini-summary"><span><strong>{summary.itemCount}</strong><small>EXEMPLAIRES</small></span><span><strong>{summary.totalParts.toLocaleString('fr-FR')}</strong><small>BRIQUES</small></span><span><strong>{euro.format(Number(summary.totalInvested) - Number(summary.minifigureInvested || 0))}</strong><small>INVESTIS HORS MINIFIGURINES</small></span></div>
      <section className="stats breakdown-stats" id="stats">
        <StatisticsBreakdown title="RÉPARTITION PAR MARQUE" subtitle="Marques de votre collection" icon={<Box />} items={summary.brands} onSelect={(item) => onSelect({ brand: item.label as CollectionFilters['brand'] })} />
        <StatisticsBreakdown title="NOMBRE DE BRIQUES PAR MARQUE" subtitle="Total des pièces renseignées" icon={<Puzzle />} items={summary.partsByBrand ?? []} onSelect={(item) => onSelect({ brand: item.label as CollectionFilters['brand'] })} />
        <StatisticsBreakdown title="RÉPARTITION PAR THÈME" subtitle="Univers les plus présents" icon={<Palette />} items={summary.themes} formatLabel={(item) => item.brands?.length ? `${item.label} (${item.brands.join(', ')})` : item.label} onSelect={(item) => onSelect({ theme: item.label })} />
        <StatisticsBreakdown title="CONDITIONS D’ACHAT" subtitle="Sets achetés neufs ou d’occasion" icon={<Tags />} items={summary.conditions} />
        <StatisticsBreakdown title="ANNÉES D’ACHAT" subtitle="Chronologie de la collection" icon={<CalendarDays />} items={summary.purchaseYears} />
      </section>
    </section>
    <section aria-labelledby="mini-stats-heading"><h2 id="mini-stats-heading">Stats minifigurines</h2><div className="mini-summary"><span><strong>{minis.copyCount}</strong><small>EXEMPLAIRES</small></span><span><strong>{minis.characterCount}</strong><small>PERSONNAGES</small></span><span><strong>{minis.duplicateCount}</strong><small>DOUBLONS</small></span><span><strong>{euro.format(Number(minis.invested))}</strong><small>INVESTIS EN MINIFIGURINES</small></span></div>
    <div className="stats breakdown-stats">
      <StatisticsBreakdown title="RÉPARTITION PAR SÉRIE" subtitle="Nombre d’exemplaires possédés" icon={<UserRound />} items={minis.bySeries} />
      <StatisticsBreakdown title="PROGRESSION DES SÉRIES" subtitle="Séries ajoutées à votre collection" icon={<Puzzle />} items={minis.seriesProgress} />
      <StatisticsBreakdown title="CONDITIONS D’ACHAT" subtitle="Minifigurines neuves ou d’occasion" icon={<Tags />} items={minis.conditions} />
      <StatisticsBreakdown title="ANNÉES D’ACHAT" subtitle="Chronologie des exemplaires" icon={<CalendarDays />} items={minis.purchaseYears} />
      <StatisticsBreakdown title="ACCESSOIRES" subtitle="Complétude des exemplaires" icon={<Box />} items={minis.accessories} />
    </div></section>
  </section>
}
