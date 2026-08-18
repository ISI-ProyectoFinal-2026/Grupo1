export type ReportType = "lost" | "found";
export type ReportStatus = "pending" | "published" | "rejected" | "resolved";
export type ReportFlagStatus = "pending" | "reviewed";

export interface ReportLocation {
  lat: number;
  lng: number;
}

export interface ReportTag {
  label: "PERDIDO" | "ENCONTRADO" | "RESUELTO";
  color: string;
}

export interface Report {
  id: number;
  userId: number;
  petId: number | null;
  reportType: ReportType;
  status: ReportStatus;
  title: string;
  description: string | null;
  imageUrl: string | null;
  locationAddress: string | null;
  location: ReportLocation | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  tag: ReportTag;
}

export interface CreateReportInput {
  userId: number;
  petId?: number;
  reportType: ReportType;
  title: string;
  description?: string;
  imageUrl?: string;
  location: ReportLocation;
  locationAddress?: string;
}

export type UpdateReportInput = Partial<Omit<CreateReportInput, "userId">> & {
  status?: ReportStatus;
};

export interface ListReportsFilters {
  type?: ReportType;
  status?: ReportStatus;
  breed?: string;
  zone?: string;
  dateFrom?: string;
  dateTo?: string;
  order?: "asc" | "desc";
}

export interface CloseReportInput {
  userId: number;
}

export interface ReportFlag {
  id: number;
  reportId: number;
  userId: number;
  reason: string;
  status: ReportFlagStatus;
  createdAt: string;
}

export interface CreateReportFlagInput {
  userId: number;
  reason: string;
}
