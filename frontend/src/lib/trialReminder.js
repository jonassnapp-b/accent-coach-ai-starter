import { LocalNotifications } from "@capacitor/local-notifications";

const REMINDER_ID = 505;

async function ensureReminderPermission() {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === "granted") return true;

  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

export async function scheduleTrialDay5Reminder() {
  const ok = await ensureReminderPermission();
  if (!ok) return { scheduled: false, reason: "no-permission" };

  // Cancel først for at undgå duplicates
  await cancelTrialDay5Reminder();

  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  const at = new Date(Date.now() + fiveDaysMs);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "Your trial is ending soon",
        body: "Reminder: your 7-day trial is almost over. Cancel anytime in Apple subscriptions.",
        schedule: { at },
        sound: "default",
      },
    ],
  });

  return { scheduled: true, at };
}

export async function cancelTrialDay5Reminder() {
  await LocalNotifications.cancel({
    notifications: [{ id: REMINDER_ID }],
  });
}