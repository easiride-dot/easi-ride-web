import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Bell, Shield, MapPin, CreditCard, LogOut, HelpCircle, ShieldAlert, ShieldCheck, ShieldQuestion, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { uploadStudentId } from "@/lib/studentIdUpload";

const items = [
  { icon: CreditCard, label: "Payment & subscription", to: "#" },
  { icon: MapPin, label: "Saved locations", to: "#" },
  { icon: Bell, label: "Notifications", to: "#" },
  { icon: Shield, label: "Privacy & security", to: "#" },
  { icon: HelpCircle, label: "Help & support", to: "#" },
];

const Account = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/");
  };

  const handleStudentIdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploadingId(true);

    try {
      const { publicUrl } = await uploadStudentId(user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ student_id_url: publicUrl, verification_status: "pending" })
        .eq("id", user.id);

      if (error) throw error;

      await refresh();
      toast.success("Student ID uploaded. Your verification is now pending review.");
    } catch (error) {
      console.error(error);
      toast.error("Could not upload your student ID");
    } finally {
      e.target.value = "";
      setUploadingId(false);
    }
  };

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Student";
  const initial = displayName.charAt(0).toUpperCase();
  const verificationStatus = profile?.verification_status ?? "pending";
  const badge = getVerificationBadge(verificationStatus);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="glass-card flex items-center gap-4 rounded-3xl p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground text-background font-display text-2xl font-semibold">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl font-semibold truncate">{displayName}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile?.phone || user?.email}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${badge.className}`}>
          <badge.icon className="h-3 w-3" />
          {badge.label}
        </span>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Student ID</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.student_id_url
                ? "Upload a replacement if your current ID needs to be updated."
                : "Upload your student ID so the team can verify your account."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={uploadingId || !user}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploadingId ? "Uploading..." : profile?.student_id_url ? "Replace" : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleStudentIdChange}
          />
        </div>
      </div>

      <div className="glass-card divide-y divide-hairline/60 overflow-hidden rounded-2xl">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            className="flex items-center gap-4 p-4 transition hover:bg-secondary/30"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-hairline">
              <it.icon className="h-4 w-4" />
            </div>
            <span className="flex-1 text-sm">{it.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <Button onClick={handleSignOut} variant="outline" size="lg" className="w-full">
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

      <p className="pt-2 text-center text-xs text-muted-foreground">Easi Ride v1.0 — student build</p>
    </div>
  );
};

const getVerificationBadge = (status: string) => {
  switch (status) {
    case "approved":
      return {
        label: "Verified",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        icon: ShieldCheck,
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "border-destructive/30 bg-destructive/10 text-destructive-foreground",
        icon: ShieldAlert,
      };
    default:
      return {
        label: "Pending",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        icon: ShieldQuestion,
      };
  }
};

export default Account;
