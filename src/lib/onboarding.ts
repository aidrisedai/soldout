// The onboarding questions, in order. The AI may skip ones already answered and rephrases each one.
export type Field = { key: string; label: string; type: "text" | "number" | "date" | "longtext" | "url"; optional?: boolean; fallback: string; placeholder?: string };

export const FIELDS: Field[] = [
  { key: "organizerName", label: "Your name", type: "text", fallback: "First things first: what’s your name?", placeholder: "e.g. Azeez Idris" },
  { key: "intent", label: "What brings you here", type: "longtext", fallback: "What brings you here today? Tell me about the program you need to fill.", placeholder: "e.g. I need 20 families for a 12-week founder program for teens, starting Nov 15" },
  { key: "organization", label: "Organization", type: "text", fallback: "What’s the name of your organization?", placeholder: "e.g. EdAI" },
  { key: "name", label: "Program", type: "text", fallback: "What’s the program called?", placeholder: "e.g. Founder: 12 weeks from Nov 15" },
  { key: "goalSeats", label: "Seats", type: "number", fallback: "How many seats do you need to fill?", placeholder: "e.g. 20" },
  { key: "deadline", label: "By when", type: "date", fallback: "By when do you need them filled?" },
  { key: "price", label: "Price", type: "text", fallback: "What does it cost per student?", placeholder: "e.g. $1,200 per student" },
  { key: "audience", label: "Who it’s for", type: "text", optional: true, fallback: "Who is it for?", placeholder: "e.g. Parents of grades 6–12" },
  { key: "content", label: "Program details", type: "longtext", fallback: "Last big one: paste your program details or FAQ. SoldOut only answers parents from this.", placeholder: "Who it’s for, schedule, what students do, who teaches, price, how to apply…" },
  { key: "applyLink", label: "Enroll link", type: "url", optional: true, fallback: "Where do families go to enroll? Paste the link.", placeholder: "https://…" },
];

