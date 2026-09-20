import { Outlet } from "react-router-dom";
import { Nav } from "./components/Nav";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground sm:px-5 sm:py-5">
      <div className="relative mx-auto min-h-[calc(100vh-2.5rem)] max-w-[1480px] overflow-hidden border-border sm:border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 z-0 hidden w-full max-w-6xl -translate-x-1/2 border-x border-dashed border-border/35 lg:block"
        />
        <div className="relative z-10">
          <Nav />
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
