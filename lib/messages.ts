import type { Locale } from "./i18n";

export type Messages = Record<string, string>;

export async function getMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case "ko":
      return (await import("../messages/ko.json")).default as Messages;
    case "en":
      return (await import("../messages/en.json")).default as Messages;
    default:
      return (await import("../messages/ko.json")).default as Messages;
  }
}
