"use client";

import { Check, X } from "lucide-react";
import { evaluatePassword, type PasswordRule } from "@/lib/password";
import { useDict } from "@/lib/i18n/client";
import type { Dict } from "@/lib/i18n/dict.en";

const RULE_ORDER: PasswordRule[] = [
  "min_length",
  "uppercase",
  "lowercase",
  "digit",
  "special",
];

const TIER_BG = {
  0: "bg-slate-200",
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-emerald-500",
  4: "bg-emerald-600",
} as const;

const TIER_TEXT = {
  0: "text-slate-400",
  1: "text-red-600",
  2: "text-amber-600",
  3: "text-emerald-700",
  4: "text-emerald-700",
} as const;

function ruleLabel(rule: PasswordRule, t: Dict): string {
  switch (rule) {
    case "min_length":
      return t.password_strength.rule_min_length;
    case "uppercase":
      return t.password_strength.rule_uppercase;
    case "lowercase":
      return t.password_strength.rule_lowercase;
    case "digit":
      return t.password_strength.rule_digit;
    case "special":
      return t.password_strength.rule_special;
  }
}

function strengthLabel(label: "" | "Weak" | "Medium" | "Strong", t: Dict): string {
  if (label === "Weak") return t.password_strength.weak;
  if (label === "Medium") return t.password_strength.medium;
  if (label === "Strong") return t.password_strength.strong;
  return "";
}

export function PasswordStrength({
  password,
  className = "",
}: {
  password: string;
  className?: string;
}) {
  const t = useDict();
  if (password.length === 0) return null;

  const s = evaluatePassword(password);
  const label = strengthLabel(s.label, t);

  return (
    <div className={`mt-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i < s.score ? TIER_BG[s.score] : "bg-slate-200"}`}
            />
          ))}
        </div>
        <span
          className={`text-xs font-medium ${TIER_TEXT[s.score]}`}
          aria-live="polite"
        >
          {label || "—"}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {RULE_ORDER.map((rule) => {
          const ok = s.rules[rule];
          return (
            <li
              key={rule}
              className={`inline-flex items-center gap-1.5 text-xs ${ok ? "text-emerald-700" : "text-slate-500"}`}
            >
              {ok ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <X className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              )}
              {ruleLabel(rule, t)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
