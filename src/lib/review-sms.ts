import "server-only";
import { Query } from "./db";
import { sendSms } from "./sms";
import { appUrl, ticketCode } from "./format";

export async function sendReviewSms(queryId: string) {
  const q = await Query.findById(queryId).lean();
  if (!q) throw new Error("Query not found");
  const latest = q.submissions.at(-1);
  const phone = latest?.customerPhone || q.customerPhone;
  const name = (latest?.customerName || q.customerName).split(" ")[0];
  const link = `${appUrl()}/review/${q.reviewToken}`;
  const body = `Hi ${name}, your service request ${ticketCode(q.number)} with ${process.env.APP_NAME || "Avi Infotech"} is complete. We'd love your feedback: ${link}`;
  const res = await sendSms(phone, body);
  await Query.updateOne({ _id: queryId }, { smsStatus: res.ok ? "SENT" : "FAILED" });
  return res;
}
