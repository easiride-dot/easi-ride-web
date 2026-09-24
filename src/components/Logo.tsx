import { Link, useLocation } from "react-router-dom";
import brandLogo from "@/assets/brand-logo.png";

export const Logo = ({ className = "" }: { className?: string }) => {
  const location = useLocation();
  const onLanding = location.pathname === "/";
  const content = (
    <>
      <img
        src={brandLogo}
        alt="Easi Ride logo"
        className="h-8 w-8 rounded-lg object-cover shadow-cta"
      />
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
