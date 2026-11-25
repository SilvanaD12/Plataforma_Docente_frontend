# QA-14 Lighthouse evidence

## Local desktop audit

Local desktop audit on November 19, 2026, at 00:17 (Lima time).
Environment: Windows, Chrome, and Vite preview at `http://127.0.0.1:4173`.
Commands: `npm run build` and `npm run lighthouse`.
Lighthouse CI ran three times per page. The table shows the representative run for each page.

| Page | Mode | Environment | Performance | Accessibility | Best practices | SEO | LCP | TBT | Pass |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/login` | Desktop | Local | 100 | 100 | 100 | 91 | 504 ms | 0 ms | Yes |
| `/registro` | Desktop | Local | 100 | 100 | 100 | 91 | 503 ms | 0 ms | Yes |

Reports: [Login](local-desktop/login.html) and [Registration](local-desktop/registro.html).

## Production audit

Measured on `https://plataformadocente.dev` on November 19, 2026, between 00:33 and 00:53 Lima time. The table records one Lighthouse report for each page and form factor. The source archive is `production-before.zip`.

| Page | Mode | Performance | Accessibility | Best practices | SEO | LCP | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/login` | Desktop | 99 | 100 | 100 | 91 | 808 ms | 0 ms |
| `/login` | Mobile | 98 | 100 | 100 | 91 | 1677 ms | 0 ms |
| `/courses` | Desktop | 100 | 100 | 100 | 91 | 550 ms | 0 ms |
| `/courses` | Mobile | 99 | 100 | 100 | 91 | 1651 ms | 0 ms |
| Course unit | Desktop | 100 | 100 | 100 | 91 | 550 ms | 0 ms |
| Course unit | Mobile | 99 | 100 | 100 | 91 | 1653 ms | 0 ms |
| `/downloads` | Desktop | 97 | 98 | 100 | 91 | 1181 ms | 0 ms |
| `/downloads` | Mobile | 95 | 98 | 100 | 91 | 2762 ms | 0 ms |

## GitHub Actions verification

[Frontend CI #87](https://github.com/SilvanaD12/Plataforma_Docente_frontend/actions/runs/45534288286) passed on `main` on November 24, 2026, Lima time. The [frontend job](https://github.com/SilvanaD12/Plataforma_Docente_frontend/actions/runs/45534288286/job/138936962578) ran Lighthouse three times in desktop mode for both `/login` and `/registro` against the Vite preview build and published the [lighthouse-reports artifact](https://github.com/SilvanaD12/Plataforma_Docente_frontend/actions/runs/45534288286/artifacts/14986606383).
