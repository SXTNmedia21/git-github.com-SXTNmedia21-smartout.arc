const chatSchema = z.object({ message: z.string(), profile_id: z.string().uuid() });
app.post("/chat", zValidator("json", chatSchema), handler);
