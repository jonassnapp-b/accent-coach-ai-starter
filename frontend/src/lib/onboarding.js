const DONE_KEY = "fluentup_onboarding_done_v1";
const ANSWERS_KEY = "fluentup_onboarding_answers_v1";

export function isOnboardingDone() {
  try {
    return localStorage.getItem(DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingDone(value = true) {
  try {
    localStorage.setItem(DONE_KEY, value ? "1" : "0");
  } catch {}
}

export function saveOnboardingAnswers(answers) {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers || {}));
  } catch {}
}

export function getOnboardingAnswers() {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(DONE_KEY);
    localStorage.removeItem(ANSWERS_KEY);
  } catch {}
}