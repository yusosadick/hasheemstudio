import { Outlet } from "react-router-dom";
import { Nav } from "./components/Nav";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
