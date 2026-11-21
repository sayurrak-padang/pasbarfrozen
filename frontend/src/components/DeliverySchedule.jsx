import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api";

const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

export const DeliverySchedule = ({ value, onChange, po = false }) => {
  const [days, setDays] = useState([]);

  useEffect(() => {
    api.get("/shipping/schedule").then(({ data: raw }) => {
      const data = po ? raw.map((d, i) => (i === 0 ? { ...d, slots: d.slots.map((s) => ({ ...s, available: false })) } : d)) : raw;
      setDays(data);
      const firstDay = data.find((d) => d.slots.some((s) => s.available));
      const firstSlot = firstDay?.slots.find((s) => s.available);
      if (firstDay && firstSlot) onChange({ date: firstDay.date, slot: firstSlot.slot });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const day = days.find((d) => d.date === value?.date);

  return (
    <div className="mt-3 bg-amber-50/60 border border-amber-100 rounded-xl p-3" data-testid="delivery-schedule">
      <p className="text-xs font-semibold flex items-center gap-1.5 mb-2"><CalendarClock className="w-4 h-4 text-amber-600" /> Jadwal Pengiriman Instan</p>
      <div className="grid grid-cols-3 gap-2">
        {days.map((d, i) => {
          const open = d.slots.some((s) => s.available);
          return (
            <button key={d.date} type="button" disabled={!open} data-testid={`schedule-day-${d.date}`}
              onClick={() => onChange({ date: d.date, slot: d.slots.find((s) => s.available)?.slot })}
              className={`rounded-lg border-2 py-1.5 text-center transition-colors disabled:opacity-40 ${value?.date === d.date ? "border-primary bg-white" : "border-transparent bg-white/70"}`}>
              <p className="text-xs font-semibold">{d.label}</p>
              <p className="text-[10px] text-muted-foreground">{open ? fmt(d.date) : po && i === 0 ? "PO H+1" : "Penuh"}</p>
            </button>
          );
        })}
      </div>
      {day && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {day.slots.map((s) => (
            <button key={s.slot} type="button" disabled={!s.available} data-testid={`schedule-slot-${s.slot}`}
              onClick={() => onChange({ date: day.date, slot: s.slot })}
              className={`rounded-lg border text-xs py-1.5 font-medium transition-colors disabled:opacity-40 disabled:line-through ${value?.slot === s.slot ? "border-primary bg-primary text-white" : "bg-white"}`}>
              {s.slot.replace("-", " – ")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
