import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius, shadow, spacing, typography } from "../lib/theme";

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={typography.title}>{title}</Text>
      {subtitle ? <Text style={[typography.body, { marginTop: 4 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function KpiCard({ label, value, tone = "accent" }: { label: string; value: string | number; tone?: "accent" | "orange" | "danger" | "success" }) {
  const toneColor = { accent: colors.accent, orange: colors.orange, danger: colors.danger, success: colors.success }[tone];
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={[typography.title, { color: toneColor, marginTop: spacing.xs }]}>{value}</Text>
    </Card>
  );
}

export function Badge({ label, tone = "accent" }: { label: string; tone?: "accent" | "orange" | "danger" | "success" | "muted" }) {
  const map = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    orange: { bg: colors.orangeSoft, fg: colors.orange },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    muted: { bg: colors.surfaceAlt, fg: colors.textMuted }
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" }}>
      <Text style={{ color: map.fg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function LoadingState({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color={colors.accent} />
      <Text style={[typography.body, { marginTop: spacing.sm }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.centerState}>
      <Text style={typography.heading}>{title}</Text>
      {description ? <Text style={[typography.body, { marginTop: spacing.xs, textAlign: "center" }]}>{description}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; description?: string; onRetry?: () => void }) {
  return (
    <View style={styles.centerState}>
      <Text style={[typography.heading, { color: colors.danger }]}>Bir sorun oluştu</Text>
      <Text style={[typography.body, { marginTop: spacing.xs, textAlign: "center" }]}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={{ marginTop: spacing.md, color: colors.accent, fontWeight: "700" }}>
          Tekrar dene
        </Text>
      ) : null}
    </View>
  );
}

export function UnavailableState({ label }: { label: string }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
      <Text style={[typography.body, { textAlign: "center" }]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl
  }
});
