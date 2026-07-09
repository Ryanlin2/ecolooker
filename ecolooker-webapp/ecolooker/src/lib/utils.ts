import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtNum(n: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, ...opts }).format(n);
}
