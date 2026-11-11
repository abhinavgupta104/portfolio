# Abhinav Gupta — portfolio

A one-page portfolio presented by the agents it describes. The page opens as a
plain home page, Stella redesigns it in front of the visitor, and every project
has a demo you can use. "Let Stella drive" plays the whole page as a guided tour.

Plain HTML, CSS and JavaScript, built with Vite. Two libraries: GSAP (animation)
and Lenis (smooth scrolling).

## Run it

```sh
pnpm install
pnpm dev        # http://127.0.0.1:5190
pnpm build      # writes the finished site to dist/
pnpm preview    # serves dist/ at http://127.0.0.1:5191
```

## Where it is live

https://portfolio.banadiyabhai.online

- **Publishing:** run `pnpm deploy:live`. It builds the site, uploads it to the
  server and swaps it in, so visitors never see a half-copied site. It needs
  `gcloud` logged in with access to the `divyarudra` project.
- **Server:** avi-server (the machine behind stella.banadiyabhai.online). Caddy
  serves `/srv/portfolio` through its own `portfolio.banadiyabhai.online` block
  in `/etc/caddy/Caddyfile`. The folder is root-owned and outside Stella's home,
  so her site sync never touches it. Caddy gets and renews the HTTPS certificate
  by itself.
- **Domain:** `banadiyabhai.online` is at Hostinger (its own account, separate
  from the six client sites). An A record `portfolio → 34.93.18.57` points the
  subdomain at the server.
- **GitHub:** keeps the code. Every push runs a build check
  (`.github/workflows/build.yml`); it does not publish anything.
- **Moving hosts later:** `dist/` is a plain static site with relative paths and
  works on any host, from a domain or a sub-folder.

## Things you will want to change

| What | Where |
| --- | --- |
| Contact buttons (email, WhatsApp, LinkedIn, Instagram) | `src/site.js` |
| The text for each project | `index.html` |
| What Stella says on the tour | `STOPS` at the top of `src/tour.js` |
| Terminal commands | `COMMANDS` in `src/about.js` |
| Colours and type | `:root` in `src/css/base.css` |

The opening plays on every visit and every refresh. Add `?nointro` to the
address to skip it while you work on something else. A link to a section, such
as `/#kavya`, also skips it and lands on that section.

After the site has a real address, change `og:image` in `index.html` to the full
URL (for example `https://your-domain/og.jpg`). Link previews on WhatsApp and
LinkedIn need the full address.

## Checks and tools

```sh
pnpm smoke      # clicks through every demo and the terminal; needs `pnpm dev` running
pnpm fps        # times the opening and reports any slow frames (target: 60 fps, none over 25 ms)
pnpm shots page shots-out 1440x900     # screenshots of every section
pnpm shots tour shots-out 1440x900     # frames of the whole Stella tour
pnpm sites      # retakes the seven website screenshots in public/shots
pnpm font       # re-trims the Hindi font; run after adding a new Hindi word
```

`pnpm font` needs `uv`. `pnpm sites` needs ImageMagick. Both, like the checks,
use the Chrome already installed on this machine.

## What is real and what is acted

The demos are performances of the real projects, so it helps to know which
numbers you can stand behind.

- **Real, measured numbers:** everything in the fact lists, and the preset
  buttons in the demos (Stella's CRM at 81/81 tests, LeadScout's 35 leads in
  26 seconds, Tatva's build times, the four-second SMS delivery).
- **Acted:** Kavya's phone call is a script, the business names in LeadScout and
  the three shops and brands are invented, and anything a visitor types in gets
  a result labelled "simulated".
- **Real maths:** the SMS character counter (GSM-7 and Unicode, parts and limits).

## How it is put together

```
index.html          all the words on the page
src/main.js         start-up order
src/hero.js         the opening and the hero
src/sections.js     scroll effects, the gallery, the "you" label
src/tour.js         "Let Stella drive"
src/about.js        the terminal and the contact buttons
src/rooms/*.js      one file per demo
src/lib/*.js        shared pieces: agent cursors, sound, the top pill, the shader
src/css/*.css       styles, split the same way
```
