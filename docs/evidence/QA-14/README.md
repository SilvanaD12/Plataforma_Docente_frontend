# QA-14 Lighthouse evidence

Local desktop audit on November 19, 2026, at 00:17 (Lima time).
Environment: Windows, Chrome, and Vite preview at `http://127.0.0.1:4173`.
Commands: `npm run build` and `npm run lighthouse`.
Lighthouse CI ran three times per page. The table shows the representative run for each page.

| Page | Mode | Environment | Performance | Accessibility | Best practices | SEO | LCP | TBT | Pass |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/login` | Desktop | Local | 100 | 100 | 100 | 91 | 504 ms | 0 ms | Yes |
| `/registro` | Desktop | Local | 100 | 100 | 100 | 91 | 503 ms | 0 ms | Yes |

Reports: [Login](local-desktop/login.html) and [Registration](local-desktop/registro.html).

Pending: verify the updated GitHub Actions run and record production results for
`/login`, `/courses`, a course unit, and `/downloads` on desktop and mobile.
