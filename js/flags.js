// Flag of the day: 195 countries (193 UN members + Holy See + Palestine), shown in a
// fixed shuffled order so every flag comes up once before any repeats. Images: flagcdn.com.
const COUNTRIES = `af Afghanistan|al Albania|dz Algeria|ad Andorra|ao Angola|ag Antigua and Barbuda|ar Argentina|am Armenia|au Australia|at Austria|az Azerbaijan|bs Bahamas|bh Bahrain|bd Bangladesh|bb Barbados|by Belarus|be Belgium|bz Belize|bj Benin|bt Bhutan|bo Bolivia|ba Bosnia and Herzegovina|bw Botswana|br Brazil|bn Brunei|bg Bulgaria|bf Burkina Faso|bi Burundi|cv Cape Verde|kh Cambodia|cm Cameroon|ca Canada|cf Central African Republic|td Chad|cl Chile|cn China|co Colombia|km Comoros|cg Republic of the Congo|cd Democratic Republic of the Congo|cr Costa Rica|ci Ivory Coast|hr Croatia|cu Cuba|cy Cyprus|cz Czech Republic|dk Denmark|dj Djibouti|dm Dominica|do Dominican Republic|ec Ecuador|eg Egypt|sv El Salvador|gq Equatorial Guinea|er Eritrea|ee Estonia|sz Eswatini|et Ethiopia|fj Fiji|fi Finland|fr France|ga Gabon|gm The Gambia|ge Georgia|de Germany|gh Ghana|gr Greece|gd Grenada|gt Guatemala|gn Guinea|gw Guinea-Bissau|gy Guyana|ht Haiti|va Vatican City|hn Honduras|hu Hungary|is Iceland|in India|id Indonesia|ir Iran|iq Iraq|ie Ireland|il Israel|it Italy|jm Jamaica|jp Japan|jo Jordan|kz Kazakhstan|ke Kenya|ki Kiribati|kp North Korea|kr South Korea|kw Kuwait|kg Kyrgyzstan|la Laos|lv Latvia|lb Lebanon|ls Lesotho|lr Liberia|ly Libya|li Liechtenstein|lt Lithuania|lu Luxembourg|mg Madagascar|mw Malawi|my Malaysia|mv Maldives|ml Mali|mt Malta|mh Marshall Islands|mr Mauritania|mu Mauritius|mx Mexico|fm Federated States of Micronesia|md Moldova|mc Monaco|mn Mongolia|me Montenegro|ma Morocco|mz Mozambique|mm Myanmar|na Namibia|nr Nauru|np Nepal|nl Netherlands|nz New Zealand|ni Nicaragua|ne Niger|ng Nigeria|mk North Macedonia|no Norway|om Oman|pk Pakistan|pw Palau|ps Palestine|pa Panama|pg Papua New Guinea|py Paraguay|pe Peru|ph Philippines|pl Poland|pt Portugal|qa Qatar|ro Romania|ru Russia|rw Rwanda|kn Saint Kitts and Nevis|lc Saint Lucia|vc Saint Vincent and the Grenadines|ws Samoa|sm San Marino|st São Tomé and Príncipe|sa Saudi Arabia|sn Senegal|rs Serbia|sc Seychelles|sl Sierra Leone|sg Singapore|sk Slovakia|si Slovenia|sb Solomon Islands|so Somalia|za South Africa|ss South Sudan|es Spain|lk Sri Lanka|sd Sudan|sr Suriname|se Sweden|ch Switzerland|sy Syria|tj Tajikistan|tz Tanzania|th Thailand|tl East Timor|tg Togo|to Tonga|tt Trinidad and Tobago|tn Tunisia|tr Turkey|tm Turkmenistan|tv Tuvalu|ug Uganda|ua Ukraine|ae United Arab Emirates|gb United Kingdom|us United States|uy Uruguay|uz Uzbekistan|vu Vanuatu|ve Venezuela|vn Vietnam|ye Yemen|zm Zambia|zw Zimbabwe`
  .split('|').map((s) => ({ code: s.slice(0, 2), name: s.slice(3) }));

// Deterministic shuffle (mulberry32 seeded) — same order on every device.
function shuffled(list, seed) {
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const ORDER = shuffled(COUNTRIES, 20261001);

export function flagFor(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
  const c = ORDER[((day % ORDER.length) + ORDER.length) % ORDER.length];
  return {
    ...c,
    img: `https://flagcdn.com/w640/${c.code}.png`,
    img2x: `https://flagcdn.com/w1280/${c.code}.png`,
    wiki: `https://en.wikipedia.org/wiki/Flag_of_${encodeURIComponent(c.name.replace(/ /g, '_'))}`,
  };
}

export const FLAG_COUNT = COUNTRIES.length;
