import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { API_BASE_URL } from "../../lib/api";
import { Card, ScreenTitle, UnavailableState } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../lib/theme";

const NATIVE_MODULES = [
  { label: "Görevler", icon: "checkmark-done-outline" as const, route: "/(tabs)/tasks" },
  { label: "Reklamlar (bağlantı durumu)", icon: "megaphone-outline" as const, route: "/(tabs)/advertising" }
];

// Real web routes (src/app/hk-admin/<slug>) opened in the system browser —
// never a WebView. Listed only because they have no native screen yet.
const WEB_ONLY_MODULES = [
  { label: "Reklam Doktoru Pro (performans metrikleri)", icon: "medkit-outline" as const, slug: "ad-insights" },
  { label: "Müşteri Keşfi", icon: "search-outline" as const, slug: "musteri-kesfi" },
  { label: "Organik Büyüme Merkezi", icon: "trending-up-outline" as const, slug: "organik-buyume-merkezi" },
  { label: "Muhasebe Merkezi", icon: "wallet-outline" as const, slug: "muhasebe" },
  { label: "Rapor Merkezi", icon: "document-text-outline" as const, slug: "rapor-merkezi" }
];

export default function MoreScreen() {
  const { session, logout } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <ScreenTitle title="Menü" />

        <Card>
          <Text style={typography.heading}>{session?.fullName || session?.email}</Text>
          <Text style={[typography.body, { marginTop: 4 }]}>{session?.email}</Text>
          <Text style={[typography.caption, { marginTop: spacing.xs }]}>{session?.role?.toUpperCase()}</Text>
        </Card>

        <Text style={[typography.caption, { marginTop: spacing.sm }]}>MODÜLLER</Text>
        {NATIVE_MODULES.map((module) => (
          <Pressable key={module.label} onPress={() => router.push(module.route as never)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Ionicons name={module.icon} size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={typography.heading}>{module.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </Pressable>
        ))}

        <Text style={[typography.caption, { marginTop: spacing.sm }]}>WEB&apos;DE AÇILIR</Text>
        {WEB_ONLY_MODULES.map((module) => (
          <Pressable key={module.label} onPress={() => Linking.openURL(`${API_BASE_URL}/hk-admin/${module.slug}`)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Ionicons name={module.icon} size={20} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={typography.heading}>{module.label}</Text>
                <Text style={[typography.caption, { marginTop: 2 }]}>Bu modülün native mobil ekranı henüz yok — sistem tarayıcısında açılır</Text>
              </View>
            </Card>
          </Pressable>
        ))}

        <UnavailableState label="Push bildirimleri Expo Go içinde desteklenmez — bildirimler yalnızca uygulama açıkken, Bildirimler sekmesinden görüntülenir." />

        <Pressable
          onPress={logout}
          style={({ pressed }) => [{ marginTop: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.danger, paddingVertical: spacing.md, alignItems: "center" }, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: colors.danger, fontWeight: "800" }}>Çıkış Yap</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
