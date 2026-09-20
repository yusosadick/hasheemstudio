import { Link } from "react-router-dom";
import { IconFilm } from "../Icons";
import { cn } from "@/lib/utils";

export function AuthBrandLink({ className, titleClassName }: { className?: string; titleClassName?: string }) {
  return <Link to="/" aria-label="Hasheem Studio" className={cn("flex min-w-0 items-center gap-2 font-semibold tracking-tight sm:gap-3", className)}>
    <span className="hidden h-9 w-9 shrink-0 items-center justify-center border border-border bg-surface1 min-[380px]:flex"><IconFilm className="text-accent" width={20} height={20} /></span>
    <span className={cn("text-sm sm:text-xl", titleClassName)}>Hasheem Studio</span>
  </Link>;
}
