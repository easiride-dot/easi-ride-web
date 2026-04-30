import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, Bell, Shield, MapPin, CreditCard, LogOut, HelpCircle, ShieldAlert, ShieldCheck, ShieldQuestion, Upload, Edit3, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "@/hooks/useProfile";
import { uploadStudentId } from "@/lib/studentIdUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [busy, setBusy] = useState(false);

  // Profile Edit State
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCampus, setEditCampus] = useState("");

  // Password Update State
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name || "");
      setEditPhone(profile.phone || "");
      setEditCampus(profile.campus || "");
    }
  }, [profile]);

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editName,
          phone: editPhone,
          campus: editCampus,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refresh();
      toast.success("Profile updated successfully");
      setEditProfileOpen(false);
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setEditPasswordOpen(false);
      setNewPassword("");
    } catch (error) {
      toast.error("Failed to update password");
      console.error(error);
    } finally {
      setBusy(false);
    }
  };

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Student";
  const initial = displayName.charAt(0).toUpperCase();
  const verificationStatus = profile?.verification_status ?? "pending";
  const badge = getVerificationBadge(verificationStatus);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="glass-card relative flex items-center gap-4 rounded-3xl p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-display text-2xl font-semibold">
          {initial}
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <h1 className="font-display text-xl font-semibold truncate">{displayName}</h1>
          <p className="truncate text-sm text-muted-foreground">{profile?.phone || user?.email}</p>
          {profile?.campus && (
            <p className="truncate text-xs text-muted-foreground mt-1">{profile.campus}</p>
          )}
        </div>
        <div className="absolute top-6 right-6">
          <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                <Edit3 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your personal details. Drivers will use this to contact you.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateProfile} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. 076123456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campus">Campus</Label>
                  <select
                    id="campus"
                    value={editCampus}
                    onChange={(e) => setEditCampus(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select a campus</option>
                    <option value="Fourah Bay College">Fourah Bay College</option>
                    <option value="IPAM Tower Hill">IPAM Tower Hill</option>
                    <option value="Njala University">Njala University</option>
                    <option value="Limkokwing">Limkokwing</option>
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <span className={`absolute bottom-[-10px] left-8 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${badge.className}`}>
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

        {/* Password Update Dialog integrated into the list */}
        <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center gap-4 p-4 transition hover:bg-secondary/30">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary border border-hairline">
                <KeyRound className="h-4 w-4" />
              </div>
              <span className="flex-1 text-sm text-left">Update Password</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Update Password</DialogTitle>
              <DialogDescription>
                Enter a new password for your account.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdatePassword} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
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
