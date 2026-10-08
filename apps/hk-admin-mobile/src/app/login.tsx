import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { colors, radius, spacing, typography } from "../lib/theme";

export default function LoginScreen() {
  const { token, login, error } = useAuth();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Redirect href="/(tabs)" />;

  async function handleSubmit() {
    if (!identity.trim() || !password) return;
    setSubmitting(true);
    await login(identity.trim(), password);
    setSubmitting(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center" }}>
        <View style={styles.header}>
          <Image source={require("../../assets/hk-dijital-logo.png")} style={styles.logo} resizeMode="contain" />
          <Text style={typography.title}>HK Admin</Text>
          <Text style={[typography.body, { marginTop: spacing.xs }]}>HK Dijital Operating System</Text>
        </View>

        <View style={styles.form}>
          <Text style={typography.caption}>E-POSTA VEYA KULLANICI ADI</Text>
          <TextInput
            value={identity}
            onChangeText={setIdentity}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="ornek@hkdijital.com.tr"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={[typography.caption, { marginTop: spacing.md }]}>ŞİFRE</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={handleSubmit} disabled={submitting || !identity.trim() || !password} style={({ pressed }) => [styles.button, (submitting || !identity.trim() || !password) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}>
            <Text style={styles.buttonText}>{submitting ? "Giriş yapılıyor..." : "Giriş Yap"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.xl },
  header: { alignItems: "center", marginBottom: spacing.xxl },
  logo: { width: 72, height: 72, marginBottom: spacing.md, borderRadius: radius.md },
  form: { gap: 0 },
  input: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 15
  },
  button: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: "center"
  },
  buttonText: { color: "#04201D", fontWeight: "800", fontSize: 15 },
  errorText: { color: colors.danger, marginTop: spacing.md, fontSize: 13, fontWeight: "600" }
});
