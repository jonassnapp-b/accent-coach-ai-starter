import { LocalNotifications } from "@capacitor/local-notifications";
console.log("[TrialReminder] FILE LOADED");
const REMINDER_ID = 505;

async function ensureReminderPermission() {
  const perm = await LocalNotifications.checkPermissions();
  console.log("[TrialReminder] checkPermissions =", perm);

  if (perm.display === "granted") return true;

  const req = await LocalNotifications.requestPermissions();
  console.log("[TrialReminder] requestPermissions =", req);

  return req.display === "granted";
}

export async function scheduleTrialDay5Reminder() {
  const ok = await ensureReminderPermission();
  if (!ok) return { scheduled: false, reason: "no-permission" };

  await cancelTrialDay5Reminder();

const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
const at = new Date(Date.now() + fiveDaysMs);

  console.log("[TrialReminder] scheduling for", at.toISOString());

  const res = await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: "Your trial is ending soon",
        body: "Reminder: your 7-day trial is almost over. Cancel anytime in Apple subscriptions.",
        schedule: { at, allowWhileIdle: true },
        sound: "default",
      },
    ],
  });

  const pending = await LocalNotifications.getPending();
  console.log("[TrialReminder] schedule res =", res);
  console.log("[TrialReminder] pending =", pending);

  return { scheduled: true, at, pending };
}

export async function cancelTrialDay5Reminder() {
  await LocalNotifications.cancel({
    notifications: [{ id: REMINDER_ID }],
  });

  const pending = await LocalNotifications.getPending();
  console.log("[TrialReminder] after cancel pending =", pending);
}