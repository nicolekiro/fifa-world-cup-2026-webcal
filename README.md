# FIFA World Cup 2026 AEST Webcal

中文：这个项目从 FIFA 官方赛程 API 生成一个 AEST / Australia-Melbourne 时区的可订阅 `.ics` 日历，形式参考 FourFourTwo 的完整赛程日历。

English: This project generates an AEST / Australia-Melbourne subscribable `.ics` calendar from FIFA's official fixture API, in the spirit of the FourFourTwo full schedule calendar.

## Source

- Official page: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures
- API used by FIFA frontend: `https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=200`

## Local Build

```bash
npm run build
```

Outputs:

- `public/worldcup2026-aest.ics`
- `public/matches.json`
- `public/index.html`

The build fails unless FIFA returns exactly 104 matches.

## GitHub Pages Setup

1. Push this repository to GitHub.
2. In GitHub, open Settings -> Pages.
3. Set Source to GitHub Actions.
4. Run the "Update FIFA World Cup 2026 Calendar" workflow once, or wait for the schedule.

After Pages deploys, subscribe in Google Calendar with:

```text
https://<github-user>.github.io/<repo>/worldcup2026-aest.ics
```

If your calendar app supports `webcal://`, you can also use:

```text
webcal://<github-user>.github.io/<repo>/worldcup2026-aest.ics
```

## Notes

- The workflow refreshes every 6 hours.
- Google Calendar subscription refresh is controlled by Google and may lag by several hours.
- Event times are emitted with `TZID=Australia/Melbourne`; during the tournament dates this is AEST.
- Events are transparent so they do not block availability by default.
