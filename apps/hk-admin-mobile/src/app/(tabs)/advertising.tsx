import { useCallback, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api";
import { Badge, Card, EmptyState, ErrorState, LoadingState, ScreenTitle, UnavailableState } from "../../components/ui";
import { colors, spacing, typography } from "../../lib/theme";

type AdvertisingCustomer = { id: string; name: string; sector: string | null; metaConnected: boolean; googleConnected: boolean };

export default function AdvertisingScreen() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<AdvertisingCustomer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const body = await apiFetch<{ customers: AdvertisingCustomer[] }>("/api/mobile/advertising", token);
      setCustomers(body.customers);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reklam verileri yüklenemedi.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <ScreenTitle title="Reklamlar" subtitle="Müşteri bazında Meta/Google Ads bağlantı durumu" />
      </View>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !customers ? (
        <LoadingState label="Yükleniyor..." />
      ) : customers.length === 0 ? (
        <EmptyState title="Müşteri bulunamadı" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListFooterComponent={
            <UnavailableState label="Kampanya harcaması, erişim, CTR, CPC, CPM gibi performans metrikleri bu ekranda henüz gösterilmiyor — bunun için HK Admin web'de Reklam Doktoru Pro'yu açın." />
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={typography.heading}>{item.name}</Text>
              {item.sector ? <Text style={[typography.body, { marginTop: 2 }]}>{item.sector}</Text> : null}
              <View style={{ marginTop: spacing.sm, flexDirection: "row", gap: spacing.sm }}>
                <Badge label={item.metaConnected ? "Meta Ads Bağlı" : "Meta Ads Bağlı Değil"} tone={item.metaConnected ? "accent" : "muted"} />
                <Badge label={item.googleConnected ? "Google Ads Bağlı" : "Google Ads Bağlı Değil"} tone={item.googleConnected ? "accent" : "muted"} />
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
