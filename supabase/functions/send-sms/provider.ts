// SMS provider abstraction. The rest of the Messages module (schema, RLS,
// UI, recipient picker, templates, logs) is built and fully testable
// against MockProvider without ever touching Arkesel — flip SMS_MODE=live
// once real credentials are provisioned and nothing else changes.

export interface SendResult {
  phone: string;
  status: "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  send(recipients: string[], body: string): Promise<SendResult[]>;
  getBalance(): Promise<{ balance: number; currency: string }>;
}

// Simulates success for every recipient, no network call, no cost. A
// recipient number ending in the digit 0 is deliberately made to "fail" —
// gives the Logs UI something real to render (a partially_failed batch)
// without needing a live provider to exercise that path.
export class MockProvider implements SmsProvider {
  async send(recipients: string[], _body: string): Promise<SendResult[]> {
    return recipients.map((phone) => {
      const fails = phone.endsWith("0");
      return fails
        ? { phone, status: "failed" as const, errorMessage: "Simulated failure (mock mode)" }
        : { phone, status: "sent" as const, providerMessageId: `mock-${crypto.randomUUID()}` };
    });
  }

  async getBalance() {
    return { balance: 1000, currency: "GHS" };
  }
}

// Arkesel's v2 REST API (https://sms.arkesel.com/api/v2). Untested against
// a live account — built to the documented request/response shape; treat
// as a starting point to verify against the real API once credentials are
// available, not as a guarantee it's byte-perfect.
export class ArkeselProvider implements SmsProvider {
  #apiKey: string;
  #senderId: string;
  #baseUrl = "https://sms.arkesel.com/api/v2";

  constructor(apiKey: string, senderId: string) {
    this.#apiKey = apiKey;
    this.#senderId = senderId;
  }

  async send(recipients: string[], body: string): Promise<SendResult[]> {
    const res = await fetch(`${this.#baseUrl}/sms/send`, {
      method: "POST",
      headers: { "api-key": this.#apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: this.#senderId, message: body, recipients }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || json?.status !== "success") {
      const errorMessage = json?.message ?? `Arkesel send failed (HTTP ${res.status})`;
      return recipients.map((phone) => ({ phone, status: "failed" as const, errorMessage }));
    }

    // Arkesel returns one entry per recipient under `data`, each carrying
    // its own id — map them back onto the recipients we sent in the same
    // order rather than assuming array positions always line up.
    const data: Array<{ recipient?: string; id?: string }> = json.data ?? [];
    return recipients.map((phone, i) => ({
      phone,
      status: "sent" as const,
      providerMessageId: data[i]?.id ?? undefined,
    }));
  }

  async getBalance() {
    const res = await fetch(`${this.#baseUrl}/clients/balance-details`, {
      headers: { "api-key": this.#apiKey },
    });
    if (!res.ok) throw new Error(`Arkesel balance check failed (HTTP ${res.status})`);
    const json = await res.json();
    return { balance: Number(json?.data?.sms_balance ?? 0), currency: "GHS" };
  }
}

export function getProvider(): SmsProvider {
  const mode = Deno.env.get("SMS_MODE") ?? "mock";
  if (mode === "live") {
    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    const senderId = Deno.env.get("ARKESEL_SENDER_ID");
    if (!apiKey || !senderId) {
      throw new Error("SMS_MODE=live requires ARKESEL_API_KEY and ARKESEL_SENDER_ID secrets to be set");
    }
    return new ArkeselProvider(apiKey, senderId);
  }
  return new MockProvider();
}
