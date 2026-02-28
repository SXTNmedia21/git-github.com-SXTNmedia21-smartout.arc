import { supabase } from "./supabase.js";

type ReminderSchedule = {
  day_offset: number;
  template_key: string;
  reminder_type: "email" | "sms";
};

const SELF_SERVICE_SCHEDULE: ReminderSchedule[] = [
  { day_offset: 0, template_key: "contract.welcome", reminder_type: "email" },
  { day_offset: 3, template_key: "contract.reminder.day3", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "sms" },
  { day_offset: 10, template_key: "contract.reminder.day10", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "sms" },
  { day_offset: 21, template_key: "contract.deletion.warning", reminder_type: "email" },
  { day_offset: 21, template_key: "contract.deletion.warning", reminder_type: "sms" },
];

const SALES_ASSISTED_SCHEDULE: ReminderSchedule[] = [
  { day_offset: 0, template_key: "contract.sales.sent", reminder_type: "email" },
  { day_offset: 3, template_key: "contract.sales.reminder.day3", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "email" },
  { day_offset: 7, template_key: "contract.reminder.day7", reminder_type: "sms" },
  { day_offset: 10, template_key: "contract.reminder.day10", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "email" },
  { day_offset: 13, template_key: "contract.reminder.day13", reminder_type: "sms" },
];

export async function scheduleReminders(
  contractId: string,
  workspaceId: string,
  journeyType: string,
  sentAt: Date,
  language: string = "no",
) {
  const schedule = journeyType === "self_service" ? SELF_SERVICE_SCHEDULE : SALES_ASSISTED_SCHEDULE;

  const reminders = schedule.map((r) => ({
    contract_id: contractId,
    workspace_id: workspaceId,
    reminder_type: r.reminder_type,
    template_key: r.template_key,
    language,
    scheduled_at: new Date(sentAt.getTime() + r.day_offset * 24 * 60 * 60 * 1000).toISOString(),
    status: r.day_offset === 0 ? "sent" : "scheduled", // Day 0 is sent immediately
  }));

  const { error } = await supabase.from("contract_reminder").insert(reminders);
  if (error) {
    console.error("Failed to schedule reminders:", error.message);
  }
}
