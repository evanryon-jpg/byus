export const metadata = {
  title: 'Photo credits — ByUs',
};

// Attribution for the free-to-use photos behind the homepage and browse-page
// collage (see app/components/PhotoCollageBackground.jsx). Every photo is public
// domain or Creative Commons licensed via Wikimedia Commons -- this page is the
// credit those licenses ask for.
const CREDITS = [
  {
    title: 'Making pottery',
    photographer: 'Jared Sluyter',
    license: 'CC0 / Public Domain',
    url: 'https://commons.wikimedia.org/wiki/File:Making_pottery_(Unsplash).jpg',
  },
  {
    title: "An artist painting the Caretaker's House",
    photographer: 'NPS Photo',
    license: 'Public Domain',
    url: 'https://commons.wikimedia.org/wiki/File:An_artist_painting_the_Caretaker%27s_House._Photograph._2014._(63935685-aa35-48a3-ac4c-9b4c064a3011).JPG',
  },
  {
    title: 'A Video Relay Service session with a sign language interpreter',
    photographer: 'SignVideo, London, U.K.',
    license: 'CC BY-SA 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:A_Video_Relay_Service_session_helping_a_Deaf_person_communicate_with_a_hearing_person_via_a_Video_Interpreter_(sign_language_interpreter)_and_a_videophone_DSC_0080.JPG',
  },
  {
    title: 'Hand carries wooden tray with decorated cupcakes',
    photographer: 'Shixart1985',
    license: 'CC BY 2.0',
    url: 'https://commons.wikimedia.org/wiki/File:Hand_carries_wooden_tray_with_cupcakes_decorated_with_small_figures_in_a_kitchen_setting.jpg',
  },
  {
    title: 'Shakertown craftsman making boxes',
    photographer: 'Tom Allen',
    license: 'CC BY-SA 2.0',
    url: 'https://commons.wikimedia.org/wiki/File:Shakertown_Craftsman_Boxes_2005-05-27.jpeg',
  },
  {
    title: 'Musician plays acoustic guitar in a serene outdoor setting',
    photographer: 'Shixart1985',
    license: 'CC BY 2.0',
    url: 'https://commons.wikimedia.org/wiki/File:Musician_plays_acoustic_guitar_in_a_serene_outdoor_setting_near_a_flower_pot.jpg',
  },
];

export default function PhotoCreditsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-[#2B2420]">Photo credits</h1>
      <p className="mt-3 text-brand-ink/68">
        The homepage and the Browse creators page use a background collage of real people at
        work. Every photo comes from Wikimedia Commons and is either public domain or
        Creative Commons licensed. Credit for each, as its license asks for:
      </p>

      <ul className="mt-8 space-y-5">
        {CREDITS.map((c) => (
          <li key={c.url} className="border-b border-brand-ink/10 pb-5">
            <p className="font-semibold text-[#2B2420]">{c.title}</p>
            <p className="mt-1 text-sm text-brand-ink/68">
              Photo by {c.photographer} · {c.license}
            </p>
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-medium text-brand-teal hover:underline"
            >
              View source on Wikimedia Commons →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
