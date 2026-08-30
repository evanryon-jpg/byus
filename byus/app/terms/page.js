export const metadata = {
  title: 'Terms of Service — ByUs',
  description: 'The terms that govern using ByUs as a creator or a fan.',
};

const LAST_UPDATED = 'August 30, 2026';
const CONTACT_EMAIL = 'evanryon@yahoo.com';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[#1A1A1A]">Terms of Service</h1>
      <p className="mt-2 text-sm text-black/45">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-black/75">
        <Section title="1. Who these terms cover">
          <p>
            These terms govern your use of ByUs (&ldquo;ByUs,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;),
            a platform that lets creators offer paid membership tiers and lets fans subscribe to
            support them. By creating an account, you agree to these terms and to our{' '}
            <a href="/privacy" className="text-brand-teal underline">Privacy Policy</a>.
            If you don&rsquo;t agree, please don&rsquo;t use ByUs.
          </p>
        </Section>

        <Section title="2. Accounts">
          <p>
            You need an account to create or support memberships. You&rsquo;re responsible for
            keeping your login credentials secure and for anything that happens under your
            account. You must provide an accurate, working email address — we use it for
            account verification, receipts, and important notices about your account.
          </p>
          <p className="mt-3">
            You must be at least 18 years old, or the age of majority where you live, to create
            an account.
          </p>
        </Section>

        <Section title="3. Creators">
          <p>
            Creators can publish public and subscribers-only posts and set one or more monthly
            subscription tiers. Payments are processed through Stripe, and each creator connects
            their own Stripe account to receive payouts directly. Creators keep 90% of each
            payment; ByUs retains a flat 10% platform fee. We don&rsquo;t add hidden processing,
            payout, or currency-conversion charges on top of that fee — any charges Stripe itself
            applies are between you and Stripe under their own terms.
          </p>
          <p className="mt-3">
            You&rsquo;re responsible for the content you post and for honoring what you promise
            subscribers. Content that is illegal, infringing, or that violates the content
            guidelines below can be removed, and repeated or serious violations can result in
            account suspension.
          </p>
        </Section>

        <Section title="4. Fans and subscriptions">
          <p>
            Subscriptions renew monthly until you cancel. Cancelling stops future renewals but
            doesn&rsquo;t retroactively refund the current billing period unless we say otherwise
            in a specific case. You can manage or cancel a subscription from your dashboard at
            any time.
          </p>
        </Section>

        <Section title="5. Content guidelines">
          <p>
            Don&rsquo;t post content that is illegal, that infringes someone else&rsquo;s
            intellectual property or other rights, that harasses or endangers others, or that
            sexualizes or otherwise endangers minors. We can remove content or suspend accounts
            that violate this, and we may report unlawful content to appropriate authorities
            where required.
          </p>
        </Section>

        <Section title="6. Fake accounts and abuse">
          <p>
            Automated, fraudulent, or duplicate account creation, and any attempt to circumvent
            our account-verification or rate-limiting protections, is not allowed and may result
            in account termination.
          </p>
        </Section>

        <Section title="7. Termination">
          <p>
            You can stop using ByUs and delete your account at any time. We can suspend or
            terminate accounts that violate these terms. Where reasonably possible we&rsquo;ll
            give notice first, but we may act immediately for serious violations.
          </p>
        </Section>

        <Section title="8. Disclaimers and liability">
          <p>
            ByUs is provided &ldquo;as is,&rdquo; without warranties of any kind. We&rsquo;re not
            liable for indirect, incidental, or consequential damages arising from your use of
            the platform, to the fullest extent the law allows. Nothing here limits liability
            that can&rsquo;t legally be limited.
          </p>
        </Section>

        <Section title="9. Changes to these terms">
          <p>
            We may update these terms as ByUs evolves. If we make material changes, we&rsquo;ll
            update the date at the top of this page. Continuing to use ByUs after a change means
            you accept the updated terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions about these terms? Reach us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-teal underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-[#1A1A1A]">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
