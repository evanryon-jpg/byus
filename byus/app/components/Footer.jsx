export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-brand-ink/5 bg-brand-paper">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-10 text-sm text-brand-ink/65 sm:flex-row sm:justify-between">
        <p>&copy; {year} ByUs, operated by Ryon Digital LLC. All rights reserved.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="/help" className="hover:text-brand-ink/80">Help Center</a>
          <a href="/terms" className="hover:text-brand-ink/80">Terms of Service</a>
          <a href="/privacy" className="hover:text-brand-ink/80">Privacy Policy</a>
          {/* Public ByUs community -- distinct from the per-creator Discord/Telegram
              account-linking feature (see Settings), this is a single server anyone
              can drop into: fans, creators thinking about joining, and anyone with
              questions before signing up. */}
          <a
            href="https://discord.gg/Bw5SDk3y9"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#5865F2]"
          >
            Join us on Discord
          </a>
          <a href="mailto:support@byusapp.com" className="hover:text-brand-ink/80">
            support@byusapp.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
