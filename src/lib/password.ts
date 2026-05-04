// Password strength evaluator. Returns a score (0–4), a label, and a
// per-rule breakdown so the UI can show both a colored bar and a
// checklist. Pure function — no React, no DOM.
//
// The five rules: minimum length 8, uppercase, lowercase, digit, symbol.
// Strength tiers count satisfied rules:
//   0 satisfied  → empty
//   1            → very weak
//   2            → weak
//   3            → medium
//   4            → strong
//   5            → strong+ (all rules)
// We collapse 4–5 into "strong" for the label so the bar feels rewarding
// without making a 4-rule password look mediocre.

export type PasswordRule =
  | "min_length"
  | "uppercase"
  | "lowercase"
  | "digit"
  | "special";

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4; // bar segments to fill
  label: "" | "Weak" | "Medium" | "Strong";
  rules: Record<PasswordRule, boolean>;
  satisfied: number; // 0–5
};

const SPECIAL_RE = /[^A-Za-z0-9]/;

export function evaluatePassword(pw: string): PasswordStrength {
  const rules: Record<PasswordRule, boolean> = {
    min_length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: SPECIAL_RE.test(pw),
  };
  const satisfied =
    (rules.min_length ? 1 : 0) +
    (rules.uppercase ? 1 : 0) +
    (rules.lowercase ? 1 : 0) +
    (rules.digit ? 1 : 0) +
    (rules.special ? 1 : 0);

  let score: PasswordStrength["score"] = 0;
  let label: PasswordStrength["label"] = "";

  if (pw.length === 0) {
    score = 0;
    label = "";
  } else if (satisfied <= 2) {
    score = 1;
    label = "Weak";
  } else if (satisfied === 3) {
    score = 2;
    label = "Medium";
  } else if (satisfied === 4) {
    score = 3;
    label = "Strong";
  } else {
    score = 4;
    label = "Strong";
  }

  return { score, label, rules, satisfied };
}

export const PASSWORD_RULE_LABELS: Record<PasswordRule, string> = {
  min_length: "At least 8 characters",
  uppercase: "An uppercase letter (A–Z)",
  lowercase: "A lowercase letter (a–z)",
  digit: "A number (0–9)",
  special: "A symbol (!@#$ etc.)",
};
