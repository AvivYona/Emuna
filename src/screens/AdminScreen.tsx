import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { ScreenContainer } from "../components/ScreenContainer";
import { GlassCard } from "../components/GlassCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors, spacing } from "../theme";
import {
  fetchAdminQuotes,
  createAdminQuote,
  updateAdminQuote,
  deleteAdminQuote,
  fetchAdminBackgrounds,
  createAdminBackground,
  updateAdminBackground,
  deleteAdminBackground,
  AdminQuotePayload,
  AdminBackgroundPayload,
} from "../api/admin";
import { Quote, Background, Author } from "../api/types";
import { getAuthors } from "../api/authors";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { useFocusEffect } from "@react-navigation/native";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

type QuoteModalState =
  | { visible: false }
  | { visible: true; mode: "create"; quote?: undefined }
  | { visible: true; mode: "edit"; quote: Quote };

type BackgroundModalState =
  | { visible: false }
  | { visible: true; mode: "create"; background?: undefined }
  | { visible: true; mode: "edit"; background: Background };

export const AdminScreen: React.FC<Props> = ({ navigation, route }) => {
  const { adminSecret } = route.params;
  const [activeTab, setActiveTab] = useState<"quotes" | "backgrounds">(
    "quotes"
  );

  const [authors, setAuthors] = useState<Author[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);

  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);

  const [quoteModal, setQuoteModal] = useState<QuoteModalState>({
    visible: false,
  });
  const [backgroundModal, setBackgroundModal] = useState<BackgroundModalState>({
    visible: false,
  });

  const [quoteForm, setQuoteForm] = useState<{
    quote: string;
    authorId: string;
  }>({ quote: "", authorId: "" });
  const [backgroundForm, setBackgroundForm] = useState<AdminBackgroundPayload>({
    title: "",
    imageUrl: "",
    thumbnailUrl: "",
    dominantColor: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const loadAuthors = useCallback(async () => {
    setLoadingAuthors(true);
    try {
      const response = await getAuthors();
      setAuthors(response);
    } catch (error) {
      Alert.alert("שגיאה", "טעינת המחברים נכשלה. נסה שוב מאוחר יותר.");
    } finally {
      setLoadingAuthors(false);
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    try {
      const data = await fetchAdminQuotes(adminSecret);
      setQuotes(data);
    } catch (error) {
      Alert.alert("שגיאה", "טעינת הציטוטים נכשלה.");
    } finally {
      setLoadingQuotes(false);
    }
  }, [adminSecret]);

  const loadBackgrounds = useCallback(async () => {
    setLoadingBackgrounds(true);
    try {
      const data = await fetchAdminBackgrounds(adminSecret);
      setBackgrounds(data);
    } catch (error) {
      Alert.alert("שגיאה", "טעינת הרקעים נכשלה.");
    } finally {
      setLoadingBackgrounds(false);
    }
  }, [adminSecret]);

  useFocusEffect(
    useCallback(() => {
      loadAuthors();
      loadQuotes();
      loadBackgrounds();
    }, [loadAuthors, loadQuotes, loadBackgrounds])
  );

  const resetQuoteForm = () => {
    setQuoteForm({ quote: "", authorId: authors[0]?._id ?? "" });
  };

  const resetBackgroundForm = () => {
    setBackgroundForm({
      title: "",
      imageUrl: "",
      thumbnailUrl: "",
      dominantColor: "",
    });
  };

  const openCreateQuote = () => {
    resetQuoteForm();
    setQuoteModal({ visible: true, mode: "create" });
  };

  const openEditQuote = (quote: Quote) => {
    setQuoteForm({ quote: quote.quote, authorId: quote.author._id });
    setQuoteModal({ visible: true, mode: "edit", quote });
  };

  const openCreateBackground = () => {
    resetBackgroundForm();
    setBackgroundModal({ visible: true, mode: "create" });
  };

  const openEditBackground = (background: Background) => {
    setBackgroundForm({
      title: background.title ?? "",
      imageUrl: background.imageUrl,
      thumbnailUrl: background.thumbnailUrl ?? "",
      dominantColor: background.dominantColor ?? "",
    });
    setBackgroundModal({ visible: true, mode: "edit", background });
  };

  const closeQuoteModal = () => setQuoteModal({ visible: false });
  const closeBackgroundModal = () => setBackgroundModal({ visible: false });

  const authorsById = useMemo(() => {
    return authors.reduce<Record<string, Author>>((acc, author) => {
      acc[author._id] = author;
      return acc;
    }, {});
  }, [authors]);

  const renderQuoteList = () => {
    if (loadingQuotes) {
      return <LoadingState label="טוען ציטוטים..." />;
    }

    if (!quotes.length) {
      return <EmptyState message="אין ציטוטים להצגה. הוסף ציטוט חדש." />;
    }

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
        {quotes.map((quote) => (
          <View key={quote._id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemAuthor}>
                {quote.author?.name ?? "לא ידוע"}
              </Text>
              <View style={styles.itemActions}>
                <Pressable
                  onPress={() => openEditQuote(quote)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>עריכה</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteQuote(quote)}
                  style={[styles.actionButton, styles.actionDanger]}
                >
                  <Text style={[styles.actionText, styles.actionDangerText]}>
                    מחיקה
                  </Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.itemBody}>{quote.quote}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderBackgroundList = () => {
    if (loadingBackgrounds) {
      return <LoadingState label="טוען רקעים..." />;
    }

    if (!backgrounds.length) {
      return <EmptyState message="אין רקעים להצגה. הוסף רקע חדש." />;
    }

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
        {backgrounds.map((background) => (
          <View key={background._id} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemAuthor}>
                {background.title ?? "רקע ללא שם"}
              </Text>
              <View style={styles.itemActions}>
                <Pressable
                  onPress={() => openEditBackground(background)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionText}>עריכה</Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDeleteBackground(background)}
                  style={[styles.actionButton, styles.actionDanger]}
                >
                  <Text style={[styles.actionText, styles.actionDangerText]}>
                    מחיקה
                  </Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.itemBody}>{background.imageUrl}</Text>
          </View>
        ))}
      </ScrollView>
    );
  };

  const confirmDeleteQuote = (quote: Quote) => {
    Alert.alert("מחיקת ציטוט", "האם אתה בטוח שברצונך למחוק את הציטוט?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAdminQuote(adminSecret, quote._id);
            await loadQuotes();
          } catch (error) {
            Alert.alert("שגיאה", "לא ניתן למחוק את הציטוט.");
          }
        },
      },
    ]);
  };

  const confirmDeleteBackground = (background: Background) => {
    Alert.alert("מחיקת רקע", "האם אתה בטוח שברצונך למחוק את הרקע?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAdminBackground(adminSecret, background._id);
            await loadBackgrounds();
          } catch (error) {
            Alert.alert("שגיאה", "לא ניתן למחוק את הרקע.");
          }
        },
      },
    ]);
  };

  const handleSubmitQuote = async () => {
    if (!quoteForm.quote.trim() || !quoteForm.authorId) {
      Alert.alert("שגיאה", "אנא מלא את כל השדות הנדרשים.");
      return;
    }

    setSubmitting(true);
    try {
      if (
        quoteModal.visible &&
        quoteModal.mode === "edit" &&
        quoteModal.quote
      ) {
        const payload: AdminQuotePayload = {
          quote: quoteForm.quote.trim(),
          authorId: quoteForm.authorId,
        };
        await updateAdminQuote(adminSecret, quoteModal.quote._id, payload);
      } else {
        const payload: AdminQuotePayload = {
          quote: quoteForm.quote.trim(),
          authorId: quoteForm.authorId,
        };
        await createAdminQuote(adminSecret, payload);
      }

      await loadQuotes();
      closeQuoteModal();
    } catch (error) {
      Alert.alert("שגיאה", "שמירת הציטוט נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBackground = async () => {
    if (!backgroundForm.imageUrl.trim()) {
      Alert.alert("שגיאה", "יש להזין כתובת תמונה תקינה.");
      return;
    }

    setSubmitting(true);
    const payload: AdminBackgroundPayload = {
      title: backgroundForm.title?.trim() || undefined,
      imageUrl: backgroundForm.imageUrl.trim(),
      thumbnailUrl: backgroundForm.thumbnailUrl?.trim() || undefined,
      dominantColor: backgroundForm.dominantColor?.trim() || undefined,
    };

    try {
      if (
        backgroundModal.visible &&
        backgroundModal.mode === "edit" &&
        backgroundModal.background
      ) {
        await updateAdminBackground(
          adminSecret,
          backgroundModal.background._id,
          payload
        );
      } else {
        await createAdminBackground(adminSecret, payload);
      }

      await loadBackgrounds();
      closeBackgroundModal();
    } catch (error) {
      Alert.alert("שגיאה", "שמירת הרקע נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTabToggle = () => (
    <View style={styles.tabContainer}>
      <Pressable
        onPress={() => setActiveTab("quotes")}
        style={[
          styles.tabButton,
          activeTab === "quotes" && styles.tabButtonActive,
        ]}
      >
        <Text
          style={[
            styles.tabLabel,
            activeTab === "quotes" && styles.tabLabelActive,
          ]}
        >
          ציטוטים
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setActiveTab("backgrounds")}
        style={[
          styles.tabButton,
          activeTab === "backgrounds" && styles.tabButtonActive,
        ]}
      >
        <Text
          style={[
            styles.tabLabel,
            activeTab === "backgrounds" && styles.tabLabelActive,
          ]}
        >
          רקעים
        </Text>
      </Pressable>
    </View>
  );

  const renderActions = () => {
    const canCreateQuote = authors.length > 0 && !loadingAuthors;
    return (
      <View style={styles.actionsRow}>
        <PrimaryButton
          label={activeTab === "quotes" ? "הוסף ציטוט" : "הוסף רקע"}
          onPress={
            activeTab === "quotes" ? openCreateQuote : openCreateBackground
          }
          disabled={activeTab === "quotes" ? !canCreateQuote : false}
        />
        <PrimaryButton
          label="ריענון"
          variant="secondary"
          onPress={() => {
            if (activeTab === "quotes") {
              loadQuotes();
            } else {
              loadBackgrounds();
            }
          }}
        />
        <PrimaryButton
          label="חזרה"
          variant="secondary"
          onPress={() => navigation.replace("Backgrounds")}
        />
      </View>
    );
  };

  return (
    <ScreenContainer>
      <GlassCard>
        <Text style={styles.heading}>מסך ניהול</Text>
        <Text style={styles.subheading}>
          נהל את התוכן של האפליקציה: ציטוטים ורקעים.
        </Text>
        {renderTabToggle()}
        {renderActions()}
        <View style={styles.listContainer}>
          {activeTab === "quotes" ? renderQuoteList() : renderBackgroundList()}
        </View>
      </GlassCard>

      <Modal
        visible={quoteModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeQuoteModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>
              {quoteModal.visible && quoteModal.mode === "edit"
                ? "עריכת ציטוט"
                : "הוספת ציטוט"}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalLabel}>תוכן הציטוט</Text>
              <TextInput
                multiline
                value={quoteForm.quote}
                onChangeText={(value) =>
                  setQuoteForm((prev) => ({ ...prev, quote: value }))
                }
                style={[styles.input, styles.textarea]}
                placeholder="כתוב כאן את הציטוט..."
                placeholderTextColor="rgba(224, 225, 221, 0.4)"
              />
              <Text style={styles.modalLabel}>בחר מחבר</Text>
              <View style={styles.authorList}>
                {loadingAuthors ? (
                  <LoadingState label="טוען מחברים..." />
                ) : (
                  authors.map((author) => {
                    const selected = quoteForm.authorId === author._id;
                    return (
                      <Pressable
                        key={author._id}
                        onPress={() =>
                          setQuoteForm((prev) => ({
                            ...prev,
                            authorId: author._id,
                          }))
                        }
                        style={[
                          styles.authorOption,
                          selected && styles.authorOptionSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.authorOptionLabel,
                            selected && styles.authorOptionLabelSelected,
                          ]}
                        >
                          {author.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>
            <PrimaryButton
              label="שמירה"
              onPress={handleSubmitQuote}
              loading={submitting}
              disabled={submitting}
            />
            <PrimaryButton
              label="ביטול"
              variant="secondary"
              onPress={closeQuoteModal}
              disabled={submitting}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={backgroundModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeBackgroundModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>
              {backgroundModal.visible && backgroundModal.mode === "edit"
                ? "עריכת רקע"
                : "הוספת רקע"}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
            >
              <Text style={styles.modalLabel}>שם הרקע</Text>
              <TextInput
                value={backgroundForm.title}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({ ...prev, title: value }))
                }
                style={styles.input}
                placeholder="שם תצוגה (אופציונלי)"
                placeholderTextColor="rgba(224, 225, 221, 0.4)"
              />
              <Text style={styles.modalLabel}>כתובת תמונה</Text>
              <TextInput
                value={backgroundForm.imageUrl}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({ ...prev, imageUrl: value }))
                }
                style={styles.input}
                placeholder="https://example.com/background.jpg"
                placeholderTextColor="rgba(224, 225, 221, 0.4)"
              />
              <Text style={styles.modalLabel}>
                כתובת תמונה ממוזערת (אופציונלי)
              </Text>
              <TextInput
                value={backgroundForm.thumbnailUrl}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({
                    ...prev,
                    thumbnailUrl: value,
                  }))
                }
                style={styles.input}
                placeholder="https://example.com/thumbnail.jpg"
                placeholderTextColor="rgba(224, 225, 221, 0.4)"
              />
              <Text style={styles.modalLabel}>
                צבע דומיננטי (HEX, אופציונלי)
              </Text>
              <TextInput
                value={backgroundForm.dominantColor}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({
                    ...prev,
                    dominantColor: value,
                  }))
                }
                style={styles.input}
                placeholder="#FFFFFF"
                placeholderTextColor="rgba(224, 225, 221, 0.4)"
              />
            </ScrollView>
            <PrimaryButton
              label="שמירה"
              onPress={handleSubmitBackground}
              loading={submitting}
              disabled={submitting}
            />
            <PrimaryButton
              label="ביטול"
              variant="secondary"
              onPress={closeBackgroundModal}
              disabled={submitting}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "right",
  },
  subheading: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: colors.accentSoft,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.accent,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  listContainer: {
    borderRadius: spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: spacing.md,
    minHeight: 220,
  },
  scrollArea: {
    maxHeight: 380,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  itemCard: {
    borderRadius: spacing.lg,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  itemAuthor: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  itemActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  actionDanger: {
    backgroundColor: "rgba(201, 76, 76, 0.15)",
  },
  actionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionDangerText: {
    color: colors.danger,
  },
  itemBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "right",
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(8, 12, 20, 0.75)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderRadius: spacing.xl,
    backgroundColor: colors.background,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: "85%",
  },
  modalHeading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "right",
  },
  modalScroll: {
    marginVertical: spacing.sm,
  },
  modalScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "right",
  },
  input: {
    width: "100%",
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    textAlign: "right",
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  authorList: {
    gap: spacing.xs,
  },
  authorOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  authorOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  authorOptionLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "right",
  },
  authorOptionLabelSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
});
