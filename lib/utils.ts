import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-vriendelijke classnames-merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
