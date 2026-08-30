import { buildSchema } from "graphql";

export const schema = buildSchema(`
  enum Role {
    CUSTOMER
    AGENT
    ADMIN
  }

  enum TicketStatus {
    New
    PendingWorkerResponse
    Accepted
    InProgress
    Completed
    Rejected
    Cancelled
  }

  enum TicketPriority {
    LOW
    MEDIUM
    HIGH
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    avatarHue: Int
    category: String
    avgRating: Float
    ratingCount: Int
    isAvailable: Boolean
  }

  type Message {
    id: ID!
    ticketId: String!
    senderId: String!
    senderRole: Role!
    body: String!
    createdAt: String!
    sender: User
  }

  type TicketEvent {
    id: ID!
    ticketId: String!
    type: String!
    fromValue: String
    toValue: String
    actorId: String!
    createdAt: String!
  }

  type WorkerRating {
    id: ID!
    ticketId: String!
    stars: Int!
    comment: String
  }

  type Ticket {
    id: ID!
    ticketNumber: String!
    customerId: String!
    customer: User
    assignedAgentId: String
    assignedAgent: User
    subject: String!
    description: String!
    category: String
    priority: TicketPriority
    status: TicketStatus!
    urgency: TicketPriority
    rejectionReason: String
    aiSummary: String
    aiCategory: String
    aiPriority: String
    resolutionNote: String
    createdAt: String!
    updatedAt: String!
    messages: [Message!]
    events: [TicketEvent!]
    workerRating: WorkerRating
  }

  type CategoryCount {
    category: String!
    count: Int!
  }

  type DayCount {
    date: String!
    count: Int!
  }

  type FlowCounts {
    New: Int!
    PendingWorkerResponse: Int!
    Accepted: Int!
    InProgress: Int!
    Completed: Int!
    Rejected: Int!
    Cancelled: Int!
  }

  type DashboardStats {
    total: Int!
    open: Int!
    inProgress: Int!
    resolved: Int!
    high: Int!
    categoryBreakdown: [CategoryCount!]!
    flowCounts: FlowCounts!
    ticketsPerDay: [DayCount!]!
    myAvgRating: Float
  }

  type QueueStatus {
    pending: Int!
    processed: Int!
    failed: Int!
    isRedisActive: Boolean!
  }

  type Query {
    me: User
    tickets(status: String, priority: String, category: String, mine: Boolean): [Ticket!]!
    ticket(id: ID!): Ticket
    workers: [User!]!
    stats: DashboardStats
    queueStatus: QueueStatus!
  }

  type Mutation {
    createTicket(subject: String!, description: String!, category: String): Ticket!
    addMessage(ticketId: ID!, body: String!): Message!
    changeTicketStatus(ticketId: ID!, status: String!, resolutionNote: String): Ticket!
  }
`);
