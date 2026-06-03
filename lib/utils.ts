import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isTextEditable(element: Element | null): boolean {
  if (!element || !element.tagName) return false;

  const tagName = element.tagName.toUpperCase();
  if (tagName === "TEXTAREA") return true;

  if (tagName === "INPUT") {
    const type = (element as HTMLInputElement).type.toLowerCase();
    const textTypes = [
      "text",
      "password",
      "number",
      "email",
      "url",
      "search",
      "tel",
      "date",
      "datetime-local",
      "month",
      "time",
      "week",
    ];
    return textTypes.includes(type);
  }

  if ((element as HTMLElement).isContentEditable) return true;

  return false;
}
