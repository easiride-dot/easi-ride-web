import { Link, useLocation } from "react-router-dom";
import { Car } from "lucide-react";

export const Logo = ({ className = "" }: { className?: string }) => {
  const location = useLocation();
  const onLanding = location.pathname === "/";
  const content = (
    <>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-cta">
        <Car className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <span className="font-display text-lg font-semibold tracking-tight">
        Easi<span className="text-muted-foreground">Ride</span>
      </span>
    </>
  );

  const classes = `flex items-center gap-2 ${className}`;

  if (onLanding) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <Link to="/" className={classes}>
      {content}
    </Link>
  );
};
