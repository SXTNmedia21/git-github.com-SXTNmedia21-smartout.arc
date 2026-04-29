import { type JobContext, WorkerOptions, cli, defineAgent, voice } from "@livekit/agents";
import * as openai from "@livekit/agents-plugin-openai";
import { fileURLToPath } from "node:url";

export default defineAgent({
  entry: async (ctx: JobContext) => {
    await ctx.connect();
    console.log(`voice-agent connected to room: ${ctx.room.name}`);

    const agent = new voice.Agent({
      instructions: [
        "Du er Mr. Botsson, Smartouts AI-kollega.",
        "Snakk norsk. Vær kort, varm, direkte.",
        "Hjelp brukeren med vaktplanlegging, opplæring og daglig drift.",
        "Ikke spør om personnummer, bankdetaljer eller adresse over voice.",
      ].join(" "),
    });

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: "alloy",
        modalities: ["text", "audio"],
      }),
    });

    await session.start({ agent, room: ctx.room });

    session.generateReply({
      instructions:
        "Hils brukeren kort og varmt på norsk. Si at du er Botsson og spør hva du kan hjelpe med.",
    });
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
