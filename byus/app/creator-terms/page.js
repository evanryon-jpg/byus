export const metadata = {
  title: 'Creator Agreement — ByUs',
  description: 'Additional terms for creators who publish and earn through ByUs.',
};

const CONTACT_EMAIL = 'support@byusapp.com';

export default function CreatorAgreementPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[#172033]">Creator Agreement</h1>
      <p className="mt-2 text-sm text-brand-ink/60">Version 2026-09-23 · Last updated September 23, 2026</p>
      <p className="mt-6 text-[15px] leading-relaxed text-brand-ink/85">
        This Creator Agreement supplements the <a href="/terms" className="text-brand-teal underline">Terms of Service</a>.
        If you create, publish, sell, or receive money through ByUs, you agree to both documents and the{' '}
        <a href="/content-policy" className="text-brand-teal underline">Content Policy</a>.
      </p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-brand-ink/85">
        <Section title="1. Independent creator">
          <p>You operate independently and are not an employee, agent, partner, joint venturer, or representative of Ryon Digital LLC or ByUs. You cannot bind ByUs or make promises on its behalf.</p>
        </Section>
        <Section title="2. Your content and offers">
          <p>You are solely responsible for everything you upload, publish, advertise, sell, promise, or communicate through ByUs. You must accurately describe your content, memberships, products, delivery timing, eligibility, and any limitations, and you must provide what supporters purchase.</p>
        </Section>
        <Section title="3. Rights and permissions">
          <p>You represent and warrant that you own your content or have all licenses, model releases, publicity permissions, music rights, trademark permissions, and other authorizations needed to use it on ByUs. You also represent that your content and conduct do not violate law, contract, privacy, publicity, intellectual-property, or other third-party rights.</p>
        </Section>
        <Section title="4. License to operate ByUs">
          <p>You keep ownership of your content. You grant ByUs a worldwide, non-exclusive, royalty-free license to host, store, reproduce, format, transmit, display, and distribute it only as reasonably necessary to operate, secure, moderate, promote, and improve ByUs. This includes creating technical copies and previews. The license ends after deletion except for reasonable backups, required legal retention, and copies already shared at your direction.</p>
        </Section>
        <Section title="5. Supporters, delivery, and disputes">
          <p>You are responsible for your relationship with supporters, including promised benefits, digital products, customer communications, lawful refund obligations, and the creator portion of refunds, reversals, and chargebacks. ByUs may remove an offer, issue or facilitate a refund, reserve or recover funds, or provide transaction evidence to a payment processor when reasonably necessary and permitted by law.</p>
        </Section>
        <Section title="6. Taxes and compliance">
          <p>You are responsible for licenses, registrations, reporting, and taxes assigned to you by law. ByUs may collect, withhold, report, or remit amounts when legally required and may request accurate tax or identity information before enabling or releasing payments.</p>
        </Section>
        <Section title="7. Moderation and cooperation">
          <p>You will follow the Content Policy and cooperate with reasonable investigations. ByUs may screen, review, restrict, remove, preserve, or report content and may suspend features, sales, or accounts when we reasonably believe a violation, fraud, safety risk, legal obligation, or payment risk exists. Automated screening can make mistakes; if your account is suspended and you believe it was a mistake, use the <a href="/appeal" className="text-brand-teal underline">appeal form</a> to request review.</p>
        </Section>
        <Section title="8. Indemnification">
          <p>To the fullest extent permitted by law, you will defend, indemnify, and hold harmless Ryon Digital LLC, ByUs, and their owners, officers, contractors, and service providers from third-party claims, losses, liabilities, damages, judgments, and reasonable legal fees arising from your content, offers, conduct, breach of these agreements, violation of law, or infringement of another person&rsquo;s rights. We will provide reasonable notice and may participate in the defense. You may not settle in a way that admits fault by or imposes obligations on ByUs without our written consent.</p>
        </Section>
        <Section title="9. Contact">
          <p>Questions may be sent to <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-teal underline">{CONTACT_EMAIL}</a>.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <section><h2 className="font-display text-lg font-semibold text-[#172033]">{title}</h2><div className="mt-2">{children}</div></section>;
}
