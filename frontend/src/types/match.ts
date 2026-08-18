export type MatchStatus = "pending" | "confirmed" | "rejected";

export interface Match {
  reportId: number;
  title: string;
  imageUrl: string | null;
  reportType: string;
  similarityScore: number | null;
  status: MatchStatus;
  createdAt: string;
}
