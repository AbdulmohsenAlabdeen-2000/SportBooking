import {
  Activity,
  CircleDot,
  Goal,
  LandPlot,
  ScanLine,
  Shrub,
  Target,
  Trophy,
  Volleyball,
  type LucideIcon,
} from "lucide-react";
import type { Dict } from "@/lib/i18n/dict.en";
import type { Sport } from "@/lib/types";

// One source of truth for the sport → Lucide icon mapping. Pages
// import this instead of redeclaring SPORT_ICON locally so adding a
// new sport only touches `types.ts`, this module, and the
// dictionaries.

export const SPORT_ICON: Record<Sport, LucideIcon> = {
  padel: Activity,
  tennis: CircleDot,
  football: LandPlot,
  squash: Target,
  basketball: Trophy,
  volleyball: Volleyball,
  cricket: Shrub,
  pickleball: ScanLine,
  badminton: Activity,
  futsal: Goal,
};

export function sportLabel(sport: Sport, t: Dict): string {
  return t.sports[sport];
}
