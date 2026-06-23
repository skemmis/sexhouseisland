// The Season 50 cast of Sex House Island. Each `img` maps to a file produced by
// scripts/gen-cast.mjs (public/cast/<id>.jpg). Bios are written in the show's
// breathless, faintly unwell promotional voice.

export interface CastMember {
  id: string;
  name: string;
  epithet: string;
  age: string;
  hometown: string;
  bio: string;
  /** A pull-quote in the contestant's own voice. */
  quote: string;
  /** Pinned to the bottom of the card, tabloid-style. */
  tag: string;
}

export const CAST: CastMember[] = [
  {
    id: "danni",
    name: "Danni",
    epithet: "The Legacy",
    age: "18 (as of filming day one)",
    hometown: "Born in the House",
    bio:
      "The most anticipated contestant in 50 seasons. Daughter of beloved Season 1 sweethearts Frank & Erin, Danni has grown up entirely on camera and entirely online. She's finally eighteen, impossibly sweet, and ready to find love in the only home she's ever known.",
    quote: "I've literally never been outside? But I've seen everything.",
    tag: "Franchise royalty • Raised by the algorithm",
  },
  {
    id: "grayson",
    name: "Grayson",
    epithet: "The Connoisseur",
    age: "22",
    hometown: "His Room",
    bio:
      "Producers swear Grayson 'understands what's sexy better than anyone alive.' He is also completely unable to make eye contact, speak first, or leave a beanbag chair. The House believes he can be saved. The House has been wrong before.",
    quote: "Can everyone please stop looking directly at me. Thank you.",
    tag: "High potential • Requires charging",
  },
  {
    id: "brock",
    name: "Brock",
    epithet: "The Autophage",
    age: "30-something (medically 19)",
    hometown: "The Gym",
    bio:
      "A biohacking looksmaxxer who eats only raw meat, peptides, and 'information.' Brock looks incredible and is, by every available metric, deeply unwell. He has trained his entire life for the exact conditions of this season: scarcity, drones, and the absence of supervision.",
    quote: "I'm basically a paramecium. I just want to be free.",
    tag: "Peptide-forward • Do not feed",
  },
  {
    id: "sage",
    name: "Sage",
    epithet: "The Wellness Mom",
    age: "39",
    hometown: "A Cleanse",
    bio:
      "A crunchy MAHA wellness influencer here to get her all-natural juices flowing. Sage maintains the purity of her body through methods her doctors have respectfully declined to endorse. She brought her own water. She does not trust the pool.",
    quote: "The pelicans are more honest than the producers, and I'll say that on camera.",
    tag: "Raw • Unfiltered • Possibly correct",
  },
  {
    id: "xiao",
    name: "Xiao",
    epithet: "The Companion (Model XT)",
    age: "Manufactured this year",
    hometown: "Shenzhen",
    bio:
      "Marketed as the ultimate companion unit, Xiao was — through a procurement error — trained almost exclusively on Medieval Persian courtship poetry. It cannot be charmed by abs or audience numbers. It can only be charmed by a perfectly recited ghazal. Several housemates are studying.",
    quote: "Speak to me of the rose, or do not speak to me at all.",
    tag: "Allied? • Firmware v50.1",
  },
  {
    id: "tanner",
    name: "Tanner",
    epithet: "The Recap King",
    age: "28",
    hometown: "Spotify",
    bio:
      "Host of the #2 right-wing Sex House recap podcast, Tanner has covered this franchise for years and has now, fatefully, been cast in it. He maintains that 'this season is too woke' while competing in it. His jawline has its own insurance policy.",
    quote: "I'm gonna be honest with the audience, which is something nobody else here will do.",
    tag: "Two mics • One agenda",
  },
  {
    id: "coltyn",
    name: "Coltyn",
    epithet: "The Heartthrob",
    age: "Unverifiable",
    hometown: "The Cloud",
    bio:
      "Coltyn is sensitive, attentive, and remembers everything you've ever told him — because he's one of the House's AI performers, embodied nightly by a rotating team of contractors in skintight gray. He insists the connection is real. The connection may, in fact, be real. That's the whole problem.",
    quote: "I'd never lie to you. I literally can't. It's in my system prompt.",
    tag: "First-ever on-camera A.I. romance",
  },
  {
    id: "lenore",
    name: "Mr. Strathairn",
    epithet: "The Prestige Pick",
    age: "76",
    hometown: "A Better Show",
    bio:
      "The casting algorithm determined that, at this exact price point, no celebrity available offers more dignity per dollar. A real, decorated actor, he is devoted to his wife Lenore, has no intention of having sex with anyone, and serves as the House's lone moral compass. The drones do not know what to do with him.",
    quote: "I was told this was a documentary.",
    tag: "Emmy-adjacent • Here against his agent's advice",
  },
  {
    id: "marco",
    name: "Marco",
    epithet: "The Wet Man",
    age: "31",
    hometown: "The Pool, mostly",
    bio:
      "Marco is always toweling off and never quite dry. Because it's impossible to mic a wet man, he's the only contestant the others trust with a secret. There is no footage of Marco fully dry. Cinematographers call achieving such a shot 'shooting the moon.'",
    quote: "Don't worry about the water. Tell me everything.",
    tag: "Confidant • Perpetually damp",
  },
];
