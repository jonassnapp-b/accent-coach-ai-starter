export async function getWeaknessOverview() {
      console.log("[weakness.js] getWeaknessOverview() CALLED"); // <--- add this
  const res = await fetch("/api/weakness/overview");
  const data = await res.json();

  // Normalize API shapes (backend may return topWeaknesses or items)
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.topWeaknesses)
      ? data.topWeaknesses
      : [];

  return {
    ...data,
    items,
  };
}
