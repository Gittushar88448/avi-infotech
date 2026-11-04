import "server-only";

export async function sendEmail(to: string, subject: string, text: string, html: string) {
  const provider = process.env.EMAIL_PROVIDER || "console";
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text, html }),
    });
    if (!res.ok) console.error("[mail:resend] failed", res.status, await res.text());
    return;
  }
  console.log(`\n[mail:console] to ${to}\nSubject: ${subject}\n${text}\n`);
}
