export function SiteFooter() {
  return (
    <footer className="border-t py-6 text-center text-sm text-muted-foreground">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center space-y-3">
          <p>
            Built by{" "}
            <a
              href="https://neilstephenson.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Neil Stephenson
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
