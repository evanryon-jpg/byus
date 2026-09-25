// Each sample post carries an illustrative { views, likes } pair -- same spirit as
// the "1.2K views · 340 likes" mock stat block on the homepage's Engagement card:
// plausible, not real activity, and roughly scaled to each fictional creator's own
// `members` count so a creator with more (fictional) members shows more engagement.
export const DEMO_PROFILES = {
  'maya-sinclair': {
    name: 'Maya Sinclair', handle: '@mayasinclair', craft: 'Outdoor Photographer', image: '/creators/maya-sinclair/hero.jpg', members: 684, posts: 47, monthly: 4760,
    bio: 'Field notes, editing breakdowns, and quiet photographs from wild places. I share the planning and patience behind every frame.',
    tiers: [['Field Notes', 8, 'Weekly photo stories and location notes'], ['Darkroom', 14, 'Editing walkthroughs and full-resolution downloads']],
    samples: [
      { title: 'Before sunrise in the Olympic rainforest', views: 905, likes: 96 },
      { title: 'How I edit for natural color', views: 648, likes: 71 },
      { title: 'Packing light for a three-day shoot', views: 417, likes: 54 },
    ],
  },
  'liam-carter': {
    name: 'Liam Carter', handle: '@liamcarter', craft: 'Independent Musician', image: '/creators/liam-carter/hero.jpg', members: 932, posts: 63, monthly: 7215,
    bio: 'Songs in progress, studio sessions, and the stories behind the lyrics. Members hear every release before it reaches the rest of the world.',
    tiers: [['Backstage', 8, 'Early demos and monthly listening notes'], ['Studio Pass', 15, 'Livestreams, stems, and member song requests']],
    samples: [
      { title: 'A first listen to Northbound', views: 1150, likes: 140 },
      { title: 'Building the chorus one layer at a time', views: 887, likes: 118 },
      { title: 'Live acoustic session — September', views: 643, likes: 92 },
    ],
  },
  'elena-park': {
    name: 'Elena Park', handle: '@signwithelena', craft: 'ASL Educator', image: '/creators/elena-park/hero.jpg', members: 511, posts: 76, monthly: 3890,
    bio: 'Practical American Sign Language lessons built around real conversations, Deaf culture, and confident everyday communication.',
    tiers: [['Practice Partner', 9, 'Weekly vocabulary lessons and practice prompts'], ['Conversation Club', 18, 'Full lessons, live practice, and feedback']],
    samples: [
      { title: 'Ten signs for meeting someone new', views: 724, likes: 64 },
      { title: 'Facial grammar: the part beginners miss', views: 539, likes: 52 },
      { title: 'Member practice session replay', views: 381, likes: 41 },
    ],
  },
  'sophie-lane': {
    // Photo and copy switched to pottery on Sept 25 so this page matches Sophie as she
    // appears in the homepage film (a still from that footage is her photo now).
    name: 'Sophie Lane', handle: '@sophiemakes', craft: 'Ceramic Artist', image: '/creators/sophie-lane/hero-potter.jpg', members: 408, posts: 54, monthly: 3060,
    bio: 'Slow, useful pottery made by hand. I share throwing techniques, glaze tests, mistakes, and the small habits that make handmade work last.',
    tiers: [['Studio Circle', 8, 'Studio notes, glaze recipes, and process videos'], ['Maker Circle', 12, 'Full tutorials, monthly projects, and Q&A']],
    samples: [
      { title: 'From clay to your first bowl', views: 562, likes: 48 },
      { title: 'Choosing glazes that age well', views: 413, likes: 37 },
      { title: 'October member glaze preview', views: 296, likes: 29 },
    ],
  },
  'noah-blake': {
    name: 'Noah Blake', handle: '@trainwithnoah', craft: 'Fitness Creator', image: '/creators/noah-blake/hero.jpg', members: 1206, posts: 91, monthly: 9648,
    bio: 'Sustainable strength training for busy people. No extremes—just clear programs, good form, and habits you can keep.',
    tiers: [['Training Notes', 8, 'Weekly workouts and technique cues'], ['Coaching Room', 20, 'Programs, live form reviews, and member Q&A']],
    samples: [
      { title: 'The 30-minute full-body strength plan', views: 1482, likes: 172 },
      { title: 'Fixing your squat without overthinking it', views: 1119, likes: 143 },
      { title: 'Four-week consistency challenge', views: 856, likes: 118 },
    ],
  },
};
