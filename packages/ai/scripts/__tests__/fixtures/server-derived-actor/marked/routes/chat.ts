const employeeSchema = z.object({
  profile_id: z.string(), // not-actor: workforce data describing other employees
  name: z.string(),
});
const shiftSchema = z.object({
  profile_id: z.string().uuid(), // not-actor: shift assignment subject
  shift_id: z.string(),
});
const chatSchema = z.object({
  message: z.string(),
  workforce: z.array(employeeSchema),
  shifts: z.array(shiftSchema),
});
app.post("/chat", zValidator("json", chatSchema), handler);
