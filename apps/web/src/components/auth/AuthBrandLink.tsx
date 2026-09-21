import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type AuthBrandLinkProps = {
  className?: string;
  titleClassName?: string;
  gamingWordmark?: boolean;
};

export function AuthBrandLink({ className, titleClassName, gamingWordmark = false }: AuthBrandLinkProps) {
  return (
    <Link to="/" aria-label="Hasheem Studio" className={cn("flex min-w-0 items-center gap-2 font-semibold tracking-tight sm:gap-3", className)}>
      <img
        src="/images/brand/hasheem-gaming-emblem.jpg"
        alt="Hasheem Gaming emblem"
        className="h-9 w-9 shrink-0 rounded-md object-cover sm:h-10 sm:w-10"
      />
      <img
        src={gamingWordmark ? "/images/brand/hasheem-gaming-wordmark-dark.png" : "/images/brand/hasheem-studio-wordmark.png"}
        alt={gamingWordmark ? "Hasheem Gaming" : "Hasheem Studio"}
        className={cn("h-auto max-w-full object-contain object-left", gamingWordmark ? "w-36 sm:w-44" : "w-40 sm:w-52", titleClassName === "text-2xl" && "sm:w-60")}
      />
    </Link>
  );
}
