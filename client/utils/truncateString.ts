export function truncateString(str: string, maxLength: number): string {
  if (typeof str !== "string") throw new Error("Expected string");
  if (str.length <= maxLength) {
    return str;
  } else {
    return str.slice(0, maxLength) + "...";
  }
}
