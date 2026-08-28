export type DraftPayload = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  text: string;
  html: string;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

/** Normalize JSON and browser form submissions into the same draft payload. */
export async function parseDraftRequest(request: Request): Promise<DraftPayload | null> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();

  try {
    if (contentType === 'application/json') {
      const body: unknown = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
      const record = body as Record<string, unknown>;
      const values = ['to', 'cc', 'bcc', 'subject', 'text', 'html'].map((key) =>
        readString(record[key] ?? ''),
      );
      if (values.some((value) => value === null)) return null;
      return {
        to: values[0]!,
        cc: values[1]!,
        bcc: values[2]!,
        subject: values[3]!,
        text: values[4]!,
        html: values[5]!,
      };
    }

    const form = await request.formData();
    const values = ['to', 'cc', 'bcc', 'subject', 'text', 'html'].map((key) =>
      readString(form.get(key) ?? ''),
    );
    if (values.some((value) => value === null)) return null;
    return {
      to: values[0]!,
      cc: values[1]!,
      bcc: values[2]!,
      subject: values[3]!,
      text: values[4]!,
      html: values[5]!,
    };
  } catch {
    return null;
  }
}
