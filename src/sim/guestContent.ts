import { RHINO_PRANK } from './hazards.ts';
import { shuffle } from './encounters.ts';

export const TAKES = [
  'Dress shoes should have turn signals.',
  'A folding chair is a carry-on apartment.',
  'A subway nap counts as time travel.',
  'Soup is a drink with furniture.',
  'Bodegas should offer a cat loyalty card.',
  'There should be a quiet car for your phone.',
  'Escalators should have an overtaking lane.',
  'The last slice of pizza is a public trust.',
  'Every umbrella should come with an apology.',
  'A group chat needs an emergency exit.',
  'Freeze the rent and unfreeze the platform.',
  'The train should pause for a good bass solo.',
  'Window seats should come with binoculars.',
  'All tiny dogs are off-duty security guards.',
  'The mayor should ride the train with groceries.',
  'A rainy day should count as a free transfer.',
  'The subway map should be a picnic blanket.',
  'Stop putting tiny forks in big desserts.',
  'Pigeons know the weekend schedule.',
  'We should let the city have a bedtime.',
  'The best bagel is the one you didn’t share.',
  'Running for the train is an unpaid internship.',
  'Every station needs a lost-and-found fashion show.',
  'Any bag that needs a second seat pays fare.',
];

export const WEIRD_LINES = [
  'I taught a pigeon to parallel park.',
  'The moon owes me seven dollars.',
  'Nobody checks the expiration date on stairs.',
  'Do you think a ghost can get a seat?',
];

const extraTakes = [
  'Crosswalks should have a dance break.',
  'A sandwich cut in triangles tastes faster.',
  'The laundromat is the only fair place to race.',
  'A bad haircut deserves a transit discount.',
  'Brunch should come with a time limit.',
  'A deli cat should run the lost and found.',
  'If your plant survives winter, it gets its own key.',
  'The city should issue umbrellas the way it issues library cards.',
  'The person carrying the cake chooses where everyone sits.',
  'Every curb should have a bench for one dramatic phone call.',
  'A competent squirrel could run a ferry.',
  'We should put crossword clues on the back of receipts.',
  'If you can hear someone’s headphones, you get to pick the next song.',
  'There should be an express line for groceries that are melting.',
  'A cartwheel should count as proof of address.',
  'A remote meeting should come with a mute button for the host.',
  'A roller bag deserves turn signals and a tiny horn.',
  'Put the best apartment listings in the library, like everyone else’s fiction.',
  'An evening commute needs an intermission.',
  'Pizza boxes should come with emergency napkins.',
  'A coat check should also check whether the coat looks good.',
  'Every museum needs one chair with no explanation.',
  'If dogs can sit in bags, bags should get dog names.',
  'A neon sign should have business hours of its own.',
  'The unofficial sport of New York is guessing which door will open.',
  'A hot dog cart should offer a coat check for mustard stains.',
  'You should get a rehearsal swipe before paying a fare.',
  'Every landlord should have to move a couch up their own stairs.',
];

const extraWeird = [
  'I keep my least favorite receipt in a tiny safe.',
  'That station clock and I are seeing other people.',
  'I brought snacks for the train itself.',
  'I just got a library card for my shadow.',
  'This floor remembers every shoe.',
  'I don’t trust escalators that know my name.',
  'Once I saw a pigeon return a rental car.',
  'Do you think a nap can be notarized?',
  'I’m on my way to unlearn the trombone.',
  'The moon isn’t late. It’s avoiding me.',
  'My sandwich is saving the seat next to it.',
  'I think my wallet has an accent.',
  'I’m pretty sure somebody taught my toaster to whistle.',
  'The station attendant gave my ghost a transfer.',
  'I’m returning this scarf to the wind.',
  'My therapist says I should stop arguing with turnstiles.',
  'I’m collecting bad advice for a museum.',
  'If the city ever gets quiet, blow this imaginary whistle.',
  'I wave at the pigeons so they’ll put in a good word.',
  'That advertisement just blinked. Don’t tell it I saw.',
  'I promised the moon I wouldn’t use its real name.',
  'The bench at my usual stop knows too much.',
  'I have a coupon for an emergency rainstorm.',
  'My houseplants are interviewing for a new roommate.',
  'Can I audition for the role of your nemesis?',
  'We have exactly the same number of invisible pets.',
];

