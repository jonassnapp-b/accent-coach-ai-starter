import WeaknessCard from "./WeaknessCard";

export default function WeaknessList({ weaknesses }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Top weaknesses</h3>
      {weaknesses.map(w => (
        <WeaknessCard key={w.label} weakness={w} />
      ))}
    </div>
  );
}
