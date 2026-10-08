import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorState, LoadingState, ScreenTitle } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../lib/theme";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  company_id: string | null;
};

const STATUS_FILTERS = ["Tümü", "Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal"];

const STATUS_TONE: Record<string, "accent" | "orange" | "danger" | "success" | "muted"> = {
  Yapılacak: "accent",
  "Devam Ediyor": "orange",
  Beklemede: "muted",
  Tamamlandı: "success",
  İptal: "danger"
};

export default function TasksScreen() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tümü");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(
    async (status: string) => {
      if (!token) return;
      setError(null);
      try {
        const qs = status !== "Tümü" ? `?status=${encodeURIComponent(status)}` : "";
        const body = await apiFetch<{ tasks: Task[] }>(`/api/mobile/tasks${qs}`, token);
        setTasks(body.tasks);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Görevler yüklenemedi.");
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function advanceStatus(task: Task) {
    if (!token || updatingId) return;
    const next = task.status === "Yapılacak" ? "Devam Ediyor" : task.status === "Devam Ediyor" ? "Tamamlandı" : null;
    if (!next) return;
    setUpdatingId(task.id);
    try {
      await apiFetch(`/api/mobile/tasks/${task.id}`, token, { method: "PATCH", body: JSON.stringify({ status: next }) });
      load(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Görev güncellenemedi.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <ScreenTitle title="Görevler" subtitle="Ajans içi yapılacaklar" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md }}>
        {STATUS_FILTERS.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setFilter(item);
              load(item);
            }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: filter === item ? colors.accent : colors.border,
              backgroundColor: filter === item ? colors.accentSoft : "transparent"
            }}
          >
            <Text style={{ color: filter === item ? colors.accent : colors.textMuted, fontWeight: "700", fontSize: 12 }}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <ErrorState message={error} onRetry={() => load(filter)} />
      ) : !tasks ? (
        <LoadingState label="Görevler yükleniyor..." />
      ) : tasks.length === 0 ? (
        <EmptyState title="Görev bulunamadı" description="Bu filtreye uyan bir görev yok." />
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          renderItem={({ item }) => (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={[typography.heading, { flex: 1, marginRight: spacing.sm }]}>{item.title}</Text>
                <Badge label={item.priority} tone={item.priority === "Kritik" ? "danger" : "muted"} />
              </View>
              {item.description ? <Text style={[typography.body, { marginTop: spacing.xs }]}>{item.description}</Text> : null}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Badge label={item.status} tone={STATUS_TONE[item.status] || "muted"} />
                  {item.due_date ? <Text style={typography.caption}>{item.due_date}</Text> : null}
                </View>
                {(item.status === "Yapılacak" || item.status === "Devam Ediyor") && (
                  <Pressable onPress={() => advanceStatus(item)} disabled={updatingId === item.id}>
                    <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12, opacity: updatingId === item.id ? 0.5 : 1 }}>
                      {item.status === "Yapılacak" ? "Başlat →" : "Tamamla ✓"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
