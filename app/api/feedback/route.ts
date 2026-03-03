import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email, feedback } = await req.json();

    if (!feedback?.trim()) {
      return NextResponse.json({ error: "Feedback is required" }, { status: 400 });
    }

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.error("Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars");
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `Tolerance Analyzer <${user}>`,
      to: "ideepaks92@gmail.com",
      replyTo: email || undefined,
      subject: `Tolerance Analyzer Feedback${email ? ` from ${email}` : ""}`,
      text: [
        `Feedback from: ${email || "(no email provided)"}`,
        `Date: ${new Date().toISOString()}`,
        "",
        feedback,
      ].join("\n"),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Feedback email error:", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
