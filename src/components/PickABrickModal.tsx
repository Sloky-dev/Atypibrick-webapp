import { useEffect, useMemo, useState } from 'react'
import { Box, Download, LoaderCircle, Puzzle, X } from 'lucide-react'
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

export function PickABrickModal({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<MissingPartsSetSummary[] | null>(null)
  const [error, setError] = useState('')
  const total = useMemo(() => groups?.reduce((sum, group) => sum + group.totalQuantity, 0) ?? 0, [groups])

  useEffect(() => { missingPartsApi.overview().then(setGroups).catch((reason) => setError(reason instanceof Error ? reason.message : 'Chargement impossible')) }, [])

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal pick-a-brick-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">SYNTHÈSE</span><h2>Pick a Brick</h2><p className="modal-subtitle">Toutes les pièces manquantes de votre collection.</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>{groups && groups.length > 0 && <div className="pick-summary"><span><strong>{groups.length}</strong> set{groups.length > 1 ? 's' : ''} incomplet{groups.length > 1 ? 's' : ''}</span><span><strong>{total}</strong> pièce{total > 1 ? 's' : ''} manquante{total > 1 ? 's' : ''}</span><button className="button primary" onClick={() => exportCsv(groups, 'atypibrick-pieces-manquantes.csv')}><Download /> Tout exporter</button></div>}{groups === null && !error && <div className="part-lookup-status"><LoaderCircle /> Chargement des pièces…</div>}{error && <p className="form-error">{error}</p>}{groups?.length === 0 && <div className="parts-empty pick-empty"><Puzzle /><strong>Aucune pièce manquante</strong><span>Tous vos sets sont complets.</span></div>}<div className="pick-groups">{groups?.map((group) => <article key={group.setId}><header><div><small>SET #{group.setNumber}</small><strong>{group.setName}</strong><span>{group.totalQuantity} pièce{group.totalQuantity > 1 ? 's' : ''} manquante{group.totalQuantity > 1 ? 's' : ''}</span></div><button className="button ghost" onClick={() => exportCsv([group], `atypibrick-${group.setNumber}-pieces-manquantes.csv`)}><Download /> CSV</button></header><div className="pick-parts">{group.parts.map((part) => <div key={part.id}><span>{part.imageUrl ? <img src={part.imageUrl} alt="" /> : <Box />}</span><div><small>ÉLÉMENT {part.elementId} · DESIGN {part.designId}</small><strong>{part.name}</strong></div><b>× {part.quantity}</b><em className={part.inStock ? 'available' : 'unavailable'}>{part.inStock ? 'Disponible' : 'Indisponible'}</em></div>)}</div></article>)}</div><div className="modal-actions"><button className="button ghost" onClick={onClose}>Fermer</button></div></section></div>
}
