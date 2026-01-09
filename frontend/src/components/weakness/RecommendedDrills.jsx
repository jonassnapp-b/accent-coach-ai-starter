export default function RecommendedDrills({ weaknesses }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Recommended drills</h3>

      {weaknesses.map(w => (
        <div key={w.label} className="mb-4">
          <div className="font-mono">/{w.label}/</div>
          <ul className="list-disc ml-5 text-sm text-gray-600">
            <li>Minimal pairs drill</li>
            <li>Word repetition</li>
            <li>Sentence focus</li>
          </ul>
        </div>
      ))}
    </div>
  );
}
