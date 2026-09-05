export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-brand-ink/5 bg-brand-paper">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-10 text-sm text-brand-ink/65 sm:flex-row sm:justify-between">
        <p>&copy; {year} ByUs. All rights reserved.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a href="/help" className="hover:text-brand-ink/80">Help Center</a>
          <a href="/terms" className="hover:text-brand-ink/80">Terms of Service</a>
          <a href="/privacy" className="hover:text-brand-ink/80">Privacy Policy</a>
          <a href="mailto:evanryon@yahoo.com" className="hover:text-brand-ink/80">
            evanryon@yahoo.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
