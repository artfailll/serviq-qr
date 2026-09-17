// Kasa ve garson ekranında "şu an kim çalışıyor" seçimi.
// Seçim cihazda saklanır (tablet kasada, telefon garsonda farklı kişi olabilir);
// girilen sipariş ve alınan tahsilat bu kişiye yazılır, vardiya raporu buradan
// beslenir.
import { useState } from 'react'
import { UserRound, Check, CircleUser, PlayCircle } from 'lucide-react'
import {
  useStaff, useShifts, useActiveStaff, setActiveStaffId, startShift, STAFF_ROLES,
} from '../lib/store'
import { Modal } from './ui'
import { timeOfDay } from '../lib/format'

const roleLabel = (key) => STAFF_ROLES.find((r) => r.key === key)?.label || key

export default function StaffPicker({ bizId, compact = false }) {
  const members = useStaff(bizId)
  const shifts = useShifts(bizId)
  const { member, onShift } = useActiveStaff(bizId)
  const [open, setOpen] = useState(false)

  // Hiç personel tanımlanmamışsa ekranı kalabalıklaştırma.
  if (!members.length) return null

  function pick(m) {
    setActiveStaffId(bizId, m.id)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`btn-outline !py-2 ${member ? '' : '!border-amber-300 !text-amber-700 !bg-amber-50'}`}
        title="Çalışan personeli seç"
      >
        <CircleUser className="h-4 w-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {member ? member.name.split(' ')[0] : 'Personel seç'}
        </span>
        {member && (
          <span className={`h-2 w-2 rounded-full ${onShift ? 'bg-green-500' : 'bg-ink-300'}`} />
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Şu an kim çalışıyor?"
        footer={
          member && (
            <button
              onClick={() => { setActiveStaffId(bizId, null); setOpen(false) }}
              className="btn-ghost w-full text-ink-500"
            >
              Seçimi kaldır
            </button>
          )
        }
      >
        <p className="mb-3 text-sm text-ink-500">
          Girdiğiniz sipariş ve aldığınız tahsilat seçili personele yazılır.
          Vardiya raporunda ciro buradan ayrışır.
        </p>
        <div className="space-y-2">
          {members.map((m) => {
            const shift = shifts.find((s) => s.staffId === m.id && s.status === 'open')
            const selected = member?.id === m.id
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-colors
                  ${selected ? 'border-brand-400 bg-brand-50' : 'border-ink-100 hover:border-ink-200'}`}
              >
                <button onClick={() => pick(m)} className="flex grow items-center gap-3 text-left cursor-pointer">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 font-bold border border-ink-100">
                    {m.name?.slice(0, 1).toLocaleUpperCase('tr-TR') || <UserRound className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-ink-800 truncate">{m.name}</span>
                    <span className="block text-xs text-ink-400">
                      {roleLabel(m.role)}
                      {shift ? ` · vardiya ${timeOfDay(shift.startedAt)}'den beri açık` : ' · vardiya kapalı'}
                    </span>
                  </span>
                </button>
                {shift ? (
                  selected && <Check className="h-5 w-5 shrink-0 text-brand-600" />
                ) : (
                  <button
                    onClick={() => { startShift(bizId, m.id); pick(m) }}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 cursor-pointer"
                    title="Vardiyayı başlat ve bu kişiyi seç"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Vardiya aç
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
