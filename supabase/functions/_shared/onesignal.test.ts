import { assertEquals } from "jsr:@std/assert@1";
import { sendOneSignalPush } from "./onesignal.ts";

function stubFetch(status: number, json: unknown) {
  globalThis.fetch = ((..._args: unknown[]) =>
    Promise.resolve(
      new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } }),
    )) as typeof fetch;
}

Deno.test("sendOneSignalPush posts external_id alias + headings/contents + url", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = ((url: string | URL, init?: RequestInit) => {
    captured = { url: String(url), init: init! };
    return Promise.resolve(
      new Response(JSON.stringify({ id: "n1", recipients: 1 }), { status: 200 }),
    );
  }) as typeof fetch;

  const res = await sendOneSignalPush({
    appId: "app-123",
    restApiKey: "key-abc",
    externalIds: ["profile-1"],
    title: "Hei",
    body: "Du har en ny vakt",
    url: "https://m.smartout.ai/dashboard/shifts",
    data: { event: "shift.published" },
  });

  assertEquals(res.ok, true);
  assertEquals(res.recipients, 1);
  assertEquals(captured!.url, "https://onesignal.com/api/v1/notifications");
  const sentBody = JSON.parse(captured!.init.body as string);
  assertEquals(sentBody.app_id, "app-123");
  assertEquals(sentBody.target_channel, "push");
  assertEquals(sentBody.include_aliases.external_id, ["profile-1"]);
  assertEquals(sentBody.headings.en, "Hei");
  assertEquals(sentBody.contents.en, "Du har en ny vakt");
  assertEquals(sentBody.url, "https://m.smartout.ai/dashboard/shifts");
  assertEquals(
    (captured!.init.headers as Record<string, string>)["Authorization"],
    "Basic key-abc",
  );
});

Deno.test("sendOneSignalPush reports zero recipients (no subscribed device)", async () => {
  stubFetch(200, { id: "", recipients: 0, errors: ["All included players are not subscribed"] });
  const res = await sendOneSignalPush({
    appId: "a",
    restApiKey: "k",
    externalIds: ["nobody"],
    title: "t",
    body: "b",
  });
  assertEquals(res.ok, true);
  assertEquals(res.recipients, 0);
});

Deno.test("sendOneSignalPush returns ok=false on non-2xx", async () => {
  stubFetch(400, { errors: ["Invalid app_id"] });
  const res = await sendOneSignalPush({
    appId: "a",
    restApiKey: "k",
    externalIds: ["x"],
    title: "t",
    body: "b",
  });
  assertEquals(res.ok, false);
  assertEquals(res.recipients, 0);
});
