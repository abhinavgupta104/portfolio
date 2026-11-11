// The terminal in the About section. It prints a fastfetch card when it comes
// into view and then accepts a handful of real commands.
import { $, reduced } from './lib/dom.js';
import { audio } from './lib/audio.js';
import { ScrollTrigger, scrollToEl } from './lib/scroll.js';
import { startTour } from './tour.js';
import { site } from './site.js';

const ROOMS = { stella: '#stella', kavya: '#kavya', nacc: '#nacc', leadscout: '#leadscout', tatva: '#tatva', sms: '#sms', 'sms-portal': '#sms', panel: '#panel', 'whatsapp-panel': '#panel', websites: '#sites', sites: '#sites', contact: '#contact' };
const SWATCH = ['#ffb21a', '#ff3f8e', '#2f55ff', '#22d47e', '#8f5bff', '#ff5a1f', '#17d3bd', '#f3efe6'];

const LOGO = [
  '       /\\        ',
  '      /  \\       ',
  '     /\\   \\      ',
  '    /      \\     ',
  '   /   ,,   \\    ',
  '  /   |  |  -\\   ',
  " /_-''    ''-_\\  ",
];
const INFO = [
  '<span class="t-w">abhinav</span><span class="t-d">@</span><span class="t-w">noida</span>',
  '<span class="t-d">-------------</span>',
  '<span class="t-y">Role</span>    builds AI agents',
  '<span class="t-y">Age</span>     21',
  '<span class="t-y">Base</span>    Noida, India',
  '<span class="t-y">Study</span>   Diploma, Information Technology',
  '<span class="t-y">OS</span>      Arch Linux, Hyprland',
  '<span class="t-y">Agents</span>  4 on duty',
  '<span class="t-y">Sites</span>   7 live',
];

/** The fastfetch card. On a narrow screen the ASCII logo is dropped so lines don't wrap. */
function card(narrow) {
  const swatches = SWATCH.map((c) => `<span class="t-sw" style="background:${c}"></span>`).join('');
  if (narrow) return [...INFO, '', swatches];
  const rows = Math.max(LOGO.length, INFO.length);
  const out = [];
  for (let i = 0; i < rows; i++) out.push(`<span class="t-b">${LOGO[i] || ' '.repeat(18)}</span>${INFO[i] || ''}`);
  out.push('');
  out.push(' '.repeat(18) + swatches);
  return out;
}

