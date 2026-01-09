// src/components/settings/SettingRow.jsx
export default function SettingRow({ title, description, right }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {description ? <div className="text-sm text-slate-600">{description}</div> : null}
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}
