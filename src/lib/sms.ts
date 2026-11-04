import "server-only";
import { SmsLog } from "./db";

export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<void>;
}

const consoleProvider: SmsProvider = {
  name: "console",
  async send(to, body) {
    console.log(`\n[sms:console] to ${to}\n${body}\n`);
  },
};

const twilioProvider: SmsProvider = {
  name: "twilio",
  async send(to, body) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set");
    const params = new URLSearchParams({ To: to, Body: body });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) params.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
    else if (process.env.TWILIO_FROM_NUMBER) params.set("From", process.env.TWILIO_FROM_NUMBER);
    else throw new Error("Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID");

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message || `Twilio responded ${res.status}`);
    }
  },
};

// Add another provider (MSG91, Vonage, AWS SNS...) by implementing SmsProvider and registering it here.
const providers: Record<string, SmsProvider> = { console: consoleProvider, twilio: twilioProvider };

export function normalizePhone(raw: string) {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  p = p.replace(/^0+/, "");
  return (process.env.SMS_DEFAULT_COUNTRY_CODE || "+91") + p;
}

/** Sends an SMS and records it in the SMS log. Never throws. */
export async function sendSms(rawTo: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const provider = providers[process.env.SMS_PROVIDER || "console"] ?? consoleProvider;
  const to = normalizePhone(rawTo);
  try {
    await provider.send(to, body);
    await SmsLog.create({ to, body, provider: provider.name, status: "SENT" });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await SmsLog.create({ to, body, provider: provider.name, status: "FAILED", error });
    return { ok: false, error };
  }
}
