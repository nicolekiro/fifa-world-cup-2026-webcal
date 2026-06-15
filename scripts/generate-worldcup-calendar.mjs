import { mkdir, writeFile } from "node:fs/promises";

const API_URL =
  "https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=200";
const OFFICIAL_FIXTURES_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";
const OUTPUT_DIR = new URL("../public/", import.meta.url);
const ICS_PATH = new URL("worldcup2026-aest.ics", OUTPUT_DIR);
const ICS_V2_PATH = new URL("worldcup2026-aest-v2.ics", OUTPUT_DIR);
const JSON_PATH = new URL("matches.json", OUTPUT_DIR);
const INDEX_PATH = new URL("index.html", OUTPUT_DIR);
const TIME_ZONE = "Australia/Melbourne";
const EXPECTED_MATCH_COUNT = 104;
const FIFA_COUNTRY_TO_ISO2 = {
  ALG: "DZ",
  ARG: "AR",
  AUS: "AU",
  AUT: "AT",
  BEL: "BE",
  BIH: "BA",
  BRA: "BR",
  CAN: "CA",
  CIV: "CI",
  COD: "CD",
  COL: "CO",
  CPV: "CV",
  CRO: "HR",
  CUW: "CW",
  CZE: "CZ",
  ECU: "EC",
  EGY: "EG",
  ESP: "ES",
  FRA: "FR",
  GER: "DE",
  GHA: "GH",
  HAI: "HT",
  IRN: "IR",
  IRQ: "IQ",
  JOR: "JO",
  JPN: "JP",
  KOR: "KR",
  KSA: "SA",
  MAR: "MA",
  MEX: "MX",
  NED: "NL",
  NOR: "NO",
  NZL: "NZ",
  PAN: "PA",
  PAR: "PY",
  POR: "PT",
  QAT: "QA",
  RSA: "ZA",
  SEN: "SN",
  SUI: "CH",
  SWE: "SE",
  TUN: "TN",
  TUR: "TR",
  URU: "UY",
  USA: "US",
  UZB: "UZ"
};
const FIFA_COUNTRY_TO_FLAG = {
  ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  SCO: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}"
};

function localizedValue(values, fallback = "") {
  if (!Array.isArray(values)) return fallback;
  return (
    values.find((item) => item.Locale?.toLowerCase() === "en-gb")?.Description ||
    values[0]?.Description ||
    fallback
  );
}

