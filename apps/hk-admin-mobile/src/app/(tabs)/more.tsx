import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { Card, ScreenTitle, UnavailableState } from "../../components/ui";
import { colors, radius, spacing, typography } from "../../lib/theme";

const COMING_SOON_MODULES = [
  { label: "Reklam Doktoru Pro", icon: "medkit-outline" as const },
  { label: "Müşteri Keşfi", icon: "search-outline" as const },
  { label: "Organik Büyüme Merkezi", icon: "trending-up-outline" as const },
  { label: "Görevler", icon: "checkmark-done-outline" as const },
  { label: "Finans Özeti", icon: "wallet-outline" as const },
  { label: "Raporlar", icon: "document-text-outline" as const }
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

        <Text style={[typography.caption, { marginTop: spacing.sm }]}>DİĞER MODÜLLER</Text>
        {COMING_SOON_MODULES.map((module) => (
          <Card key={module.label} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Ionicons name={module.icon} size={20} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={typography.heading}>{module.label}</Text>
              <Text style={[typography.caption, { marginTop: 2 }]}>Bu modül henüz mobil uygulamaya entegre edilmedi</Text>
            </View>
          </Card>
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
