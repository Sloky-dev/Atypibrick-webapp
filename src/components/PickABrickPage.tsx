import { useEffect, useMemo, useState } from 'react'
import { Box, Download, LoaderCircle, Puzzle, ExternalLink } from 'lucide-react'
import { missingPartsApi } from '../api'
import type { MissingPartsSetSummary } from '../types'

function exportCsv(groups: MissingPartsSetSummary[], filename: string) {
  const quantities = new Map<string, number>()
  groups.forEach((group) => group.parts.forEach((part) => {
    quantities.set(part.elementId, (quantities.get(part.elementId) ?? 0) + part.quantity)
  }))
  const rows = [...quantities.entries()].sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
  const content = ['elementId,quantity', ...rows.map(([elementId, quantity]) => `${elementId},${quantity}`)].join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function PickABrickPage() {
  const [groups, setGroups] = useState<MissingPartsSetSummary[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const total = useMemo(() => groups?.reduce((sum, group) => sum + group.totalQuantity, 0) ?? 0, [groups])

  useEffect(() => {
    let active = true
    setError('')
    missingPartsApi.overview().then((result) => { if (active) setGroups(result) }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Chargement impossible') })
    return () => { active = false }
  }, [retry])

  return <section className="pick-a-brick-page">
    <div className="pick-page-heading"><span className="eyebrow">PIÈCES MANQUANTES</span><h1>Pick a <em>Brick.</em></h1><p>Retrouvez les pièces à remplacer, set par set, pour compléter votre collection.</p></div>
    {groups && groups.length > 0 && <div className="pick-summary"><span><strong>{groups.length}</strong> set{groups.length > 1 ? 's' : ''} incomplet{groups.length > 1 ? 's' : ''}</span><span><strong>{total}</strong> pièce{total > 1 ? 's' : ''} manquante{total > 1 ? 's' : ''}</span><button className="button primary" onClick={() => exportCsv(groups, 'atypibrick-pieces-manquantes.csv')}><Download /> Tout exporter</button></div>}
    {groups === null && !error && <div className="part-lookup-status" role="status"><LoaderCircle /> Chargement des pièces…</div>}
    {error && <div className="form-error" role="alert">{error}<button className="button ghost" onClick={() => setRetry((value) => value + 1)}>Réessayer</button></div>}
    {groups?.length === 0 && <div className="parts-empty pick-empty"><Puzzle /><strong>Aucune pièce manquante</strong><span>Tous vos sets sont complets.</span></div>}
    <div className="pick-groups">{groups?.map((group) => <article key={group.setId}>
      <header><div><small>SET #{group.setNumber}</small><h2>{group.setName}</h2><span>{group.totalQuantity} pièce{group.totalQuantity > 1 ? 's' : ''} manquante{group.totalQuantity > 1 ? 's' : ''}</span></div><button className="button ghost" aria-label={`Exporter les pièces de ${group.setName}`} onClick={() => exportCsv([group], `atypibrick-${group.setNumber}-pieces-manquantes.csv`)}><Download /> CSV</button></header>
      <div className="pick-parts" role="region" aria-label={`Pièces manquantes de ${group.setName}`} tabIndex={0}>{group.parts.map((part) => <article className="pick-part-card" key={part.id}>
        <div className="pick-part-image">{part.imageUrl ? <img src={part.imageUrl} alt={part.name} loading="lazy" /> : <Box />}</div>
        <small>ÉLÉMENT {part.elementId}<br />DESIGN {part.designId}</small><h3>{part.name}</h3><b>× {part.quantity}</b><span className={part.inStock ? 'available' : 'unavailable'}>{part.inStock ? 'Disponible' : 'Indisponible'}</span>
        <a className="button ghost" href={`https://www.lego.com/fr-fr/pick-and-build/pick-a-brick?query=${encodeURIComponent(part.elementId)}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Voir chez LEGO</a>
      </article>)}</div>
    </article>)}</div>
  </section>
}
