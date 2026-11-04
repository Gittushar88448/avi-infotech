// MongoDB connection and Mongoose models.
import mongoose, { Schema, Types, model, models, type Model } from "mongoose";

const g = globalThis as unknown as { __mongoose?: Promise<typeof mongoose> };

/** Opens one shared connection per server process. Mongoose queues queries until it is ready. */
export function connectDB() {
  if (!g.__mongoose) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set. Add it to your .env file.");
    g.__mongoose = mongoose.connect(uri).catch((e) => {
      g.__mongoose = undefined;
      throw e;
    });
  }
  return g.__mongoose;
}
if (process.env.MONGODB_URI) connectDB().catch((e) => console.error("[mongodb] connection failed:", e.message));

const { ObjectId } = Schema.Types;
type Id = Types.ObjectId;

export interface ILocation { lat: number; lng: number; accuracy: number; heading?: number | null; speed?: number | null; at: Date }
export interface IUser {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: "ADMIN" | "TECHNICIAN";
  active: boolean;
  /** Set for self sign-ups until an admin approves them. */
  pendingApproval: boolean;
  sessionVersion: number;
  resetTokenHash?: string;
  resetTokenExpiry?: Date;
  /** Latest position reported by the technician's browser while location sharing is on. */
  lastLocation?: ILocation;
  createdAt: Date;
  updatedAt: Date;
}
export interface IAssignment { _id?: Id; user: Id | string; acceptedAt?: Date; assignedAt?: Date }
export interface ISubmission {
  _id?: Id;
  technician: Id | string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  photos: string[];
  createdAt?: Date;
}
export interface IActivity { _id?: Id; actor?: Id | string; message: string; createdAt?: Date }
export interface IQuery {
  number: number;
  title: string;
  description: string;
  deviceType: string;
  priority: string;
  status: string;
  customerName: string;
  customerPhone: string;
  siteAddress: string;
  scheduledFor?: Date;
  reviewToken?: string;
  smsStatus?: string;
  completedAt?: Date;
  createdBy: Id | string;
  assignments: IAssignment[];
  submissions: ISubmission[];
  activities: IActivity[];
  createdAt: Date;
  updatedAt: Date;
}
export interface IReview { query: Id | string; rating: number; comment: string; customerName: string; published: boolean; createdAt: Date; updatedAt: Date }
export interface INotification { user: Id | string; title: string; body: string; link?: string; read: boolean; createdAt: Date; updatedAt: Date }
export interface ILocationPing { user: Id | string; lat: number; lng: number; accuracy: number; createdAt: Date }
export interface ISettings { _id: string; locationTracking: boolean; updatedBy?: Id | string; updatedAt: Date }
export interface ISmsLog { to: string; body: string; provider: string; status: "SENT" | "FAILED"; error?: string; createdAt: Date; updatedAt: Date }

// ── Users ───────────────────────────────────────────
const locationSchema = new Schema<ILocation>(
  { lat: Number, lng: Number, accuracy: Number, heading: Number, speed: Number, at: Date },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "TECHNICIAN"], default: "TECHNICIAN" },
    active: { type: Boolean, default: true },
    pendingApproval: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0 },
    resetTokenHash: { type: String, index: true },
    resetTokenExpiry: { type: Date },
    lastLocation: { type: locationSchema },
  },
  { timestamps: true },
);

// ── Queries (jobs) ──────────────────────────────────
// Assignments, submissions and the activity log live inside the query document.
const assignmentSchema = new Schema<IAssignment>({
  user: { type: ObjectId, ref: "User", required: true },
  acceptedAt: { type: Date },
  assignedAt: { type: Date, default: Date.now },
});

