export type Role = "CUSTOMER" | "AGENT" | "ADMIN";
export type TicketStatus =
  | "New"
  | "PendingWorkerResponse"
  | "Accepted"
  | "InProgress"
  | "Completed"
  | "Rejected"
  | "Cancelled";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketEventType = "STATUS_CHANGE" | "ASSIGNED" | "REOPENED";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarHue: number;
  createdAt: string;
};

export type TicketEvent = {
  id: string;
  ticketId: string;
  type: TicketEventType;
  fromValue: string | null;
  toValue: string | null;
  actorId: string;
  createdAt: string;
  actor?: PublicUser;
};

export type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority | null;
  category: string | null;
  customerId: string;
  assignedAgentId: string | null;
  suggestedWorkerIds?: string[];
  aiSummary: string | null;
  aiCategory: string | null;
  aiPriority: string | null;
  aiFailed: boolean;
  aiConfidenceRaw: unknown;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: PublicUser;
  assignedAgent?: PublicUser | null;
  _count?: { messages: number };
  messages?: Message[];
  events?: TicketEvent[];
  possibleDuplicates?: Ticket[];
  workerRating?: { id: string; stars: number; comment?: string | null } | null;
};

export type Message = {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: Role;
  body: string;
  createdAt: string;
  sender?: PublicUser | null;
};

export type Stats = {
  highPriorityCount?: number;
  highPriorityTrend?: number;
  normalPriorityCount?: number;
  normalPriorityTrend?: number;
  avgResolutionTimeMinutes?: number;
  avgResolutionTrend?: number;
  categoryBreakdown?: { category: string; count: number }[];
  workerResponseRate?: { accepted: number; rejected: number };
  flowCounts?: {
    New: number;
    PendingWorkerResponse: number;
    Accepted: number;
    InProgress: number;
    Completed: number;
    Rejected: number;
    Cancelled: number;
  };
  ticketsPerDay?: { date: string; count: number }[];
  ratingTrend?: { date: string; avgRating: number }[];
  myAvgRating?: number;
  myRatingTrend?: { stars: number; createdAt: string }[];
  new: number;
  assigned: number;
  open: number;
  inProgress: number;
  resolved: number;
  high: number;
  total: number;
  assignedToday: number;
  reopened: number;
  resolvedToday: number;
  avgResolutionHours: number;
  priorityMix: { low: number; medium: number; high: number };
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
};

export type AiPreview = {
  text: string;
  source: string;
  triage?: {
    category: string;
    priority: TicketPriority;
    summary: string;
  };
};

export type WorkerReview = {
  stars: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
};

export type WorkerProfile = {
  id: string;
  name: string;
  email: string;
  avatarHue: number;
  category: string | null;
  avgRating: number;
  ratingCount: number;
  isAvailable: boolean;
  activeTickets: number;
  completedTickets: number;
  replyCount: number;
  recentReviews: WorkerReview[];
};

export type AdminOverview = {
  workers: WorkerProfile[];
  customerQueries: Ticket[];
  summary: {
    newQueries: number;
    pendingSelection: number;
    activeTickets: number;
    completedTickets: number;
    availableWorkers: number;
    totalWorkers: number;
  };
};

export type AdminWorkerDetail = {
  worker: WorkerProfile;
  reviews: WorkerReview[];
  tickets: Ticket[];
};