export const ACROBAT_MOVES = [
  'Pole swing',
  'Handstand',
  'Corkscrew',
  'High kick',
  'Cartwheel',
] as const;

export const MUSICIAN_SONGS = [
  'Off-Key',
  'Crooked Waltz',
  'Tin Can Blues',
  'Cardboard Tango',
  'Wrong Stop',
] as const;

export const PRANKS = [
  {
    name: 'Inflatable pigeon',
    lines: [
      'Eric: I brought my emotional support pigeon.',
      'Eric: It’s also the assistant conductor.',
      'Eric: Look out! It’s learning to fly!',
      'Eric: This bird has a transferable pension.',
      'Eric: Please direct all complaints to the pigeon.',
    ],
  },
  {
    name: 'Hot dog launch',
    lines: [
      'Eric: I need a volunteer to catch lunch.',
      'Eric: Who approved the mustard thrusters?',
      'Eric: The hot dog has cleared the launchpad.',
      'Eric: Is there a bun in the next car?',
      'Eric: People of Earth, please stand back.',
    ],
  },
  {
    name: 'Traffic cone choir',
    lines: [
      'Eric: These cones passed their auditions.',
      'Eric: Cone number two, sing from your diaphragm.',
      'Eric: The orange one wants a solo.',
      'Eric: Don’t clap until the road reopens.',
      'Eric: Somebody get this cone a record deal.',
    ],
  },
  {
    name: 'Briefcase fish',
    lines: [
      'Eric: This fish is my business partner.',
      'Eric: It wants to discuss the quarterly numbers.',
      'Eric: Don’t look it in the tie.',
      'Eric: The fish has rejected our proposal.',
      'Eric: Good meeting, everybody.',
    ],
  },
  {
    name: 'Rubber stampede',
    lines: [
      'Eric: My suitcase is full of tiny horses.',
      'Eric: They’re here for a dress rehearsal.',
      'Eric: It’s an express stampede.',
      'Eric: Stop feeding them your MetroCards.',
      'Eric: The horses are refusing to go local.',
    ],
  },
  {
    name: 'Rhino on the 4',
    lines: [
      'Eric: Rhino coming through. He has exact change.',
      'Eric: The horn is my MetroCard.',
      'Eric: Sorry. He is still learning what an aisle is.',
      'Eric: Please remain calm. He only charges at express stops.',
      'Eric: Does anybody know a good rhino tailor?',
    ],
  },
] as const;

export function guestContent(random: () => number) {
  const takes = shuffle([...TAKES, ...extraTakes], random);
  const weird = shuffle([...WEIRD_LINES, ...extraWeird], random);
  const pranks = PRANKS.map(({ lines }) => shuffle([...lines], random));
  const sequences = {
    acrobat: [...ACROBAT_MOVES.keys()],
    musician: [...MUSICIAN_SONGS.keys()],
    prank: [...PRANKS.keys()],
  };

  type Variety = keyof typeof sequences;

  const bags: Record<Variety, number[]> = { acrobat: [], musician: [], prank: [] };
  const previous: Partial<Record<Variety, number>> = {};

  function variant(kind: Variety) {
    if (bags[kind].length === 0) {
      const deck = shuffle([...sequences[kind]], random);

      if (kind === 'prank' && previous[kind] === undefined) {
        const rhino = deck.indexOf(RHINO_PRANK);

        deck.push(deck.splice(rhino, 1)[0]);
      }

      const last = deck.length - 1;

      if (deck[last] === previous[kind]) [deck[0], deck[last]] = [deck[last], deck[0]];

      bags[kind] = deck;
    }

    const next = bags[kind].pop()!;

    previous[kind] = next;

    return next;
  }

  return { takes, weird, pranks, variant };
}
