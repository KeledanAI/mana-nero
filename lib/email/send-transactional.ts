import { Resend } from "resend";

import {
  buildManaNeroEmailHtml,
  type ManaNeroEmailSection,
} from "@/lib/email/layout";
import { manaNeroEmailFrom } from "@/lib/email/constants";

let client: Resend | null = null;

function getResend(): Resend {
  if (!client) {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(key);
  }
  return client;
}

export type SendManaNeroEmailOptions = {
  to: string | string[];
  subject: string;
  sections: ManaNeroEmailSection[];
  replyTo?: string;
};

export async function sendManaNeroEmail(
  options: SendManaNeroEmailOptions,
): Promise<{ id: string }> {
  const html = buildManaNeroEmailHtml(options.sections);

  const { data, error } = await getResend().emails.send({
    from: manaNeroEmailFrom(),
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    html,
    replyTo: options.replyTo,
  });

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id) {
    throw new Error("Resend did not return an email id");
  }
  return { id: data.id };
}

export { buildManaNeroEmailHtml, type ManaNeroEmailSection };
