export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">
            BobBot
          </h1>
          <p className="text-xl text-muted-foreground">
            Mission Control
          </p>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-3xl">🤖</span>
          </div>
          <p className="text-muted-foreground max-w-md">
            Agent orchestration platform for OpenClaw. 
            Manage agents, tasks, and workflows in one place.
          </p>
        </div>

        <div className="pt-4">
          <a
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Sign In
          </a>
        </div>

        <p className="text-xs text-muted-foreground pt-8">
          Requires 2FA authentication
        </p>
      </div>
    </main>
  );
}
