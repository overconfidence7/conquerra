import type { BuildingType, SpecialistType } from "@conquerra/content";
import { useArtUrl } from "./art";

/** One of the illustrated icons (Nate's art, or its placeholder), sized for menus. Decorative: pair it with text. */
export function ArtIcon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const url = useArtUrl(name);
  return url ? <img className={`art-icon ${className}`} src={url} width={size} height={size} alt="" /> : <span className={`art-icon ${className}`} style={{ width: size, height: size }} />;
}

export const specialistIcon = (s: SpecialistType) => `icon-${s}`;
export const buildingIcon = (b: BuildingType) => `icon-${b}`;
