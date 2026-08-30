export const metadata = {
  title: 'Privacy Policy — ByUs',
  description: 'What information ByUs collects, how it is used, and who to contact about it.',
};

const LAST_UPDATED = 'August 30, 2026';
const CONTACT_EMAIL = 'evanryon@yahoo.com';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[#1A1A1A]">Privacy Policy</h1>
      <p className="mt-2 text-sm text-black/45">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-black/75">
        <Section title="1. What we collect">
          <p>
            When you create an account, we collect your email address, password (stored as a
            salted hash, never in plain text), the role you sign up as, and anything else you
            choose to add to your profile — a display name, bio, tags, and profile photo.
          </p>
          <p className="mt-3">
            If you&rsquo;re a creator, connecting Stripe shares your Stripe account identifiers
            with us so we can route payouts; we don&rsquo;t receive or store your bank details or
            card numbers, which stay with Stripe. If you&rsquo;re a fan, your payment details are
            entered directly into Stripe&rsquo;s checkout and never touch our servers.
          </p>
          <p className="mt-3">
            We also automatically collect basic technical information — IP address, browser
            type, and general usage activity — used for security purposes like rate-limiting and
            fraud prevention.
          </p>
        </Section>

        <Section title="2. How we use it">
          <p>
            We use your information to run your account, process subscriptions and payouts,
            verify your email address, send account-related emails (verification, password
            resets, receipts), prevent fraud and abuse, and improve ByUs. We don&rsquo;t sell
            your personal information.
          </p>
        </Section>

        <Section title="3. Who we share it with">
          <p>
            We share what&rsquo;s necessary to run the service with the vendors that power
            it &mdash; Stripe for payments and payouts, our hosting and database providers, and
            our email provider for transactional messages. We don&rsquo;t share your information
            with anyone else except where required by law.
          </p>
          <p className="mt-3">
            A creator&rsquo;s public profile, posts, and tier information are visible to anyone
            who visits their page, by design. Your email address is never shown publicly.
          </p>
        </Section>

        <Section title="4. Cookies and sessions">
          <p>
            We use a single session cookie to keep you signed in. It&rsquo;s required for the
            site to function and isn&rsquo;t used for advertising or cross-site tracking.
          </p>
        </Section>

        <Section title="5. Data retention">
          <p>
            We keep your account information for as long as your account is active. If you
            delete your account, we remove or anonymize your personal information within a
            reasonable time, except where we&rsquo;re required to retain records (for example,
            payment records Stripe keeps for tax or legal purposes).
          </p>
        </Section>

        <Section title="6. Your choices">
          <p>
            You can review and update your profile information at any time from your account
            settings, and you can request that we delete your account and associated personal
            data by emailing us.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            Passwords are hashed, sensitive account actions are rate-limited, and traffic to
            ByUs is encrypted in transit. No system is perfectly secure, but we take reasonable,
            industry-standard steps to protect your information.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            If we make material changes to this policy, we&rsquo;ll update the date at the top of
            this page.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about this policy, or want to access, correct, or delete your data? Email
            us at{' '}
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