export function initAbout() {
  const body = $('#termBody');
  const input = $('#termIn');
  const term = $('#term');
  let busy = false;

  const print = (html = '') => {
    const line = document.createElement('div');
    line.innerHTML = html || '&nbsp;';
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
  };
  const echo = (cmd) => print(`<span class="t-g">❯</span> ${cmd.replace(/</g, '&lt;')}`);
  const lines = async (arr, gap = 45) => {
    for (const l of arr) { print(l); if (!reduced) await new Promise((r) => setTimeout(r, gap)); }
  };

  const COMMANDS = {
    help: () => lines([
      '<span class="t-y">fastfetch</span>         who is this',
      '<span class="t-y">ls</span>                what he built',
      '<span class="t-y">open &lt;name&gt;</span>       jump to a project, e.g. <span class="t-d">open kavya</span>',
      '<span class="t-y">stella</span>            let Stella drive the page',
      '<span class="t-y">sudo hire abhinav</span> you know you want to',
      '<span class="t-y">clear</span>             tidy up',
    ], 30),
    fastfetch: () => lines(card(body.clientWidth < 460)),
    neofetch: () => lines(card(body.clientWidth < 460)),
    whoami: () => print('visitor <span class="t-d">(a person of taste, clearly)</span>'),
    ls: () => print('<span class="t-b">stella/  kavya/  nacc/  leadscout/  tatva/  sms-portal/  whatsapp-panel/  websites/</span>'),
    pwd: () => print('/home/abhinav/portfolio'),
    date: () => print(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' }) + ' IST'),
    stella: async () => { print('<span class="t-y">Stella:</span> on it.'); await new Promise((r) => setTimeout(r, 500)); startTour(); },
    clear: () => { body.innerHTML = ''; },
    exit: () => print('There is no exit. Only scroll.'),
    btw: () => print('I use Arch, btw.'),
    vim: () => print('You are now stuck in vim. <span class="t-d">(kidding. type help)</span>'),
    hi: () => print('नमस्ते 👋'),
    hello: () => print('नमस्ते 👋'),
  };

  async function exec(raw) {
    const cmd = raw.trim();
    if (!cmd) return;
    echo(cmd);
    const [name, ...args] = cmd.toLowerCase().split(/\s+/);
    if (name === 'sudo') {
      if (args.join(' ') === 'hire abhinav') {
        await lines(['[sudo] password for visitor: <span class="t-d">••••••••</span>', '<span class="t-g">Access granted.</span> Opening a line to Abhinav…'], 380);
        scrollToEl($('#contact'), { duration: 1.8 });
      } else print('visitor is not in the sudoers file. <span class="t-p">This incident will be reported to Stella.</span>');
    } else if (name === 'open' || name === 'cd' || name === 'cat') {
      const key = (args[0] || '').replace(/\/$/, '');
      if (ROOMS[key]) { print(`opening <span class="t-y">${key}</span>…`); scrollToEl($(ROOMS[key]), { duration: 1.6 }); }
      else print(`no such project: ${key || '(nothing)'} <span class="t-d">— try ls</span>`);
    } else if (ROOMS[name]) {
      print(`opening <span class="t-y">${name}</span>…`); scrollToEl($(ROOMS[name]), { duration: 1.6 });
    } else if (name === 'rm') {
      print('<span class="t-p">Nice try.</span> Stella keeps backups.');
    } else if (name === 'email' || name === 'mail') {
      print(site.email ? `<a href="mailto:${site.email}">${site.email}</a>` : 'Scroll down: the contact buttons are right there.');
    } else if (COMMANDS[name]) {
      await COMMANDS[name]();
    } else {
      print(`zsh: command not found: ${name.replace(/</g, '&lt;')} <span class="t-d">— try help</span>`);
    }
    print();
  }

  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || busy) return;
    const v = input.value;
    input.value = '';
    audio.click();
    busy = true;
    await exec(v);
    busy = false;
  });
  input.addEventListener('input', () => audio.key());
  term.addEventListener('click', (e) => { if (!window.getSelection().toString() && e.target !== input) input.focus({ preventScroll: true }); });

  // first run: type the command, then print the card
  const first = async () => {
    busy = true;
    if (!reduced) {
      for (const ch of 'fastfetch') { input.value += ch; audio.key(); await new Promise((r) => setTimeout(r, 70)); }
      await new Promise((r) => setTimeout(r, 250));
    }
    input.value = '';
    await exec('fastfetch');
    print('<span class="t-d">type</span> help <span class="t-d">and press Enter. This one is real.</span>');
    print();
    busy = false;
  };
  ScrollTrigger.create({ trigger: term, start: 'top 75%', once: true, onEnter: first });
}

/** Contact buttons come from src/site.js so they are edited in one place. */
export function initContact() {
  const box = $('#contactLinks');
  const add = (label, href, primary) => {
    const a = document.createElement('a');
    a.className = primary ? 'btn btn--ink' : 'btn btn--ghost';
    a.href = href; a.textContent = label; a.dataset.you = 'open';
    if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    box.appendChild(a);
  };
  box.innerHTML = '';
  if (site.email) add('Email me ↗', `mailto:${site.email}`, true);
  if (site.whatsapp) add('WhatsApp ↗', `https://wa.me/${site.whatsapp}`, !site.email);
  if (site.github) add('GitHub ↗', site.github, !site.email && !site.whatsapp);
  if (site.linkedin) add('LinkedIn ↗', site.linkedin);
  if (site.instagram) add('Instagram ↗', site.instagram);
}
