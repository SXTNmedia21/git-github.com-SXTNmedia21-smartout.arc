const chatSchema = z.object({ message: z.string() });
app.post("/chat", zValidator("json", chatSchema), handler);
