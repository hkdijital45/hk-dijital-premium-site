export function CustomerAgencyNotes({ notes = [] }: { notes?: any[] }) {
  if (!notes.length) return <p className="text-sm text-slate-400">Bu rapor için henüz ajans notu eklenmedi.</p>;
  return <div className="grid gap-3">{notes.map((note) => <div key={note.id} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><div className="flex flex-wrap justify-between gap-2"><h5 className="font-black text-white">{note.title}</h5><span className="text-xs text-cyan-100">{note.update_date}{note.is_pinned ? " · Sabitlendi" : ""}</span></div><p className="mt-2 text-sm leading-6 text-slate-300">{note.customer_note || note.agency_comment}</p>{note.next_action && <p className="mt-2 text-sm leading-6 text-cyan-100">Sıradaki adım: {note.next_action}</p>}</div>)}</div>;
}
