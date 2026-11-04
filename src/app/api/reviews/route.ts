import { z } from "zod";
import { Query, Review } from "@/lib/db";
import { fail, ok, parseJson } from "@/lib/api";
import { adminIds, notify } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { ticketCode } from "@/lib/format";

const Body = z.object({
  token: z.string().min(10),
  rating: z.number().int().min(1, "Pick a star rating").max(5),
  comment: z.string().trim().min(3, "Write a few words about the service").max(2000),
  name: z.string().trim().min(1, "Add your name").max(80),
});

/** Public: customers submit a review using the link from their SMS. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`review:${ip}`, 20)) return fail("Too many requests", 429);
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const { token, rating, comment, name } = parsed.data;
  const q = await Query.findOne({ reviewToken: token, status: "COMPLETED" }).select("number").lean();
  if (!q) return fail("This review link isn't valid", 404);
  try {
    await Review.create({ query: q._id, rating, comment, customerName: name });
  } catch (e) {
    // The unique index on `query` allows one review per job.
    if ((e as { code?: number }).code === 11000) return fail("A review was already submitted for this service. Thank you!");
    throw e;
  }
  await notify(await adminIds(), { title: `New ${rating}★ review`, body: `${name} reviewed ${ticketCode(q.number)}`, link: `/admin/reviews` });
  return ok();
}
