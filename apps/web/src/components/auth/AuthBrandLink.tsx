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
        src="/images/brand/hasheem-studio-script-wordmark.png"
        alt="Hasheem Studio"
        className={cn("h-auto w-44 max-w-full object-contain object-left sm:w-56", titleClassName === "text-2xl" && "sm:w-64")}
      />
    </Link>
  );
}
