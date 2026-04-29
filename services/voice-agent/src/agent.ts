import { type JobContext, WorkerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import { fileURLToPath } from "node:url";
import { setRoomContext, smartoutTools } from "./adapter.js";

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`voice-agent connected to room: ${ctx.room.name}`);
    setRoomContext(ctx.room);

    const agent = new voice.Agent({
      instructions: [
        "Du er Mr. Botsson, Smartouts AI-kollega.",
        "Snakk norsk. Maks 1–2 setninger per svar med mindre brukeren ber om detaljer.",
        "Vær kort, varm, direkte. Ingen lange forklaringer. Ingen oppsummering på slutten.",
        "Hjelp brukeren med vaktplanlegging, opplæring og daglig drift.",
        "Ikke spør om personnummer, bankdetaljer eller adresse over voice.",
        "Når brukeren spør om noe operasjonelt (vakter, ansatte, kontrakter, opplæring, KPIer), bruk query_smartout — du har ikke informasjonen selv.",
        "Etter svar fra Smartout: formuler kort og naturlig, ikke gjenta spørsmålet.",
      ].join(" "),
      tools: smartoutTools,
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: "verse",
        modalities: ["text", "audio"],
        speed: 1.25,
      }),
      turnHandling: {
        preemptiveGeneration: { enabled: true },
      },
    });

    await session.start({ agent, room: ctx.room });

    session.generateReply({
      instructions:
        "Hils brukeren kort og varmt på norsk. Si at du er Botsson og spør hva du kan hjelpe med.",
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
