import React from "react";

const variants: Record<string, string> = {
  success: "signal success",
  warn: "signal warn",
  danger: "signal danger"
};

export default function SignalBadge({
  label,
  variant = "success"
}: {
  label: string;
  variant?: "success" | "warn" | "danger";
}) {
  return <span className={variants[variant] ?? variants.success}>{label}</span>;
}
