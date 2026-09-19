export type Tasting = {
  id: string;
  user_id: string;
  user_name: string;
  /** Naam van de champagne, mag meerdere woorden zijn. */
  name: string;
  /** Het oordeel in precies één woord. */
  word: string;
  score: number;
  photo_url: string;
  note: string | null;
  created_at: string;
};
