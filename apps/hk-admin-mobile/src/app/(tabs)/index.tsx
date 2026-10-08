import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api";
import { EmptyState, ErrorState, KpiCard, LoadingState, ScreenTitle } from "../../components/ui";
import { colors, spacing } from "../../lib/theme";

type DashboardData = { activeCustomers: number; openLeads: number; pendingTasks: number; unreadNotifications: number };

export default function HomeScreen() {
  const { token, session } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const body = await apiFetch<DashboardData>("/api/mobile/dashboard", token);
      setData(body);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Veriler yüklenemedi.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <ScreenTitle title={`Merhaba, ${session?.fullName || session?.email || ""}`} subtitle="HK Dijital Operating System — genel durum" />

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data ? (
          <LoadingState label="Panel yükleniyor..." />
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <KpiCard label="Aktif Müşteri" value={data.activeCustomers} tone="accent" />
              <KpiCard label="Açık Lead" value={data.openLeads} tone="orange" />
              <KpiCard label="Bekleyen Görev" value={data.pendingTasks} tone="danger" />
              <KpiCard label="Okunmamış Bildirim" value={data.unreadNotifications} tone="success" />
            </View>

            {data.openLeads === 0 && data.pendingTasks === 0 && data.unreadNotifications === 0 ? (
              <View style={{ marginTop: spacing.xl }}>
                <EmptyState title="Her şey yolunda" description="Bekleyen açık iş yok." />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
