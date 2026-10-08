import { useCallback, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorState, LoadingState, ScreenTitle } from "../../components/ui";
import { colors, spacing, typography } from "../../lib/theme";

type NotificationItem = {
  id: string;
  title: string;
  message: string | null;
  priority: string | null;
  notification_type: string;
  is_read: boolean;
  created_at: string;
};

const PRIORITY_TONE: Record<string, "danger" | "orange" | "accent" | "muted"> = { high: "danger", yüksek: "danger", normal: "accent", low: "muted", düşük: "muted" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const body = await apiFetch<{ notifications: NotificationItem[] }>("/api/mobile/notifications", token);
      setItems(body.notifications);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bildirimler yüklenemedi.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function markRead(id: string) {
    if (!token) return;
    setItems((current) => current?.map((item) => (item.id === id ? { ...item, is_read: true } : item)) || null);
    try {
      await apiFetch(`/api/mobile/notifications/${id}`, token, { method: "PATCH", body: JSON.stringify({ is_read: true }) });
    } catch {
      // Best-effort — a failed mark-read is not worth blocking the UI for;
      // the next pull-to-refresh will reconcile with the server's real state.
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <ScreenTitle title="Bildirimler" />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <LoadingState label="Yükleniyor..." />
      ) : items.length === 0 ? (
        <EmptyState title="Bildirim yok" description="Yeni bir bildirim geldiğinde burada görünür." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable onPress={() => !item.is_read && markRead(item.id)}>
              <Card style={!item.is_read ? { borderColor: colors.accent } : undefined}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Text style={[typography.heading, { flex: 1 }]}>{item.title}</Text>
                  {!item.is_read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} /> : null}
                </View>
                {item.message ? <Text style={[typography.body, { marginTop: 4 }]}>{item.message}</Text> : null}
                <View style={{ marginTop: spacing.sm, flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  {item.priority ? <Badge label={item.priority} tone={PRIORITY_TONE[item.priority.toLowerCase()] || "muted"} /> : null}
                  <Text style={typography.caption}>{formatDate(item.created_at)}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