function flagEmojiFor(team) {
  const explicitFlag = FIFA_COUNTRY_TO_FLAG[team?.IdCountry];
  if (explicitFlag) return explicitFlag;

  const iso2 = FIFA_COUNTRY_TO_ISO2[team?.IdCountry];
  if (!iso2) return "";

  return Array.from(iso2.toUpperCase())
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function teamLabel(team, placeholder) {
  if (team) {
    const name = localizedValue(team.TeamName, team.ShortClubName || team.Abbreviation || "TBD");
    return [flagEmojiFor(team), name].filter(Boolean).join(" ");
  }
  if (!placeholder) return "TBD";
  if (/^W\d+$/i.test(placeholder)) return `Winner Match ${placeholder.slice(1)}`;
  if (/^L\d+$/i.test(placeholder)) return `Loser Match ${placeholder.slice(1)}`;
  if (/^RU\d+$/i.test(placeholder)) return `Loser Match ${placeholder.slice(2)}`;
  return placeholder;
}

function scoreLabel(match) {
  if (match.HomeTeamScore == null || match.AwayTeamScore == null) return "";

  const homePen = match.HomeTeamPenaltyScore;
  const awayPen = match.AwayTeamPenaltyScore;
  const penalties =
    homePen == null || awayPen == null ? "" : ` (${homePen}-${awayPen} pens)`;

  return ` ${match.HomeTeamScore}-${match.AwayTeamScore}${penalties}`;
}

function summaryFor(match) {
  const home = teamLabel(match.Home, match.PlaceHolderA);
  const away = teamLabel(match.Away, match.PlaceHolderB);
  const score = scoreLabel(match);
  return score
    ? `FIFA ${home}${score} ${away}`
    : `FIFA ${home} vs ${away}`;
}

function venueFor(match) {
  const stadium = localizedValue(match.Stadium?.Name);
  const city = localizedValue(match.Stadium?.CityName);
  return [stadium, city].filter(Boolean).join(", ");
}

function stageFor(match) {
  return localizedValue(match.GroupName) || localizedValue(match.StageName);
}

function formatDateTime(date, timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function escapeText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldLine(line) {
  const chunks = [];
  let remaining = line;
  while (Buffer.byteLength(remaining, "utf8") > 73) {
    let size = 73;
    while (Buffer.byteLength(remaining.slice(0, size), "utf8") > 73) size -= 1;
    chunks.push(remaining.slice(0, size));
    remaining = ` ${remaining.slice(size)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

function icsLine(name, value) {
  return foldLine(`${name}:${escapeText(value)}`);
}

function eventFor(match, generatedAt) {
  const start = new Date(match.Date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stage = stageFor(match);
  const description = [
    `Match ${match.MatchNumber}`,
    stage,
    "Source: FIFA official Scores & Fixtures",
    OFFICIAL_FIXTURES_URL
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VEVENT",
    `UID:fifa-world-cup-2026-${match.IdMatch}@nicoco.github.io`,
    `DTSTAMP:${formatDateTime(generatedAt)}Z`,
    `LAST-MODIFIED:${formatDateTime(generatedAt)}Z`,
    `DTSTART;TZID=${TIME_ZONE}:${formatDateTime(start, TIME_ZONE)}`,
    `DTEND;TZID=${TIME_ZONE}:${formatDateTime(end, TIME_ZONE)}`,
    icsLine("SUMMARY", summaryFor(match)),
    icsLine("LOCATION", venueFor(match)),
    icsLine("DESCRIPTION", description),
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT"
  ].join("\r\n");
}

async function fetchMatches() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "fifa-world-cup-2026-webcal/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`FIFA API returned ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.Results)) {
    throw new Error("FIFA API response did not include Results[]");
  }

  return payload.Results.sort((a, b) => a.MatchNumber - b.MatchNumber);
}

function buildCalendar(matches, generatedAt) {
  const events = matches.map((match) => eventFor(match, generatedAt)).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nicoco//FIFA World Cup 2026 AEST//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:FIFA World Cup 2026 (AEST)",
    "X-WR-TIMEZONE:Australia/Melbourne",
    "X-PUBLISHED-TTL:PT6H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "BEGIN:VTIMEZONE",
    "TZID:Australia/Melbourne",
    "BEGIN:STANDARD",
    "DTSTART:20260405T030000",
    "TZOFFSETFROM:+1100",
    "TZOFFSETTO:+1000",
    "TZNAME:AEST",
    "END:STANDARD",
    "END:VTIMEZONE",
    events,
    "END:VCALENDAR",
    ""
  ].join("\r\n");
}

function buildIndex(generatedAt, count) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FIFA World Cup 2026 AEST Calendar</title>
</head>
<body>
  <h1>FIFA World Cup 2026 AEST Calendar</h1>
  <p>Generated from FIFA official fixture data.</p>
  <p>Events: ${count}</p>
  <p>Last generated: ${generatedAt.toISOString()}</p>
  <p><a href="./worldcup2026-aest.ics">Download or subscribe to worldcup2026-aest.ics</a></p>
  <p><a href="./worldcup2026-aest-v2.ics">Fresh Google Calendar subscription URL: worldcup2026-aest-v2.ics</a></p>
  <p>Official source: <a href="${OFFICIAL_FIXTURES_URL}">FIFA Scores & Fixtures</a></p>
</body>
</html>
`;
}

const matches = await fetchMatches();
if (matches.length !== EXPECTED_MATCH_COUNT) {
  throw new Error(`Expected ${EXPECTED_MATCH_COUNT} matches, received ${matches.length}`);
}

const generatedAt = new Date();
await mkdir(OUTPUT_DIR, { recursive: true });
const calendar = buildCalendar(matches, generatedAt);
await writeFile(ICS_PATH, calendar, "utf8");
await writeFile(ICS_V2_PATH, calendar, "utf8");
await writeFile(JSON_PATH, `${JSON.stringify({ generatedAt, matches }, null, 2)}\n`, "utf8");
await writeFile(INDEX_PATH, buildIndex(generatedAt, matches.length), "utf8");

console.log(`Wrote ${matches.length} matches to ${ICS_PATH.pathname}`);
console.log(`Wrote fresh subscription copy to ${ICS_V2_PATH.pathname}`);