const submissionSchema = new Schema<ISubmission>({
  technician: { type: ObjectId, ref: "User", required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerAddress: { type: String, required: true },
  notes: { type: String, default: "" },
  photos: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const activitySchema = new Schema<IActivity>({
  actor: { type: ObjectId, ref: "User" },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const STATUSES = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REWORK", "COMPLETED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const querySchema = new Schema<IQuery>(
  {
    number: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    deviceType: { type: String, required: true },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    // ASSIGNED -> IN_PROGRESS -> SUBMITTED -> COMPLETED  (REWORK sends it back)
    status: { type: String, enum: STATUSES, default: "ASSIGNED" },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    siteAddress: { type: String, required: true },
    scheduledFor: { type: Date },
    reviewToken: { type: String },
    smsStatus: { type: String },
    completedAt: { type: Date },
    createdBy: { type: ObjectId, ref: "User", required: true },
    assignments: { type: [assignmentSchema], default: [] },
    submissions: { type: [submissionSchema], default: [] },
    activities: { type: [activitySchema], default: [] },
  },
  { timestamps: true },
);
querySchema.index({ status: 1, updatedAt: -1 });
querySchema.index({ "assignments.user": 1, status: 1 });
querySchema.index({ reviewToken: 1 }, { unique: true, sparse: true });

// ── Reviews ─────────────────────────────────────────
const reviewSchema = new Schema<IReview>(
  {
    query: { type: ObjectId, ref: "Query", required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    customerName: { type: String, required: true },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);
reviewSchema.index({ published: 1, createdAt: -1 });

// ── Notifications, SMS log, counters ────────────────
const notificationSchema = new Schema<INotification>(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const smsLogSchema = new Schema<ISmsLog>(
  {
    to: { type: String, required: true },
    body: { type: String, required: true },
    provider: { type: String, required: true },
    status: { type: String, enum: ["SENT", "FAILED"], required: true },
    error: { type: String },
  },
  { timestamps: true },
);

// ── Live location ───────────────────────────────────
// Location history for the map trail. Old points are removed automatically by MongoDB (TTL index).
const locationPingSchema = new Schema<ILocationPing>(
  {
    user: { type: ObjectId, ref: "User", required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
locationPingSchema.index({ user: 1, createdAt: -1 });
locationPingSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * Math.max(1, Number(process.env.LOCATION_HISTORY_DAYS) || 7) });

// App-wide switches set by admins. One document with _id "app".
const settingsSchema = new Schema<ISettings>(
  {
    _id: { type: String, required: true },
    locationTracking: { type: Boolean, default: true },
    updatedBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

const counterSchema = new Schema<{ _id: string; value: number }>({ _id: { type: String, required: true }, value: { type: Number, required: true } });

// Reuses the compiled model across hot reloads. Typed by hand: letting TypeScript infer
// Mongoose's model generics from the schema is very slow.
export function getModel<T>(name: string, schema: unknown, collection: string): Model<T> {
  return ((models[name] as unknown) ?? model(name, schema as Schema, collection)) as Model<T>;
}

export const User = getModel<IUser>("User", userSchema, "users");
export const Query = getModel<IQuery>("Query", querySchema, "queries");
export const Review = getModel<IReview>("Review", reviewSchema, "reviews");
export const Notification = getModel<INotification>("Notification", notificationSchema, "notifications");
export const SmsLog = getModel<ISmsLog>("SmsLog", smsLogSchema, "sms_logs");
export const LocationPing = getModel<ILocationPing>("LocationPing", locationPingSchema, "location_pings");
export const Settings = getModel<ISettings>("Settings", settingsSchema, "settings");
export const Counter = getModel<{ _id: string; value: number }>("Counter", counterSchema, "counters");

/** MongoDB ids are 24 hex characters. Checked before querying so bad URLs give a 404, not a crash. */
export const isId = (v: unknown): v is string => typeof v === "string" && Types.ObjectId.isValid(v) && /^[a-f\d]{24}$/i.test(v);
export const oid = (v: string) => new Types.ObjectId(v);
export const sameId = (a: unknown, b: unknown) => String(a) === String(b);

/** Increments and returns a named sequence (1, 2, 3, ...) stored in the counters collection. */
export async function nextSequence(name: string) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return c!.value;
}

/** Next ticket number (Q-1001, Q-1002, ...) from an atomic counter document. */
export async function nextQueryNumber() {
  return 1000 + (await nextSequence("query"));
}

/** Number of open (not yet submitted) jobs per technician id. */
export async function openJobCounts(): Promise<Record<string, number>> {
  const rows = await Query.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: { $in: ["ASSIGNED", "IN_PROGRESS", "REWORK"] } } },
    { $unwind: "$assignments" },
    { $group: { _id: "$assignments.user", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
}

type Person = { _id: Types.ObjectId; name: string; phone?: string | null } | null;

/** Loads a query with people populated, shaped for the detail pages (newest submission and activity first). */
export async function loadQueryDetail(filter: Record<string, unknown>) {
  const doc = await Query.findOne(filter)
    .populate("createdBy", "name")
    .populate("assignments.user", "name phone")
    .populate("submissions.technician", "name")
    .lean();
  if (!doc) return null;
  const person = (p: unknown) => p as Person;
  const review = await Review.findOne({ query: doc._id }).lean();
  return {
    ...doc,
    id: String(doc._id),
    createdBy: { name: person(doc.createdBy)?.name ?? "Unknown" },
    assignments: doc.assignments.map((a) => ({
      id: String(a._id),
      userId: String(person(a.user)?._id ?? a.user),
      user: { name: person(a.user)?.name ?? "Removed user", phone: person(a.user)?.phone ?? null },
      acceptedAt: a.acceptedAt ?? null,
    })),
    submissions: [...doc.submissions].reverse().map((s) => ({
      ...s,
      id: String(s._id),
      createdAt: s.createdAt ?? doc.updatedAt,
      technician: { name: person(s.technician)?.name ?? "Technician" },
      photos: s.photos.map((fileName) => ({ fileName })),
    })),
    activities: [...doc.activities].reverse().map((a) => ({ id: String(a._id), message: a.message, createdAt: a.createdAt ?? doc.createdAt })),
    review,
  };
}
