import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type AuthBrandLinkProps = {
  className?: string;
  titleClassName?: string;
};

export function AuthBrandLink({ className, titleClassName }: AuthBrandLinkProps) {
  return (
    <Link to="/" aria-label="Hasheem Studio" className={cn("flex min-w-0 items-center gap-2 font-semibold tracking-tight sm:gap-3", className)}>
      <img
        src="/images/brand/logo-96.png"
        width={48}
        height={48}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-lg sm:h-12 sm:w-12"
      />
      <img
        src="/images/brand/hasheem-studio-script-wordmark.png"
        alt="Hasheem Studio"
        className={cn("h-auto w-36 min-w-0 max-w-full object-contain object-left sm:w-48", titleClassName === "text-2xl" && "sm:w-56")}
      />
    </Link>
  );
}
