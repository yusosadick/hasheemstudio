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
        src="/images/brand/hasheem-gaming-emblem.jpg"
        alt="Hasheem Studio emblem"
        className="h-9 w-9 shrink-0 rounded-md object-cover sm:h-10 sm:w-10"
      />
      <img
        src="/images/brand/hasheem-studio-wordmark.png"
        alt="Hasheem Studio"
        className={cn("h-auto w-40 max-w-full object-contain object-left sm:w-52", titleClassName === "text-2xl" && "sm:w-60")}
      />
    </Link>
  );
}
