import { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image, RefreshControl, ImageBackground, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@react-native-vector-icons/ionicons";
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeInUp, Layout } from "react-native-reanimated";
import { makeStyles, useTheme, radius, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { fmtUZS, fmtDate } from "@/src/format";
import { useAuth } from "@/src/auth-context";
import { useSettings } from "@/src/settings-context";

export function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { backgroundImage } = useSettings();
  const summaryQ = useQuery({ queryKey: ["summary"], queryFn: api.getSummary });
  const accQ = useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
  const txQ = useQuery({ queryKey: ["transactions", { limit: 5 }], queryFn: () => api.listTransactions({ limit: 5 }) });
  const refetch = () => { summaryQ.refetch(); accQ.refetch(); txQ.refetch(); };
  const refreshing = summaryQ.isRefetching || accQ.isRefetching || txQ.isRefetching;
  const s = summaryQ.data;
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}>
        <ImageBackground source={backgroundImage ? { uri: backgroundImage } : undefined} style={[styles.hero, { paddingTop: insets.top + 16 }]} imageStyle={styles.heroBgImg}>
          <View style={styles.heroOverlay} />
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroContent}>
            <Text style={styles.heroLabel}>Umumiy balans</Text>
            <Text testID="net-worth" style={styles.netWorth}>{fmtUZS(s?.net_worth ?? 0)}</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.income} />
                <View>
                  <Text style={styles.statLabel}>Daromad (Oy)</Text>
                  <Text testID="month-income" style={styles.statVal}>{fmtUZS(s?.month_income ?? 0)}</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.expense} />
                <View>
                  <Text style={styles.statLabel}>Xarajat (Oy)</Text>
                  <Text testID="month-expense" style={styles.statVal}>{fmtUZS(s?.month_expense ?? 0)}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </ImageBackground>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Hisoblar</Text>
          <Pressable onPress={() => router.push("/accounts")}>
            <Text style={styles.seeAll}>Barchasi</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountsList}>
          {(accQ.data ?? []).map((acc, i) => (
            <Animated.View key={acc.id} entering={FadeInRight.delay(i * 60).duration(300)}>
              <Pressable style={styles.accCard}>
                <View style={styles.accIconBox}>
                  <Ionicons name={(acc.icon as any) || "wallet"} size={20} color={colors.onBrandTertiary} />
                </View>
                <Text style={styles.accName}>{acc.name}</Text>
                <Text style={styles.accBalance}>{fmtUZS(acc.balance ?? 0)}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Oxirgi amallar</Text>
          <Pressable onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={styles.seeAll}>Barchasi</Text>
          </Pressable>
        </View>
        <View style={styles.txList}>
          {(txQ.data ?? []).map((t, i) => {
            const isInc = t.kind === "income";
            const isExp = t.kind === "expense";
            return (
              <Animated.View key={t.id} entering={FadeInDown.delay(i * 40).duration(300)} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name={(t.category?.icon as any) || (isInc ? "arrow-down" : isExp ? "arrow-up" : "swap-horizontal")} size={20} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txCat}>{t.category?.name || (t.kind === "transfer" ? "O'tkazma" : "Boshqa")}</Text>
                  <Text style={styles.txDate}>{fmtDate(t.created_at)}</Text>
                </View>
                <Text style={[styles.txAmt, isInc && { color: colors.income }, isExp && { color: colors.expense }]}>{isInc ? "+" : isExp ? "-" : ""}{fmtUZS(t.amount)}</Text>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
      <Pressable testID="fab-add" onPress={() => router.push("/add-transaction")} style={styles.fab}>
        <Ionicons name="add" size={32} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

type FilterKind = "all" | "income" | "expense" | "transfer";

export function TransactionsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKind>("all");
  const txQ = useQuery({ queryKey: ["transactions"], queryFn: () => api.listTransactions() });
  const delMutation = useMutation({ mutationFn: (id: string) => api.deleteTransaction(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["summary"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); } });
  const list = useMemo(() => { const raw = txQ.data ?? []; if (filter === "all") return raw; return raw.filter((t) => t.kind === filter); }, [txQ.data, filter]);
  const confirmDelete = (id: string) => { Alert.alert("O'chirish", "Ushbu amalni o'chirmoqchimisiz?", [{ text: "Bekor", style: "cancel" }, { text: "O'chirish", style: "destructive", onPress: () => delMutation.mutate(id) }]); };
  const chips: { key: FilterKind; label: string }[] = [{ key: "all", label: "Barchasi" }, { key: "income", label: "Daromad" }, { key: "expense", label: "Xarajat" }, { key: "transfer", label: "O'tkazma" }];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Tranzaksiyalar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {chips.map((c) => { const active = filter === c.key; return (<Pressable key={c.key} onPress={() => setFilter(c.key)} style={[styles.chip, active && { backgroundColor: colors.brandPrimary }]}><Text style={[styles.chipText, active && { color: colors.onBrandPrimary }]}>{c.label}</Text></Pressable>); })}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        {list.map((t, i) => { const isInc = t.kind === "income"; const isExp = t.kind === "expense"; return (<Animated.View key={t.id} entering={FadeInDown.delay(i * 30).duration(300)}><Pressable onLongPress={() => confirmDelete(t.id)} style={styles.row}><View style={[styles.txIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={(t.category?.icon as any) || (isInc ? "arrow-down" : isExp ? "arrow-up" : "swap-horizontal")} size={20} color={colors.onBrandTertiary} /></View><View style={{ flex: 1 }}><Text style={styles.txCat}>{t.category?.name || (t.kind === "transfer" ? "O'tkazma" : "Boshqa")}</Text><Text style={styles.txDate}>{fmtDate(t.created_at)}</Text>{t.note ? <Text style={styles.note}>{t.note}</Text> : null}</View><Text style={[styles.txAmt, isInc && { color: colors.income }, isExp && { color: colors.expense }]}>{isInc ? "+" : isExp ? "-" : ""}{fmtUZS(t.amount)}</Text></Pressable></Animated.View>); })}
      </ScrollView>
    </View>
  );
}

export function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { backgroundImage, setBackgroundImage } = useSettings();
  const router = useRouter();
  const pickBg = async () => { const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!perm.granted) { Alert.alert("Ruxsat kerak", "Galereyaga ruxsat bering"); return; } const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false }); if (!r.canceled && r.assets?.[0]?.uri) { await setBackgroundImage(r.assets[0].uri); } };
  const resetBg = () => { Alert.alert("Fon rasmini tiklash", "Standart fon rasmiga qaytmoqchimisiz?", [{ text: "Bekor", style: "cancel" }, { text: "Ha", onPress: () => setBackgroundImage(null) }]); };
  const doLogout = () => { Alert.alert("Chiqish", "Rostdan chiqmoqchimisiz?", [{ text: "Bekor", style: "cancel" }, { text: "Chiqish", style: "destructive", onPress: () => logout() }]); };
  const rows = [{ icon: "wallet", label: "Hisoblar", onPress: () => router.push("/accounts") }, { icon: "pricetags", label: "Kategoriyalar", onPress: () => router.push("/categories") }, { icon: "image", label: "Fon rasmi tanlash", onPress: pickBg }, { icon: "refresh", label: "Fonni standartga qaytarish", onPress: resetBg }];
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || user?.email || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name || "Foydalanuvchi"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        {backgroundImage ? (<View style={styles.bgPreview}><Text style={styles.previewLabel}>Sizning fon rasmingiz</Text><Image source={{ uri: backgroundImage }} style={styles.previewImg} /></View>) : null}
        <View style={styles.section}>
          {rows.map((r) => (<Pressable key={r.label} testID={`profile-${r.icon}`} onPress={r.onPress} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name={r.icon as any} size={20} color={colors.onBrandTertiary} /></View><Text style={styles.rowLabel}>{r.label}</Text><Ionicons name="chevron-forward" size={20} color={colors.muted} /></Pressable>))}
        </View>
        <View style={styles.section}>
          <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="cash" size={20} color={colors.onBrandTertiary} /></View><Text style={styles.rowLabel}>Valyuta</Text><Text style={styles.rowValue}>UZS (so'm)</Text></View>
          <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="moon" size={20} color={colors.onBrandTertiary} /></View><Text style={styles.rowLabel}>Tun rejimi</Text><Text style={styles.rowValue}>Tizim bo'yicha</Text></View>
          <View style={styles.row}><View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}><Ionicons name="information-circle" size={20} color={colors.onBrandTertiary} /></View><Text style={styles.rowLabel}>Versiya</Text><Text style={styles.rowValue}>1.0.0</Text></View>
        </View>
        <Pressable testID="logout-btn" onPress={doLogout} style={styles.logoutBtn}><Ionicons name="log-out" size={20} color={colors.error} /><Text style={styles.logoutText}>Chiqish</Text></Pressable>
        <Text style={styles.credits}>Created by Uzbek</Text>
      </ScrollView>
    </View>
  );
}

const ACCOUNT_ICONS = ["wallet", "cash", "card", "briefcase", "home", "phone-portrait", "gift"];

export function AccountsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [icon, setIcon] = useState("wallet");
  const [initial, setInitial] = useState("");
  const accQ = useQuery({ queryKey: ["accounts"], queryFn: api.listAccounts });
  const create = useMutation({ mutationFn: (b: any) => api.createAccount(b), onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); setOpen(false); setName(""); setInitial(""); setIcon("wallet"); setType("cash"); } });
  const del = useMutation({ mutationFn: (id: string) => api.deleteAccount(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); } });
  const submit = () => { if (!name) return; create.mutate({ name, type, icon, initial_balance: parseFloat(initial) || 0 }); };
  const confirmDelete = (id: string, nm: string) => { Alert.alert("O'chirish", `"${nm}" hisobi va uning barcha amallari o'chiriladi.`, [{ text: "Bekor", style: "cancel" }, { text: "O'chirish", style: "destructive", onPress: () => del.mutate(id) }]); };
  const types = [{ key: "cash", label: "Naqd" }, { key: "card", label: "Karta" }, { key: "bank", label: "Bank" }];
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.subHeader}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.subTitle}>Hisoblar</Text>
        <Pressable testID="add-account-btn" onPress={() => setOpen(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {(accQ.data ?? []).map((a, i) => (
          <Animated.View key={a.id} entering={FadeInDown.delay(i * 50).duration(300)}>
            <Pressable onLongPress={() => confirmDelete(a.id, a.name)} style={styles.row}>
              <View style={[styles.txIcon, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name={(a.icon as any) || "wallet"} size={22} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txCat}>{a.name}</Text>
                <Text style={styles.txDate}>{a.type === "cash" ? "Naqd" : a.type === "card" ? "Karta" : "Bank"}</Text>
              </View>
              <Text style={styles.txAmt}>{fmtUZS(a.balance ?? 0)}</Text>
            </Pressable>
          </Animated.View>
        ))}
        <Text style={styles.hint}>Uzoq bosib turing — o'chirish uchun</Text>
      </ScrollView>
      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBg} onPress={() => setOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Yangi hisob</Text>
            <Text style={styles.label}>Nomi</Text>
            <TextInput testID="acc-name-input" value={name} onChangeText={setName} placeholder="Masalan: Karta" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.label}>Turi</Text>
            <View style={styles.grid}>
              {types.map((t) => { const active = t.key === type; return (<Pressable key={t.key} onPress={() => setType(t.key)} style={[styles.pill, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}><Text style={[styles.pillText, active && { color: colors.onBrandPrimary }]}>{t.label}</Text></Pressable>); })}
            </View>
            <Text style={styles.label}>Ikonka</Text>
            <View style={styles.grid}>
              {ACCOUNT_ICONS.map((ic) => { const active = ic === icon; return (<Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconBtn, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}><Ionicons name={ic as any} size={20} color={active ? colors.onBrandPrimary : colors.onSurface} /></Pressable>); })}
            </View>
            <Text style={styles.label}>Boshlang'ich balans</Text>
            <TextInput testID="acc-balance-input" value={initial} onChangeText={setInitial} placeholder="0" placeholderTextColor={colors.muted} keyboardType="numeric" style={styles.input} />
            <Pressable testID="acc-save-btn" onPress={submit} style={[styles.saveBtn, !name && { opacity: 0.5 }]} disabled={!name}>
              <Text style={styles.saveBtnText}>Saqlash</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const CATEGORY_ICONS = ["restaurant", "car", "home", "shirt", "game-controller", "medkit", "book", "cash", "gift", "trending-up", "add-circle", "cafe", "bus", "airplane", "fitness", "musical-notes", "pricetag", "phone-portrait", "flower"];

export function CategoriesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"income" | "expense">("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("pricetag");
  const catQ = useQuery({ queryKey: ["categories"], queryFn: api.listCategories });
  const create = useMutation({ mutationFn: (b: any) => api.createCategory(b), onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setOpen(false); setName(""); setIcon("pricetag"); } });
  const del = useMutation({ mutationFn: (id: string) => api.deleteCategory(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }) });
  const cats = (catQ.data ?? []).filter((c) => c.kind === filter);
  const confirmDelete = (id: string, nm: string) => { Alert.alert("O'chirish", `"${nm}" kategoriyasini o'chirmoqchimisiz?`, [{ text: "Bekor", style: "cancel" }, { text: "O'chirish", style: "destructive", onPress: () => del.mutate(id) }]); };
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.subHeader}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.subTitle}>Kategoriyalar</Text>
        <Pressable testID="add-cat-btn" onPress={() => setOpen(true)} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={colors.brandPrimary} />
        </Pressable>
      </View>
      <View style={styles.segRow}>
        <Pressable onPress={() => setFilter("expense")} style={[styles.segBtn, filter === "expense" && { backgroundColor: colors.brandPrimary }]}>
          <Text style={[styles.segText, filter === "expense" && { color: colors.onBrandPrimary }]}>Xarajat</Text>
        </Pressable>
        <Pressable onPress={() => setFilter("income")} style={[styles.segBtn, filter === "income" && { backgroundColor: colors.brandPrimary }]}>
          <Text style={[styles.segText, filter === "income" && { color: colors.onBrandPrimary }]}>Daromad</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.grid}>
          {cats.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 30).duration(300)} style={styles.catCard}>
              <Pressable onLongPress={() => confirmDelete(c.id, c.name)}>
                <View style={[styles.catIcon, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name={(c.icon as any) || "tag"} size={22} color={colors.onBrandTertiary} />
                </View>
                <Text style={styles.catName} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
        <Text style={styles.hint}>Uzoq bosib turing — o'chirish uchun</Text>
      </ScrollView>
      <Modal transparent visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBg} onPress={() => setOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Yangi kategoriya</Text>
            <Text style={styles.label}>Nomi</Text>
            <TextInput testID="cat-name-input" value={name} onChangeText={setName} placeholder="Masalan: Restoran" placeholderTextColor={colors.muted} style={styles.input} />
            <Text style={styles.label}>Ikonka</Text>
            <View style={styles.grid}>
              {CATEGORY_ICONS.map((ic) => { const active = ic === icon; return (<Pressable key={ic} onPress={() => setIcon(ic)} style={[styles.iconBtn, active && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}><Ionicons name={ic as any} size={20} color={active ? colors.onBrandPrimary : colors.onSurface} /></Pressable>); })}
            </View>
            <Pressable testID="cat-save-btn" onPress={() => { if (!name) return; create.mutate({ name, icon, kind: filter }); }} style={[styles.saveBtn, !name && { opacity: 0.5 }]} disabled={!name}>
              <Text style={styles.saveBtnText}>Saqlash</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({ root: { flex: 1, backgroundColor: theme.colors.surface }, hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, backgroundColor: theme.colors.brandPrimary }, heroBgImg: { opacity: 0.3 }, heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.brandPrimary, opacity: 0.4 }, heroContent: { gap: spacing.md }, heroLabel: { color: theme.colors.onBrandPrimary, fontSize: 14, opacity: 0.8 }, netWorth: { color: theme.colors.onBrandPrimary, fontSize: 32, fontWeight: "bold" }, statsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md }, statBox: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, statDivider: { width: 1, height: 40, backgroundColor: theme.colors.onBrandPrimary, opacity: 0.3, marginHorizontal: spacing.md }, statLabel: { color: theme.colors.onBrandPrimary, fontSize: 12, opacity: 0.8 }, statVal: { color: theme.colors.onBrandPrimary, fontSize: 16, fontWeight: "600", marginTop: 4 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, sectionTitle: { fontSize: 18, fontWeight: "bold", color: theme.colors.onSurface }, seeAll: { fontSize: 14, color: theme.colors.brandPrimary, fontWeight: "500" }, accountsList: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md }, accCard: { backgroundColor: theme.colors.surfaceContainer, borderRadius: radius.lg, padding: spacing.md, width: 140, gap: spacing.sm }, accIconBox: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: theme.colors.brandTertiary, justifyContent: "center", alignItems: "center" }, accName: { fontSize: 14, fontWeight: "500", color: theme.colors.onSurface }, accBalance: { fontSize: 16, fontWeight: "bold", color: theme.colors.brandPrimary }, txList: { paddingHorizontal: spacing.lg, gap: spacing.md }, txRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }, txIcon: { width: 48, height: 48, borderRadius: radius.md, justifyContent: "center", alignItems: "center" }, txCat: { fontSize: 14, fontWeight: "500", color: theme.colors.onSurface }, txDate: { fontSize: 12, color: theme.colors.muted, marginTop: 4 }, txAmt: { fontSize: 16, fontWeight: "bold", color: theme.colors.onSurface }, fab: { position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, justifyContent: "center", alignItems: "center", shadowColor: theme.colors.brandPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }, headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.onSurface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, chipsRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md }, chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.outline }, chipText: { fontSize: 14, color: theme.colors.onSurface }, row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.outline }, rowIcon: { width: 48, height: 48, borderRadius: radius.md, justifyContent: "center", alignItems: "center" }, rowLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: theme.colors.onSurface }, rowValue: { fontSize: 14, color: theme.colors.muted }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.brandTertiary, justifyContent: "center", alignItems: "center", marginBottom: spacing.md }, avatarText: { fontSize: 28, fontWeight: "bold", color: theme.colors.onBrandTertiary }, name: { fontSize: 20, fontWeight: "bold", color: theme.colors.onBrandPrimary, marginBottom: spacing.sm }, email: { fontSize: 14, color: theme.colors.onBrandPrimary, opacity: 0.8 }, bgPreview: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }, previewLabel: { fontSize: 14, fontWeight: "500", color: theme.colors.onSurface, marginBottom: spacing.sm }, previewImg: { width: "100%", height: 200, borderRadius: radius.lg }, section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }, logoutBtn: { marginHorizontal: spacing.lg, marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: theme.colors.errorContainer, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm }, logoutText: { fontSize: 16, fontWeight: "600", color: theme.colors.error }, credits: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: spacing.lg }, subHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.outline }, subTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.onSurface, flex: 1, textAlign: "center" }, hint: { fontSize: 12, color: theme.colors.muted, textAlign: "center", marginTop: spacing.lg }, modalRoot: { flex: 1, justifyContent: "flex-end" }, modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }, modalSheet: { backgroundColor: theme.colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: spacing.xl }, modalTitle: { fontSize: 20, fontWeight: "bold", color: theme.colors.onSurface, marginBottom: spacing.sm }, label: { fontSize: 14, fontWeight: "600", color: theme.colors.onSurface, marginTop: spacing.md }, input: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: theme.colors.onSurface }, grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }, pill: { flex: 1, minWidth: "30%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.outline, alignItems: "center" }, pillText: { fontSize: 14, color: theme.colors.onSurface }, iconBtn: { width: "20%", aspectRatio: 1, borderRadius: radius.md, borderWidth: 2, borderColor: theme.colors.outline, justifyContent: "center", alignItems: "center" }, saveBtn: { marginTop: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: theme.colors.brandPrimary, alignItems: "center" }, saveBtnText: { fontSize: 16, fontWeight: "bold", color: theme.colors.onBrandPrimary }, catCard: { width: "25%", alignItems: "center", gap: spacing.sm }, catIcon: { width: 56, height: 56, borderRadius: radius.md, justifyContent: "center", alignItems: "center" }, catName: { fontSize: 12, textAlign: "center", color: theme.colors.onSurface }, segRow: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }, segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: theme.colors.outline, alignItems: "center" }, segText: { fontSize: 14, fontWeight: "500", color: theme.colors.onSurface }, note: { fontSize: 12, color: theme.colors.muted, fontStyle: "italic", marginTop: 2 } }));
