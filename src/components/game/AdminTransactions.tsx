'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cashbackAmount, formatMoney } from '@/lib/money'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AdminTx } from '@/lib/types'

type Transaction = AdminTx & { relatedTransactionId: string | null; cashbackAmount: number | null; reviewedBy: string | null; reversedBy: string | null; reversedAt: string | null; reversalReason: string | null }
type Feed = { transactions: Transaction[]; total: number; page: number; pages: number }
type Action = 'approve' | 'reject' | 'reverse'

export default function AdminTransactions() {
  const [feed, setFeed] = useState<Feed>({ transactions: [], total: 0, page: 1, pages: 1 })
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<{ record: Transaction; action: Action } | null>(null)
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [cashbacks, setCashbacks] = useState<Transaction[]>([])
  const [cashbackId, setCashbackId] = useState('')
  const [cashbackError, setCashbackError] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(() => setRevision(r => r + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ type, status, search, page: String(page), pageSize: '50' })
        const data = await api<Feed>('/api/admin/transactions?' + query, { signal: controller.signal })
        if (!controller.signal.aborted) setFeed(data)
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load transactions.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [type, status, search, page, revision])

  const expectedCashback = selected ? selected.record.cashbackAmount ?? cashbackAmount(selected.record.amount) : 0
  const legacyCashback = selected?.action === 'reverse' && selected.record.cashbackAmount == null && expectedCashback > 0
  useEffect(() => {
    if (!selected || !legacyCashback) return
    let alive = true
    setCashbacks([]); setCashbackError('')
    async function load() {
      try {
        // Traverse all matching pages so older cashback is not silently omitted.
        const result: Transaction[] = []
        let current = 1, pages = 1
        do {
          const query = new URLSearchParams({ type: 'CASHBACK', status: 'APPROVED', userId: selected!.record.user.id, page: String(current), pageSize: '100' })
          const data = await api<Feed>('/api/admin/transactions?' + query)
          result.push(...data.transactions); pages = data.pages; current++
        } while (alive && current <= pages)
        if (alive) setCashbacks(result.filter(t => Math.abs(t.amount - expectedCashback) < .001 && (!t.relatedTransactionId || t.relatedTransactionId === selected!.record.id)))
      } catch (err) { if (alive) setCashbackError(err instanceof Error ? err.message : 'Could not load cashback records.') }
    }
    load(); return () => { alive = false }
  }, [selected, legacyCashback, expectedCashback])

  function open(record: Transaction, action: Action) {
    setSelected({ record, action }); setReason(''); setAcknowledged(false); setCashbackId(''); setCashbackError('')
  }
  async function submit() {
    if (!selected || busy || !acknowledged) return
    setBusy(true)
    try {
      const result = await api<{ recovered?: number }>('/api/admin/transactions/' + encodeURIComponent(selected.record.id) + '/review', { method: 'POST', body: JSON.stringify({ action: selected.action, reason, ...(cashbackId ? { cashbackId } : {}) }) })
      toast.success(selected.action === 'reverse' ? `Deposit reversed. ${formatMoney(result.recovered ?? 0, 2)} recovered.` : selected.action === 'approve' ? 'Transaction approved.' : 'Transaction rejected.')
      setSelected(null); refresh()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Review failed.') }
    finally { setBusy(false) }
  }

  return <section className="space-y-4">
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h2 className="text-xl font-bold">All transactions</h2><p className="text-xs text-muted-foreground mt-1">Search payment records, verify TIDs and reverse incorrectly approved deposits.</p></div><Button variant="outline" onClick={refresh} disabled={loading}>Refresh</Button></div>
    <div className="grid sm:grid-cols-[1fr_180px_180px] gap-3">
      <Input aria-label="Search transactions" placeholder="TID, name, phone, transaction ID or account…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      <select aria-label="Transaction type" className="rounded-md border border-border bg-card p-2 text-sm" value={type} onChange={e => { setType(e.target.value); setPage(1) }}>{['', 'DEPOSIT', 'WITHDRAW', 'CASHBACK', 'BONUS', 'REVERSAL'].map(v => <option key={v} value={v}>{v || 'All types'}</option>)}</select>
      <select aria-label="Transaction status" className="rounded-md border border-border bg-card p-2 text-sm" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>{['', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'REVERSED', 'CANCELLED'].map(v => <option key={v} value={v}>{v || 'All statuses'}</option>)}</select>
    </div>
    <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 text-amber-200/80 p-3 text-xs leading-relaxed">Check the TID, amount and recipient against your bank/Easypaisa statement before approval. A submitted TID alone does not confirm payment. Completed withdrawals cannot be recalled from this dashboard.</p>
    {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
    <div className="border border-border rounded-xl overflow-hidden bg-card"><Table><TableHeader><TableRow><TableHead>User / date</TableHead><TableHead>Type / amount</TableHead><TableHead>TID / account</TableHead><TableHead>Status / audit</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
      {feed.transactions.map(t => <TableRow key={t.id}>
        <TableCell className="align-top"><b>{t.user.name}</b><div className="text-xs text-muted-foreground">{t.user.phone}</div><div className="text-[11px] text-muted-foreground mt-1">{new Date(t.createdAt).toLocaleString()}</div></TableCell>
        <TableCell className="align-top"><div className="text-xs text-muted-foreground">{t.type}</div><b className="font-tabular whitespace-nowrap">{formatMoney(t.amount, 2)}</b><div className="text-[10px] text-muted-foreground max-w-48 break-all mt-1">ID: {t.id}</div></TableCell>
        <TableCell className="align-top"><span className="font-mono text-xs break-all">{t.txnId || t.account || '—'}</span><div className="text-xs text-muted-foreground">{t.method}</div></TableCell>
        <TableCell className="align-top max-w-72"><b className={['REVERSED', 'REJECTED'].includes(t.status) ? 'text-red-400' : t.status === 'PENDING' ? 'text-amber-400' : 'text-green-400'}>{t.status}</b>{t.reversedAt && <div className="text-[11px] text-muted-foreground mt-1">Reversed {new Date(t.reversedAt).toLocaleString()}<br />Admin: {t.reversedBy}</div>}{t.reversalReason && <p className="text-xs mt-1 whitespace-normal break-words">Reason: {t.reversalReason}</p>}{t.note && <p className="text-[11px] text-muted-foreground mt-1 whitespace-normal break-words">{t.note}</p>}{t.relatedTransactionId && <p className="text-[10px] text-muted-foreground break-all mt-1">Linked: {t.relatedTransactionId}</p>}</TableCell>
        <TableCell className="align-top"><div className="flex flex-wrap gap-2">{t.status === 'PENDING' && ['DEPOSIT', 'WITHDRAW'].includes(t.type) && <><Button size="sm" className="bg-green-600 hover:bg-green-500" disabled={loading || busy} onClick={() => open(t, 'approve')}>Approve</Button><Button size="sm" variant="outline" disabled={loading || busy} onClick={() => open(t, 'reject')}>Reject</Button></>}{t.type === 'DEPOSIT' && t.status === 'APPROVED' && <Button size="sm" variant="destructive" disabled={loading || busy} onClick={() => open(t, 'reverse')}>Reverse approval</Button>}{t.status === 'REVERSED' && <span className="text-xs text-muted-foreground">Reversal recorded</span>}</div></TableCell>
      </TableRow>)}{!feed.transactions.length && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">{loading ? 'Loading transactions…' : 'No matching transactions.'}</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{loading ? 'Updating…' : `${feed.total} matching transactions · Page ${feed.page} of ${feed.pages}`}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={loading || feed.page <= 1} onClick={() => setPage(feed.page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={loading || feed.page >= feed.pages} onClick={() => setPage(feed.page + 1)}>Next</Button></div></div>
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected(null) }}><DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.action === 'reverse' ? 'Reverse approved deposit' : selected?.action === 'approve' ? 'Approve transaction' : 'Reject transaction'}</DialogTitle><DialogDescription>{selected?.record.user.name} · {formatMoney(selected?.record.amount ?? 0, 2)} · TID {selected?.record.txnId || '—'}</DialogDescription></DialogHeader>
      {selected?.action === 'reverse' ? <div className="space-y-3">
        <div className="rounded-lg bg-secondary p-3 text-sm space-y-1"><p>Deposit: {formatMoney(selected.record.amount, 2)}</p><p>Cashback: {formatMoney(expectedCashback, 2)}</p><p className="font-bold">Total wallet deduction: {formatMoney(selected.record.amount + expectedCashback, 2)}</p><p className="text-xs text-muted-foreground">Current balance: {formatMoney(selected.record.user.balance, 2)}. Server checks again before applying.</p></div>
        <p className="text-xs text-muted-foreground">The original deposit stays in the ledger as REVERSED. Its cashback is reversed too. This cannot undo money already paid outside the app. Insufficient balance stops the entire reversal.</p>
        {legacyCashback && <div><label htmlFor="cashback-record" className="text-xs font-bold">Select the original cashback for this older deposit</label><select id="cashback-record" className="w-full border border-border bg-card rounded p-2 mt-1 text-xs" value={cashbackId} onChange={e => setCashbackId(e.target.value)}><option value="">Verify the timestamp and select a record</option>{cashbacks.map(c => <option key={c.id} value={c.id}>{formatMoney(c.amount, 2)} · {new Date(c.processedAt || c.createdAt).toLocaleString()} · {c.id}</option>)}</select><p className="text-xs text-muted-foreground mt-1">Original approval: {selected.record.processedAt ? new Date(selected.record.processedAt).toLocaleString() : 'Unknown'}. Verify against your records; do not guess.</p>{cashbackError && <p className="text-xs text-red-400">{cashbackError}</p>}</div>}
        <label className="block text-sm" htmlFor="reversal-reason">Reason (10–500 characters)</label><textarea id="reversal-reason" className="w-full rounded-md border border-border bg-secondary p-3 text-sm min-h-24" placeholder="Example: TID not found in the verified Easypaisa statement." maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      </div> : <p className="text-sm text-muted-foreground">{selected?.action === 'approve' && selected.record.type === 'DEPOSIT' ? 'Confirm that the payment was received in your account before adding funds to this wallet.' : selected?.action === 'reject' && selected.record.type === 'WITHDRAW' ? 'The held withdrawal amount will be returned to the user wallet.' : 'This updates the transaction status and its associated wallet entry.'}</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="mt-1" />I have verified the payment records and confirm this action.</label>
      <Button variant={selected?.action === 'reverse' ? 'destructive' : 'default'} disabled={busy || !acknowledged || (selected?.action === 'reverse' && (reason.trim().length < 10 || (legacyCashback && !cashbackId)))} onClick={submit}>{busy ? 'Processing…' : selected?.action === 'reverse' ? 'Confirm reversal' : 'Confirm'}</Button>
    </DialogContent></Dialog>
  </section>
}
