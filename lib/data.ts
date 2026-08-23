import fs from "fs";
import path from "path";
import type { DashboardData } from "./types";

function readJson<T>(file: string): T {
  const filePath = path.join(process.cwd(), "public", "data", file);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getDashboardData(): DashboardData {
  return {
    overview: readJson("overview.json"),
    forecast: readJson("forecast.json"),
    risk: readJson("risk.json"),
    rootcause: readJson("rootcause.json"),
  };
}
