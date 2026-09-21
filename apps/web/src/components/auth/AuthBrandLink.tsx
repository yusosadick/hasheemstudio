import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AuthBrandLink({ className, titleClassName }: { className?: string; titleClassName?: string }) {
  return (
    <Link to="/" aria-label="Hasheem Studio" className={cn("flex min-w-0 items-center gap-2 font-semibold tracking-tight sm:gap-3", className)}>
      <img
        src="/images/brand/hasheem-gaming-wordmark-dark.png"
        alt="Hasheem Gaming"
        className={cn("h-auto w-40 max-w-full object-contain object-left sm:w-48", titleClassName === "text-2xl" && "sm:w-56")}
      />
    </Link>
  );
}
