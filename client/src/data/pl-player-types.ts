export interface ClubStats {
  appearances: number;
  goals: number;
  assists: number;
}

export interface PLPlayer {
  displayName: string;
  firstName: string;
  lastName: string;
  position: string;
  nationality: string;
  dob: string;
  clubs: Record<string, ClubStats>;
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
  /** Start year of the last PL season they played, e.g. 2025 for 2025/26 */
  lastSeason?: number | null;
}
