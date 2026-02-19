export interface AlertEntry {
  time: string;
  message: string;
  severity: "info" | "warning" | "danger";
}
