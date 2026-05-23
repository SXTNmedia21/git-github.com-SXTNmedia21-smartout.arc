/**
 * onesignal — single push-send helper for the OneSignal REST API.
 *
 * Targets recipients by OneSignal External ID (= Smartout profile_id), set
 * client-side via OneSignal.login(profile_id). No device token is stored in
 * our DB — OneSignal owns the device registry.
 *
 * Returns `recipients` so callers can detect "no subscribed device" (0) and
 * apply their own fallback (e.g. push-dispatch SMS for critical events).
 */
export type SendOneSignalPushInput = {
  appId: string;
  restApiKey: string;
  externalIds: string[];
  title: string;
  body: string;
  /** Deep link opened when the user taps the notification (PWA route URL). */
  url?: string;
  data?: Record<string, string>;
};

export type SendOneSignalPushResult = {
  ok: boolean;
  recipients: number;
  error?: string;
};

const ONESIGNAL_ENDPOINT = "https://api.onesignal.com/notifications";

export async function sendOneSignalPush(
  input: SendOneSignalPushInput,
): Promise<SendOneSignalPushResult> {
  const payload: Record<string, unknown> = {
    app_id: input.appId,
    target_channel: "push",
    include_aliases: { external_id: input.externalIds },
    headings: { en: input.title },
    contents: { en: input.body },
  };
  if (input.url) payload.url = input.url;
  if (input.data) payload.data = input.data;

  try {
    const res = await fetch(ONESIGNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Key ${input.restApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = Array.isArray(json?.errors)
        ? json.errors.join("; ")
        : `OneSignal ${res.status}`;
      return { ok: false, recipients: 0, error: errMsg };
    }
    return { ok: true, recipients: Number(json?.recipients ?? 0) };
  } catch (err) {
    return {
      ok: false,
      recipients: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
