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
}
