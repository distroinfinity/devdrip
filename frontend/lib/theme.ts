"use client";

export function getTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return (
    (document.documentElement.getAttribute("data-theme") as
      | "light"
      | "dark") ?? "light"
  );
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("dd-theme", theme);
}

export function toggleTheme() {
  const current = getTheme();
  setTheme(current === "light" ? "dark" : "light");
}

export function initTheme() {
  const stored = localStorage.getItem("dd-theme") as
    | "light"
    | "dark"
    | null;
  if (stored) {
    setTheme(stored);
  }
}
