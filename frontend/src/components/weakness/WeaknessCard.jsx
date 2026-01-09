export default function WeaknessCard({ weakness }) {
  return (
    <div className="border rounded-lg p-4 flex justify-between items-center">
      <div>
        <div className="font-mono text-lg">/{weakness.label}/</div>
        <div className="text-sm text-gray-500">
          Avg: {Math.round(weakness.avg)} · Count: {weakness.count}
        </div>
      </div>

      <button className="text-sm font-medium text-[#FF9800]">
        Train this
      </button>
    </div>
  );
}
