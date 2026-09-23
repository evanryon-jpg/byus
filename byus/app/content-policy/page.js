export const metadata = {
  title: 'Content Policy — ByUs',
  description: 'Rules for content and conduct on ByUs.',
};

const CONTACT_EMAIL = 'support@byusapp.com';

export default function ContentPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[#172033]">Content Policy</h1>
      <p className="mt-2 text-sm text-brand-ink/60">Version 2026-09-23 · Last updated September 23, 2026</p>
      <p className="mt-6 text-[15px] leading-relaxed text-brand-ink/85">These rules apply to profiles, posts, messages, livestreams, audio, video, images, downloads, links, membership benefits, product listings, and other activity on ByUs.</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-brand-ink/85">
        <Section title="1. Illegal, exploitative, or dangerous material">
          <p>Do not post, sell, request, promote, or link to illegal activity; sexual exploitation; trafficking; nonconsensual intimate material; credible threats; instructions intended to facilitate serious wrongdoing; or material that exploits, sexualizes, grooms, or endangers a minor. Suspected child sexual abuse material is prohibited and may be preserved and reported as required by law.</p>
        </Section>
        <Section title="2. No adult content or services">
          <p>ByUs is not an adult platform. Pornography, sexually explicit material, nudity whose primary purpose is sexual gratification, fetish content, adult services, and links or directions to such material are prohibited in every format and tier.</p>
        </Section>
        <Section title="3. Rights, consent, and authenticity">
          <p>Only upload material you own or are authorized to use. Obtain necessary permission from people shown or heard. Do not infringe copyright or trademark, invade privacy or publicity rights, secretly record others unlawfully, impersonate someone, or use manipulated media to portray a real person sexually, violently, or materially deceptively without authorization.</p>
        </Section>
        <Section title="4. Harassment, hate, and violence">
          <p>Do not threaten, stalk, dox, harass, or encourage abuse of another person. Content that promotes or celebrates unlawful violence or attacks people based on protected or immutable characteristics is prohibited.</p>
        </Section>
        <Section title="5. Fraud and harmful commerce">
          <p>Do not run scams, make deceptive earnings or product claims, sell stolen or unlawful goods, distribute malware, phish for credentials, manipulate payments, evade sanctions, or use ByUs for money laundering or other prohibited financial activity.</p>
        </Section>
        <Section title="6. Enforcement">
          <p>ByUs may use automated screening and human review. Depending on severity and history, we may limit distribution, remove material, pause sales or payouts where permitted, require information, suspend or terminate an account, preserve evidence, or report suspected unlawful conduct. Immediate action may be taken when safety, law, payment risk, or platform integrity requires it.</p>
        </Section>
        <Section title="7. Reports and appeals">
          <p>Use the Report control on the relevant creator page or email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-teal underline">{CONTACT_EMAIL}</a> with the URL, a description, and supporting information. Account holders may use the same address to request review of a moderation decision. Copyright notices and counter-notices follow Section 6 of the <a href="/terms" className="text-brand-teal underline">Terms of Service</a>.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <section><h2 className="font-display text-lg font-semibold text-[#172033]">{title}</h2><div className="mt-2">{children}</div></section>;
}
