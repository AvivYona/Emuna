import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Alert,
  Image,
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
  fetchAdminAuthors,
  createAdminAuthor,
  updateAdminAuthor,
  deleteAdminAuthor,
  AdminQuotePayload,
  AdminBackgroundPayload,
  AdminBackgroundFile,
  AdminAuthorPayload,
} from "../api/admin";
import { Quote, Background, Author } from "../api/types";
import { getAuthors } from "../api/authors";
import { getBackgroundDisplayName } from "../api/backgrounds";
import { LoadingState } from "../components/LoadingState";
import { EmptyState } from "../components/EmptyState";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;

type QuoteModalState =
  | { visible: false }
  | { visible: true; mode: "create"; quote?: undefined }
  | { visible: true; mode: "edit"; quote: Quote };

type BackgroundModalState =
  | { visible: false }
  | { visible: true; mode: "create"; background?: undefined }
  | { visible: true; mode: "edit"; background: Background };

type LocalImageAsset = {
  uri: string;
  name: string;
  type: string;
};

type AuthorModalState =
  | { visible: false }
  | { visible: true; mode: "create"; author?: undefined }
  | { visible: true; mode: "edit"; author: Author };

export const AdminScreen: React.FC<Props> = ({ navigation, route }) => {
  const { adminSecret } = route.params;
  const [activeTab, setActiveTab] = useState<
    "quotes" | "backgrounds" | "authors"
  >("quotes");

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
  const [authorModal, setAuthorModal] = useState<AuthorModalState>({
    visible: false,
  });

  const [quoteForm, setQuoteForm] = useState<{
    quote: string;
    authorId: string;
  }>({ quote: "", authorId: "" });
  const [backgroundForm, setBackgroundForm] = useState<AdminBackgroundPayload>({
    filename: "",
    contentType: "image/jpeg",
  });
  const [selectedImage, setSelectedImage] = useState<LocalImageAsset | null>(
    null
  );
  const [authorForm, setAuthorForm] = useState<AdminAuthorPayload>({
    name: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const loadAuthors = useCallback(async () => {
    setLoadingAuthors(true);
    try {
      const response = await fetchAdminAuthors(adminSecret);
      if (response.length) {
        setAuthors(response);
      } else {
        const fallback = await getAuthors();
        setAuthors(fallback);
      }
    } catch (error) {
      try {
        const fallback = await getAuthors();
        setAuthors(fallback);
      } catch (innerError) {
        Alert.alert("שגיאה", "טעינת המחברים נכשלה. נסה שוב מאוחר יותר.");
      }
    } finally {
      setLoadingAuthors(false);
    }
  }, [adminSecret]);

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
      filename: "",
      contentType: "image/jpeg",
    });
    setSelectedImage(null);
  };

  const resetAuthorForm = () => {
    setAuthorForm({ name: "" });
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
      filename: background.filename ?? "",
      contentType: background.contentType ?? "image/jpeg",
    });
    setBackgroundModal({ visible: true, mode: "edit", background });
    setSelectedImage(null);
  };

  const openCreateAuthor = () => {
    resetAuthorForm();
    setAuthorModal({ visible: true, mode: "create" });
  };

  const openEditAuthor = (author: Author) => {
    setAuthorForm({ name: author.name });
    setAuthorModal({ visible: true, mode: "edit", author });
  };

  const closeQuoteModal = () => setQuoteModal({ visible: false });
  const closeBackgroundModal = () => {
    setBackgroundModal({ visible: false });
    setSelectedImage(null);
  };
  const closeAuthorModal = () => setAuthorModal({ visible: false });

  const quotesByAuthorCount = useMemo(() => {
    return quotes.reduce<Record<string, number>>((acc, quote) => {
      const authorId = quote.author?._id;
      if (authorId) {
        acc[authorId] = (acc[authorId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [quotes]);

  useEffect(() => {
    if (!authors.length) {
      setQuoteForm((prev) => ({ ...prev, authorId: "" }));
      return;
    }

    setQuoteForm((prev) => {
      if (
        prev.authorId &&
        authors.some((author) => author._id === prev.authorId)
      ) {
        return prev;
      }
      return { ...prev, authorId: authors[0]._id };
    });
  }, [authors]);

  const inferExtensionFromUri = (uri: string): string => {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1].toLowerCase() : "jpg";
  };

  const inferMimeTypeFromFilename = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "png":
        return "image/png";
      case "webp":
        return "image/webp";
      case "heic":
      case "heif":
        return "image/heic";
      case "gif":
        return "image/gif";
      case "bmp":
        return "image/bmp";
      case "jpg":
      case "jpeg":
      default:
        return "image/jpeg";
    }
  };

  const handlePickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        "אין הרשאה",
        "כדי לבחור תמונות יש להעניק הרשאה לספריית התמונות."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    const fallbackName = asset.fileName
      ? asset.fileName
      : `background-${Date.now()}.${inferExtensionFromUri(asset.uri)}`;
    const inferredType =
      asset.mimeType ?? inferMimeTypeFromFilename(fallbackName);

    setSelectedImage({
      uri: asset.uri,
      name: fallbackName,
      type: inferredType,
    });

    setBackgroundForm((prev) => ({
      ...prev,
      filename: prev.filename ? prev.filename : fallbackName,
      contentType: inferredType,
    }));
  }, []);

  const handleClearSelectedImage = () => {
    setSelectedImage(null);
  };

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
        showsVerticalScrollIndicator={false}
      >
        {quotes.map((quote) => {
          const key =
            quote._id || `${quote.author?.name ?? "author"}_${quote.quote}`;
          return (
            <View key={key} style={styles.itemCard}>
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
          );
        })}
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
        showsVerticalScrollIndicator={false}
      >
        {backgrounds.map((background) => {
          const displayName = getBackgroundDisplayName(background);
          const key =
            background.filename ?? background.imageUrl ?? background._id;
          return (
            <View key={key} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemAuthor}>{displayName}</Text>
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
              <Text style={styles.itemBody}>
                {background.filename ?? background.imageUrl ?? background._id}
              </Text>
              {background.imageUrl ? (
                <Text style={styles.itemMeta}>{background.imageUrl}</Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderAuthorList = () => {
    if (loadingAuthors) {
      return <LoadingState label="טוען מחברים..." />;
    }

    if (!authors.length) {
      return <EmptyState message="אין מחברים להצגה. הוסף מחבר חדש." />;
    }

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {authors.map((author) => {
          const key = author._id || author.name;
          const quoteCount = quotesByAuthorCount[author._id] ?? 0;
          return (
            <View key={key} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemAuthor}>{author.name}</Text>
                <View style={styles.itemActions}>
                  <Pressable
                    onPress={() => openEditAuthor(author)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionText}>עריכה</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDeleteAuthor(author)}
                    style={[styles.actionButton, styles.actionDanger]}
                  >
                    <Text style={[styles.actionText, styles.actionDangerText]}>
                      מחיקה
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.itemBody}>מזהה: {author._id}</Text>
              <View style={styles.authorMetaRow}>
                <Text style={styles.authorMetaText}>
                  {quoteCount === 0
                    ? "אין ציטוטים מקושרים"
                    : quoteCount === 1
                    ? "ציטוט אחד מקושר"
                    : `${quoteCount} ציטוטים מקושרים`}
                </Text>
              </View>
            </View>
          );
        })}
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

  const confirmDeleteAuthor = (author: Author) => {
    Alert.alert("מחיקת מחבר", "האם אתה בטוח שברצונך למחוק את המחבר?", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחק",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAdminAuthor(adminSecret, author._id);
            await loadAuthors();
            await loadQuotes();
          } catch (error) {
            Alert.alert("שגיאה", "לא ניתן למחוק את המחבר.");
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
    if (!backgroundForm.filename.trim()) {
      Alert.alert("שגיאה", "יש להזין שם קובץ תקין.");
      return;
    }

    setSubmitting(true);
    const payload: AdminBackgroundPayload = {
      filename: backgroundForm.filename.trim(),
      contentType: backgroundForm.contentType?.trim() || undefined,
    };

    const isCreateModal =
      backgroundModal.visible && backgroundModal.mode === "create";
    if (isCreateModal && !selectedImage) {
      Alert.alert("שגיאה", "בחר תמונה מספריית התמונות לפני שמירה.");
      setSubmitting(false);
      return;
    }

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
        const uploadFile: AdminBackgroundFile | undefined = selectedImage
          ? {
              uri: selectedImage.uri,
              name: backgroundForm.filename.trim(),
              type:
                backgroundForm.contentType?.trim() ||
                selectedImage.type ||
                "image/jpeg",
            }
          : undefined;

        await createAdminBackground(adminSecret, payload, uploadFile);
      }

      await loadBackgrounds();
      closeBackgroundModal();
      setSelectedImage(null);
    } catch (error) {
      Alert.alert("שגיאה", "שמירת הרקע נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAuthor = async () => {
    if (!authorForm.name.trim()) {
      Alert.alert("שגיאה", "יש להזין שם מחבר תקין.");
      return;
    }

    setSubmitting(true);
    const payload: AdminAuthorPayload = {
      name: authorForm.name.trim(),
    };

    try {
      if (
        authorModal.visible &&
        authorModal.mode === "edit" &&
        authorModal.author
      ) {
        await updateAdminAuthor(adminSecret, authorModal.author._id, payload);
      } else {
        await createAdminAuthor(adminSecret, payload);
      }

      await loadAuthors();
      await loadQuotes();
      closeAuthorModal();
      resetAuthorForm();
    } catch (error) {
      Alert.alert("שגיאה", "שמירת המחבר נכשלה.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderTabToggle = () => {
    const options: Array<{
      label: string;
      value: "quotes" | "backgrounds" | "authors";
    }> = [
      { label: "ציטוטים", value: "quotes" },
      { label: "רקעים", value: "backgrounds" },
      { label: "מחברים", value: "authors" },
    ];

    return (
      <View style={styles.tabContainer}>
        {options.map((option) => {
          const isActive = activeTab === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setActiveTab(option.value)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderActions = () => {
    const canCreateQuote = authors.length > 0 && !loadingAuthors;

    let primaryLabel = "";
    let primaryHandler = () => {};
    let primaryDisabled = false;
    let refreshHandler = () => {};

    switch (activeTab) {
      case "quotes":
        primaryLabel = "הוסף ציטוט";
        primaryHandler = openCreateQuote;
        primaryDisabled = !canCreateQuote;
        refreshHandler = loadQuotes;
        break;
      case "backgrounds":
        primaryLabel = "הוסף רקע";
        primaryHandler = openCreateBackground;
        refreshHandler = loadBackgrounds;
        break;
      case "authors":
        primaryLabel = "הוסף מחבר";
        primaryHandler = openCreateAuthor;
        refreshHandler = loadAuthors;
        break;
      default:
        primaryLabel = "הוסף";
        primaryHandler = () => {};
        refreshHandler = () => {};
    }

    return (
      <View style={styles.actionsRow}>
        <PrimaryButton
          label={primaryLabel}
          onPress={primaryHandler}
          disabled={primaryDisabled}
        />
        <PrimaryButton
          label="ריענון"
          variant="secondary"
          onPress={refreshHandler}
          disabled={loadingAuthors && activeTab === "authors"}
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
          נהל את התוכן של האפליקציה: ציטוטים, רקעים ומחברים.
        </Text>
        {renderTabToggle()}
        {renderActions()}
        <View style={styles.listContainer}>
          {activeTab === "quotes"
            ? renderQuoteList()
            : activeTab === "backgrounds"
            ? renderBackgroundList()
            : renderAuthorList()}
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
                placeholderTextColor="rgba(58, 32, 22, 0.4)"
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
              <Text style={styles.modalLabel}>שם הקובץ (S3)</Text>
              <TextInput
                value={backgroundForm.filename}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({ ...prev, filename: value }))
                }
                style={styles.input}
                placeholder="folder/background.jpg"
                placeholderTextColor="rgba(58, 32, 22, 0.4)"
              />
              <Text style={styles.modalLabel}>סוג תוכן (Content-Type)</Text>
              <TextInput
                value={backgroundForm.contentType}
                onChangeText={(value) =>
                  setBackgroundForm((prev) => ({ ...prev, contentType: value }))
                }
                style={styles.input}
                placeholder="image/jpeg"
                placeholderTextColor="rgba(58, 32, 22, 0.4)"
              />
              {backgroundModal.visible && backgroundModal.mode === "create" && (
                <>
                  <PrimaryButton
                    label={
                      selectedImage ? "בחר תמונה אחרת" : "בחירת תמונה מהספרייה"
                    }
                    onPress={handlePickImage}
                    variant="secondary"
                  />
                  {selectedImage ? (
                    <View style={styles.imagePreview}>
                      <Image
                        source={{ uri: selectedImage.uri }}
                        style={styles.imagePreviewImage}
                      />
                      <Text style={styles.imagePreviewLabel}>
                        {selectedImage.name}
                      </Text>
                      <PrimaryButton
                        label="הסר תמונה"
                        variant="secondary"
                        onPress={handleClearSelectedImage}
                      />
                    </View>
                  ) : null}
                </>
              )}
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

      <Modal
        visible={authorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeAuthorModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>
              {authorModal.visible && authorModal.mode === "edit"
                ? "עריכת מחבר"
                : "הוספת מחבר"}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalLabel}>שם המחבר</Text>
              <TextInput
                value={authorForm.name}
                onChangeText={(value) => setAuthorForm({ name: value })}
                style={styles.input}
                placeholder='לדוגמה: הרמב"ם'
                placeholderTextColor="rgba(58, 32, 22, 0.4)"
              />
            </ScrollView>
            <PrimaryButton
              label="שמירה"
              onPress={handleSubmitAuthor}
              loading={submitting}
              disabled={submitting}
            />
            <PrimaryButton
              label="ביטול"
              variant="secondary"
              onPress={closeAuthorModal}
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
    backgroundColor: colors.card,
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
    flexDirection: "column",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  listContainer: {
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
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
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.divider,
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
    backgroundColor: colors.accentSoft,
  },
  actionDanger: {
    backgroundColor: "rgba(201, 76, 76, 0.15)",
  },
  actionText: {
    fontSize: 14,
    color: colors.textPrimary,
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
  itemMeta: {
    fontSize: 12,
    color: "rgba(58, 32, 22, 0.55)",
    textAlign: "right",
    direction: "rtl",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(58, 32, 22, 0.65)",
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
  imagePreview: {
    gap: spacing.sm,
    alignItems: "center",
  },
  imagePreviewImage: {
    width: "100%",
    height: 200,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  imagePreviewLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
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
    backgroundColor: colors.card,
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
    borderColor: colors.divider,
    backgroundColor: colors.card,
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
  authorMetaRow: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  authorMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "right",
  },
});
