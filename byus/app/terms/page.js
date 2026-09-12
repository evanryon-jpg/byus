export const metadata = {
  title: 'Terms of Service — ByUs',
  description: 'The terms that govern using ByUs as a creator or a fan.',
};

const LAST_UPDATED = 'September 12, 2026';
const CONTACT_EMAIL = 'support@byusapp.com';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[#2B2420]">Terms of Service</h1>
      <p className="mt-2 text-sm text-brand-ink/60">Last updated {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-brand-ink/85">
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
            or annual subscription tiers. Payments are processed through Stripe, and each creator
            connects their own Stripe account to receive payouts. ByUs retains the platform fee
            shown in the creator dashboard and routes the remaining proceeds to the creator&rsquo;s
            connected Stripe account. Stripe may separately charge processing, payout, currency-
            conversion, dispute, or other fees under Stripe&rsquo;s own terms.
          </p>
          <p className="mt-3">
            You&rsquo;re responsible for the content you post and for honoring what you promise
            subscribers. Content that is illegal, infringing, or that violates the content
            guidelines below can be removed, and repeated or serious violations can result in
            account suspension.
          </p>
          <p className="mt-3">
            If a payment to you is refunded, reversed, disputed, charged back, or otherwise
            returned to a fan, you remain responsible for the creator portion of that transaction
            to the extent permitted by law and Stripe&rsquo;s rules. ByUs may reverse or recover funds
            from your connected Stripe balance when appropriate, including when a dispute is lost
            or a refund is issued. ByUs will not intentionally recover more than the creator share
            attributable to the affected transaction, and any recovery is subject to Stripe&rsquo;s
            technical and legal limitations.
          </p>
        </Section>

        <Section title="4. Fans, subscriptions, tips, cancellations, and refunds">
          <p>
            Subscription pricing and billing frequency are shown before purchase. Unless a tier
            includes a free trial, your first payment is charged when checkout completes.
            Subscriptions renew automatically at the displayed monthly or annual interval until
            you cancel. If a free trial applies, the recurring charge begins after the trial ends
            unless you cancel before then.
          </p>
          <p className="mt-3">
            You can manage or cancel a subscription at any time from your dashboard. Cancelling
            prevents future renewal charges but does not automatically refund a payment that has
            already been processed.
          </p>
          <p className="mt-3">
            Membership payments and one-time tips are generally non-refundable once processed.
            This does not limit any refund, cancellation, or dispute rights you may have under
            applicable law or card-network rules. ByUs may also issue a refund when we determine
            one is appropriate, including for duplicate charges, unauthorized payments, technical
            failures, or failure to provide the purchased access.
          </p>
          <p className="mt-3">
            If you believe you were charged in error, did not authorize a payment, or did not
            receive the access you purchased, please contact{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-teal underline">
              {CONTACT_EMAIL}
            </a>{' '}
            so we can investigate promptly.
          </p>
        </Section>

        <Section title="5. Content guidelines">
          <p>
            Don&rsquo;t post content that is illegal, that infringes someone else&rsquo;s
            intellectual property or other rights, or that harasses or endangers others.
          </p>
          <p className="mt-3">
            ByUs is not an adult platform. Pornography, sexually explicit material, adult
            services, and any other content whose primary purpose is sexual gratification are
            not allowed anywhere on ByUs, in any tier or format. Content that sexualizes or
            otherwise endangers minors is never allowed, under any circumstances.
          </p>
          <p className="mt-3">
            This includes linking off-platform to adult or sexually explicit content — in your
            bio, your posts, or anywhere else on your ByUs page. Directing people to adult
            websites or services from ByUs is itself a violation of these terms, even if the
            explicit content isn&rsquo;t hosted on ByUs directly, and results in an immediate
            account ban.
          </p>
          <p className="mt-3">
            Content that engages in, encourages, promotes, or celebrates unlawful violence, or
            hate speech targeting any group based on race, religion, disability, gender, sexual
            orientation, national origin, or any other immutable characteristic, is never allowed
            on ByUs and results in an immediate account ban.
          </p>
          <p className="mt-3">
            We use automated screening — including keyword and link filtering — to catch
            violations of this section before content is published, in addition to manual
            review. New creator accounts go through a one-time initial review before they can
            accept their first paid subscriber or tip.
          </p>
          <p className="mt-3">
            We can remove content or suspend accounts that violate this, and we may report
            unlawful content to appropriate authorities where required.
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
      <h2 className="font-display text-lg font-semibold text-[#2B2420]">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
