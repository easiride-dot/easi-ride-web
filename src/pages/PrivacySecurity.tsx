import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, MapPin, Eye, Lock, Trash2, FileText, KeyRound, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PrivacySecurity = () => {
  // TODO: Connect these to `location_enabled` and `analytics_enabled` columns in the `profiles` table
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [showProfile, setShowProfile] = useState(true);

  // Password Update State
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

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

  const handleDeleteAccount = () => {
    // Placeholder for actual deletion logic
    toast.error("Account deletion is disabled in this build. Please contact support.");
  };

  return (
    <div className="space-y-6 animate-fade-up pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 pb-2">
        <Link
          to="/account"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-semibold">Privacy & Security</h1>
          <p className="text-sm text-muted-foreground">Manage your data and account security.</p>
        </div>
      </div>

      {/* Settings Section */}
      <div className="glass-card divide-y divide-hairline/60 rounded-2xl overflow-hidden">
        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Location Services</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Allow Easi Ride to access your location for accurate pickups.
              </p>
            </div>
          </div>
          <Switch
            checked={locationEnabled}
            onCheckedChange={setLocationEnabled}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Profile Visibility</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Let drivers see your full name and photo during a ride.
              </p>
            </div>
          </div>
          <Switch
            checked={showProfile}
            onCheckedChange={setShowProfile}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>

        <div className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium">Analytics & Data</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Share anonymous usage data to help us improve the app.
              </p>
            </div>
          </div>
          <Switch
            checked={analyticsEnabled}
            onCheckedChange={setAnalyticsEnabled}
            className="data-[state=checked]:bg-emerald-500"
          />
        </div>
      </div>

      {/* Security Section */}
      <div className="glass-card divide-y divide-hairline/60 rounded-2xl overflow-hidden">
        <div className="p-5 flex items-center gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium">Two-Factor Authentication</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add an extra layer of security. (Coming Soon)
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>
            Enable
          </Button>
        </div>

        <Dialog open={editPasswordOpen} onOpenChange={setEditPasswordOpen}>
          <DialogTrigger asChild>
            <button className="w-full flex items-center justify-between p-5 transition hover:bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <KeyRound className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-medium">Update Password</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Change your account password securely.
                  </p>
                </div>
              </div>
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

      {/* Documents */}
      <div className="glass-card divide-y divide-hairline/60 rounded-2xl overflow-hidden">
        <Link to="#" className="flex items-center justify-between p-5 transition hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Terms of Service</span>
          </div>
        </Link>
        <Link to="#" className="flex items-center justify-between p-5 transition hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Privacy Policy</span>
          </div>
        </Link>
      </div>

      {/* Danger Zone */}
      <div className="pt-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/20">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete your account,
                subscription data, and remove your data from our servers.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-4">
              <Button variant="destructive" onClick={handleDeleteAccount}>
                Yes, delete my account
              </Button>
              <DialogTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </DialogTrigger>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default PrivacySecurity;
