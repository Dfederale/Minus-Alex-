import type { GenesisRegion, SightId } from "./types";

/**
 * Genesis — screen-space / world-space map of the chamber.
 * Resolves where a visible object is so physical interaction is never blind.
 * Genesis does not click. It only answers "where".
 */
export function mapChamber(root: HTMLElement | null): GenesisRegion[] {
  if (!root) return [];
  const chamber = root.getBoundingClientRect();
  const regions: GenesisRegion[] = [];
  root.querySelectorAll<HTMLElement>("[data-sight]").forEach((node) => {
    const id = node.dataset.sight as SightId | undefined;
    if (!id) return;
    const box = node.getBoundingClientRect();
    regions.push({
      id,
      label: node.dataset.label ?? id,
      x: box.left - chamber.left,
      y: box.top - chamber.top,
      width: box.width,
      height: box.height,
      cx: box.left - chamber.left + box.width / 2,
      cy: box.top - chamber.top + box.height / 2,
    });
  });
  return regions;
}

export function resolveRegion(
  regions: GenesisRegion[],
  id: SightId,
): GenesisRegion | undefined {
  return regions.find((region) => region.id === id);
}

export function formatCoords(region: Pick<GenesisRegion, "cx" | "cy"> | null | undefined): string {
  if (!region) return "—";
  return `${Math.round(region.cx)}, ${Math.round(region.cy)}`;
}
