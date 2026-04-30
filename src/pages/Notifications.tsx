import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, CheckCircle2, Car, CreditCard, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";

type Notification = Tables<"notifications">;
type NotificationType = "system" | "ride" | "payment" | "promo";

const getIcon = (type: string) => {
  switch (type) {
    case "ride":
      return <Car className="h-5 w-5 text-emerald-500" />;
    case "payment":
      return <CreditCard className="h-5 w-5 text-blue-500" />;
    case "promo":
      return <Tag className="h-5 w-5 text-amber-500" />;
    case "system":
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
};

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          fetchNotifications(); // Simple refresh for now
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Could not update notifications");
    }
  };

  const markAsRead = async (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.read) return;

    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 animate-fade-up pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <Link
            to="/account"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount} unread message{unreadCount !== 1 && "s"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary hover:text-primary-foreground"
            title="Mark all as read"
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <h3 className="mt-4 font-display text-lg font-medium">All caught up!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You have no new notifications right now.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`glass-card relative flex cursor-pointer gap-4 rounded-2xl p-4 transition-all hover:bg-secondary/20 ${
                !notification.read ? "border-primary/20 bg-primary/5" : ""
              }`}
            >
              {!notification.read && (
                <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)] animate-pulse" />
              )}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background border border-hairline shadow-sm">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center justify-between">
                  <h3 className={`font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
                    {notification.title}
                  </h3>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground/80">
                  {notification.message}
                </p>
                <span className="mt-2 block text-xs font-medium text-muted-foreground/50">
                  {new Date(notification.created_at).toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
