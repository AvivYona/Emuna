import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import ViewShot from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import { ScreenContainer } from "../components/ScreenContainer";
import { PrimaryButton } from "../components/PrimaryButton";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Background, Quote } from "../api/types";
import { getCleanBackgrounds } from "../api/backgrounds";
import { getQuotes } from "../api/quotes";
import { saveCustomBackground } from "../storage/customBackgroundsStorage";
import { colors, spacing } from "../theme";

type CreateBackgroundScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "CreateBackground"
>;

type ActiveTab = "backgrounds" | "quotes";

type Position = {
  x: number;
  y: number;
};

type EditableText = {
  id: string;
  content: string;
  fontSize: number;
  color: string;
  position: Position;
};

type DraggableTextProps = {
  item: EditableText;
  selected: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: Position): void;
  onEdit(id: string): void;
  canvasWidth: number;
  canvasHeight: number;
};

const textBoundaryMargin = 40;
const QUOTE_CARD_HEIGHT = 100;

const DraggableText: React.FC<DraggableTextProps> = ({
  item,
  selected,
  onSelect,
  onMove,
  onEdit,
  canvasWidth,
  canvasHeight,
}) => {
  const startPosition = useRef(item.position);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    startPosition.current = item.position;
  }, [item.position]);

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasWidth - textBoundaryMargin);
      const maxY = Math.max(0, canvasHeight - textBoundaryMargin);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasHeight, canvasWidth]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onSelect(item.id);
          startPosition.current = item.position;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextPosition = clampPosition({
            x: startPosition.current.x + gestureState.dx,
            y: startPosition.current.y + gestureState.dy,
          });
          onMove(item.id, nextPosition);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextPosition = clampPosition({
            x: startPosition.current.x + gestureState.dx,
            y: startPosition.current.y + gestureState.dy,
          });
          onMove(item.id, nextPosition);
          const isTap =
            Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;
          if (isTap) {
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              lastTapRef.current = 0;
              onEdit(item.id);
            } else {
              lastTapRef.current = now;
            }
          }
        },
      }),
    [clampPosition, item.id, onEdit, onMove, onSelect]
  );

  return (
    <View
      style={[
        styles.draggableText,
        {
          left: item.position.x,
          top: item.position.y,
          borderColor: selected ? colors.accent : "transparent",
          backgroundColor: selected
            ? "rgba(255, 255, 255, 0.35)"
            : "transparent",
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Text
        style={[
          styles.draggableTextContent,
          { fontSize: item.fontSize, color: item.color },
        ]}
      >
        {item.content}
      </Text>
    </View>
  );
};

type BackgroundOptionProps = {
  background: Background;
  selected: boolean;
  onSelect(): void;
};

const BackgroundOption: React.FC<BackgroundOptionProps> = ({
  background,
  selected,
  onSelect,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.backgroundOption,
        pressed ? styles.backgroundOptionPressed : null,
        selected ? styles.backgroundOptionSelected : null,
      ]}
      onPress={onSelect}
    >
      <Image
        source={{ uri: background.thumbnailUrl ?? background.imageUrl }}
        style={styles.backgroundOptionImage}
      />
    </Pressable>
  );
};

type QuoteCardProps = {
  quote: Quote;
  onSelect(): void;
};

const QuoteCard: React.FC<QuoteCardProps> = ({ quote, onSelect }) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quoteCard,
        pressed ? styles.quoteCardPressed : null,
      ]}
      onPress={onSelect}
    >
      <Text style={styles.quoteText}>{quote.quote}</Text>
      <Text style={styles.quoteAuthor}>{quote.author.name}</Text>
    </Pressable>
  );
};

export const CreateBackgroundScreen: React.FC<CreateBackgroundScreenProps> = ({
  navigation,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("backgrounds");
  const [cleanBackgrounds, setCleanBackgrounds] = useState<Background[]>([]);
  const [backgroundsLoading, setBackgroundsLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [texts, setTexts] = useState<EditableText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [canvasBackgroundUri, setCanvasBackgroundUri] = useState<string | null>(
    null
  );
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<
    string | null
  >(null);
  const [importedUri, setImportedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestEditorFocus, setRequestEditorFocus] = useState(false);
  const [isQuotesEditorOpen, setIsQuotesEditorOpen] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);
  const textInputRef = useRef<TextInput>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const canvasDimensions = useMemo(() => {
    const aspectRatio =
      windowHeight > 0 && windowWidth > 0 ? windowHeight / windowWidth : 1.8;
    const horizontalPadding = spacing.xl * 2;
    const maxWidth = Math.max(200, windowWidth - horizontalPadding);
    let width = maxWidth;
    let height = width * aspectRatio;
    const maxHeight = windowHeight * 0.48;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / aspectRatio;
    }
    return {
      width,
      height,
    };
  }, [windowHeight, windowWidth]);

  const selectedText = useMemo(
    () =>
      selectedTextId
        ? texts.find((item) => item.id === selectedTextId) ?? null
        : null,
    [selectedTextId, texts]
  );

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasDimensions.width - textBoundaryMargin);
      const maxY = Math.max(0, canvasDimensions.height - textBoundaryMargin);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasDimensions.height, canvasDimensions.width]
  );

  const openQuotesEditor = useCallback(() => {
    setActiveTab("quotes");
    setIsQuotesEditorOpen(true);
  }, []);

  const closeQuotesEditor = useCallback(() => {
    setIsQuotesEditorOpen(false);
    setRequestEditorFocus(false);
  }, []);

  const handlePressBackgroundTab = useCallback(() => {
    setActiveTab("backgrounds");
    setIsQuotesEditorOpen(false);
  }, []);

  const handlePressQuotesTab = useCallback(() => {
    setActiveTab("quotes");
    setIsQuotesEditorOpen(false);
  }, []);

  const loadBackgrounds = useCallback(async () => {
    setBackgroundsLoading(true);
    try {
      const data = await getCleanBackgrounds();
      setCleanBackgrounds(data);
    } catch (error) {
      console.warn("Failed to load clean backgrounds", error);
    } finally {
      setBackgroundsLoading(false);
    }
  }, []);

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const data = await getQuotes();
      setQuotes(data);
    } catch (error) {
      console.warn("Failed to load quotes", error);
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackgrounds();
  }, [loadBackgrounds]);

  useEffect(() => {
    if (activeTab === "quotes" && !quotesLoading && quotes.length === 0) {
      void loadQuotes();
    }
  }, [activeTab, loadQuotes, quotes.length, quotesLoading]);

  const handleSelectBackground = useCallback((background: Background) => {
    setCanvasBackgroundUri(background.imageUrl);
    setSelectedBackgroundId(background._id);
    setImportedUri(null);
  }, []);

  const handleImportBackground = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const [asset] = result.assets;
      if (!asset.uri) {
        return;
      }
      setCanvasBackgroundUri(asset.uri);
      setImportedUri(asset.uri);
      setSelectedBackgroundId(null);
    } catch (error) {
      console.warn("Error importing background", error);
    }
  }, []);

  const handleAddQuote = useCallback(
    (quote: Quote) => {
      const id = `quote-${quote._id}-${Date.now()}`;
      const basePosition = clampPosition({
        x: canvasDimensions.width * 0.15,
        y: canvasDimensions.height * 0.2,
      });
      setTexts((items) => [
        ...items,
        {
          id,
          content: quote.quote,
          fontSize: 28,
          color: colors.textPrimary,
          position: basePosition,
        },
      ]);
      setSelectedTextId(id);
      setRequestEditorFocus(true);
      openQuotesEditor();
    },
    [
      canvasDimensions.height,
      canvasDimensions.width,
      clampPosition,
      openQuotesEditor,
    ]
  );

  const handleAddCustomText = useCallback(() => {
    const id = `custom-${Date.now()}`;
    const basePosition = clampPosition({
      x: canvasDimensions.width * 0.25,
      y: canvasDimensions.height * 0.35,
    });
    setTexts((items) => [
      ...items,
      {
        id,
        content: "טקסט חדש",
        fontSize: 32,
        color: colors.textPrimary,
        position: basePosition,
      },
    ]);
    setSelectedTextId(id);
    setRequestEditorFocus(true);
    openQuotesEditor();
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    clampPosition,
    openQuotesEditor,
  ]);

  const handleMoveText = useCallback(
    (id: string, position: Position) => {
      setTexts((items) =>
        items.map((item) =>
          item.id === id ? { ...item, position: clampPosition(position) } : item
        )
      );
    },
    [clampPosition]
  );

  const handleChangeTextContent = useCallback((id: string, content: string) => {
    setTexts((items) =>
      items.map((item) => (item.id === id ? { ...item, content } : item))
    );
  }, []);

  const handleAdjustFontSize = useCallback((id: string, delta: number) => {
    setTexts((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              fontSize: Math.max(14, Math.min(72, item.fontSize + delta)),
            }
          : item
      )
    );
  }, []);

  const handleRemoveText = useCallback((id: string) => {
    setTexts((items) => items.filter((item) => item.id !== id));
    setSelectedTextId((current) => (current === id ? null : current));
    setIsQuotesEditorOpen(false);
  }, []);

  useEffect(() => {
    if (!selectedTextId) {
      setRequestEditorFocus(false);
      return;
    }
    if (requestEditorFocus) {
      textInputRef.current?.focus?.();
      setRequestEditorFocus(false);
    }
  }, [requestEditorFocus, selectedTextId]);

  useEffect(() => {
    if (!selectedText) {
      setIsQuotesEditorOpen(false);
    }
  }, [selectedText]);

  const handleSaveBackground = useCallback(async () => {
    if (saving) {
      return;
    }
    if (!viewShotRef.current) {
      Alert.alert("שגיאה", "לא הצלחנו לגשת לשטח העריכה. נסו שוב.");
      return;
    }
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) {
      Alert.alert("שגיאה", "התקן אינו תומך בשמירת קבצים מקומית.");
      return;
    }

    setSaving(true);
    try {
      const capture = viewShotRef.current.capture?.bind(viewShotRef.current);
      if (!capture) {
        throw new Error("CAPTURE_METHOD_MISSING");
      }
      const captureUri = await capture();
      if (!captureUri) {
        throw new Error("CAPTURE_FAILED");
      }
      const targetDir = `${baseDir}custom-backgrounds`;
      try {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      } catch (error) {
        // Directory may already exist; ignore the error.
      }
      const identifier = `custom-${Date.now()}`;
      const targetPath = `${targetDir}/${identifier}.jpg`;
      await FileSystem.copyAsync({ from: captureUri, to: targetPath });
      await FileSystem.deleteAsync(captureUri, { idempotent: true });

      const background: Background = {
        _id: identifier,
        imageUrl: targetPath,
        thumbnailUrl: targetPath,
        displayName: "רקע אישי",
      };

      await saveCustomBackground(background);

      navigation.navigate("Backgrounds", {
        highlightBackgroundId: identifier,
      });
    } catch (error) {
      console.warn("Failed to save custom background", error);
      Alert.alert("משהו השתבש", "לא הצלחנו לשמור את הרקע. נסו שוב מאוחר יותר.");
    } finally {
      setSaving(false);
    }
  }, [navigation, saving]);

  const isImportedSelected =
    importedUri !== null && canvasBackgroundUri === importedUri;

  return (
    <ScreenContainer withScroll={false}>
      <View style={styles.canvasWrapper}>
        <ViewShot
          ref={viewShotRef}
          style={[
            styles.canvasShot,
            {
              width: canvasDimensions.width,
              height: canvasDimensions.height,
            },
          ]}
          options={{ format: "jpg", quality: 0.92 }}
        >
          <View style={styles.canvas}>
            <View style={styles.canvasBase} />
            {canvasBackgroundUri ? (
              <Image
                source={{ uri: canvasBackgroundUri }}
                style={styles.canvasImage}
              />
            ) : null}
            {texts.map((text) => (
              <DraggableText
                key={text.id}
                item={text}
                selected={selectedTextId === text.id}
                onSelect={setSelectedTextId}
                onMove={handleMoveText}
                onEdit={(id) => {
                  setSelectedTextId(id);
                  setRequestEditorFocus(true);
                  openQuotesEditor();
                }}
                canvasWidth={canvasDimensions.width}
                canvasHeight={canvasDimensions.height}
              />
            ))}
          </View>
        </ViewShot>
      </View>
      <View style={styles.tabBar}>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "backgrounds" ? styles.tabButtonActive : null,
            pressed ? styles.tabButtonPressed : null,
          ]}
          onPress={handlePressBackgroundTab}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === "backgrounds" ? styles.tabLabelActive : null,
            ]}
          >
            רקעים
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.tabButton,
            activeTab === "quotes" ? styles.tabButtonActive : null,
            pressed ? styles.tabButtonPressed : null,
          ]}
          onPress={handlePressQuotesTab}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === "quotes" ? styles.tabLabelActive : null,
            ]}
          >
            ציטוטים
          </Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        {activeTab === "backgrounds" ? (
          <View style={styles.backgroundPanel}>
            <Text style={styles.sectionTitle}>בחרו רקע מהאוסף שלנו</Text>
            <Pressable
              style={({ pressed }) => [
                styles.importButton,
                isImportedSelected ? styles.importButtonActive : null,
                pressed ? styles.importButtonPressed : null,
              ]}
              onPress={handleImportBackground}
            >
              <Text style={styles.importButtonText}>ייבוא רקע מהטלפון</Text>
            </Pressable>
            {backgroundsLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={cleanBackgrounds}
                horizontal
                keyExtractor={(item) => item._id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.backgroundList}
                renderItem={({ item }) => (
                  <BackgroundOption
                    background={item}
                    selected={selectedBackgroundId === item._id}
                    onSelect={() => handleSelectBackground(item)}
                  />
                )}
              />
            )}
          </View>
        ) : isQuotesEditorOpen && selectedText ? (
          <View style={styles.quotesEditor}>
            <View style={styles.quotesEditorHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={closeQuotesEditor}
                style={({ pressed }) => [
                  styles.quotesEditorBackButton,
                  pressed ? styles.quotesEditorBackButtonPressed : null,
                ]}
              >
                <Text style={styles.quotesEditorBackLabel}>
                  בחירת ציטוט מוכן
                </Text>
              </Pressable>
              <View style={styles.quotesEditorHeaderSpacer} />
            </View>
            <TextInput
              ref={textInputRef}
              value={selectedText.content}
              onChangeText={(value) =>
                handleChangeTextContent(selectedText.id, value)
              }
              multiline
              placeholder="כתבו כאן את הטקסט שלכם..."
              placeholderTextColor={colors.textSecondary}
              style={styles.textInput}
            />
            <View style={styles.fontControls}>
              <Pressable
                style={({ pressed }) => [
                  styles.fontButton,
                  pressed ? styles.fontButtonPressed : null,
                ]}
                onPress={() => handleAdjustFontSize(selectedText.id, 2)}
              >
                <Text style={styles.fontButtonLabel}>A+</Text>
              </Pressable>
              <Text style={styles.fontSizeLabel}>
                {`גודל ${Math.round(selectedText.fontSize)}`}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.fontButton,
                  pressed ? styles.fontButtonPressed : null,
                ]}
                onPress={() => handleAdjustFontSize(selectedText.id, -2)}
              >
                <Text style={styles.fontButtonLabel}>A-</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.removeTextButton,
                  pressed ? styles.removeTextButtonPressed : null,
                ]}
                onPress={() => handleRemoveText(selectedText.id)}
              >
                <Text style={styles.removeTextButtonLabel}>מחק</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.quotesPanel}>
            <Text style={styles.sectionTitle}>
              בחרו ציטוט או הוסיפו טקסט אישי
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.addTextButton,
                pressed ? styles.addTextButtonPressed : null,
              ]}
              onPress={handleAddCustomText}
            >
              <Text style={styles.addTextButtonLabel}>הוספת טקסט חדש</Text>
            </Pressable>
            {quotesLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : quotes.length > 0 ? (
              <FlatList
                data={quotes}
                keyExtractor={(item) => item._id}
                style={styles.singleQuoteList}
                contentContainerStyle={styles.quotesList}
                renderItem={({ item }) => (
                  <QuoteCard
                    quote={item}
                    onSelect={() => handleAddQuote(item)}
                  />
                )}
                showsVerticalScrollIndicator={false}
                pagingEnabled
                snapToInterval={QUOTE_CARD_HEIGHT + spacing.sm}
                snapToAlignment="start"
                decelerationRate="fast"
              />
            ) : (
              <Text style={styles.emptyQuotesMessage}>
                לא הצלחנו לטעון ציטוטים כרגע. נסו שוב מאוחר יותר.
              </Text>
            )}
          </View>
        )}
      </View>
      <PrimaryButton
        label="הרקע מוכן"
        onPress={handleSaveBackground}
        loading={saving}
        disabled={saving}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  canvasWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    marginTop: 40,
  },
  canvasShot: {
    borderRadius: spacing.lg,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.divider,
  },
  canvas: {
    flex: 1,
  },
  canvasBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  canvasImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
  },
  draggableText: {
    position: "absolute",
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: spacing.sm,
  },
  draggableTextContent: {
    color: colors.textPrimary,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: spacing.md,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
  },
  tabButtonPressed: {
    opacity: 0.85,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
  tabLabelActive: {
    color: colors.background,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  backgroundPanel: {
    gap: spacing.md,
    alignItems: "center",
    alignSelf: "stretch",
  },
  backgroundList: {
    paddingVertical: spacing.xs,
  },
  backgroundOption: {
    width: 120,
    aspectRatio: 3 / 4,
    marginHorizontal: spacing.xs,
    borderRadius: spacing.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  backgroundOptionPressed: {
    opacity: 0.85,
  },
  backgroundOptionSelected: {
    borderColor: colors.accent,
  },
  backgroundOptionImage: {
    width: "100%",
    height: "100%",
  },
  importButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "transparent",
  },
  importButtonActive: {
    backgroundColor: colors.accentSoft,
  },
  importButtonPressed: {
    opacity: 0.8,
  },
  importButtonText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 15,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  quotesPanel: {
    gap: spacing.md,
    alignItems: "center",
    alignSelf: "stretch",
  },
  addTextButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.accent,
  },
  addTextButtonPressed: {
    opacity: 0.85,
  },
  addTextButtonLabel: {
    color: colors.background,
    fontWeight: "600",
    textAlign: "center",
  },
  singleQuoteList: {
    height: QUOTE_CARD_HEIGHT,
    alignSelf: "stretch",
  },
  quotesList: {
    gap: spacing.sm,
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  quoteCard: {
    padding: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    height: QUOTE_CARD_HEIGHT,
    alignSelf: "stretch",
  },
  quoteCardPressed: {
    opacity: 0.9,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  quoteAuthor: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptyQuotesMessage: {
    color: colors.textSecondary,
    textAlign: "center",
  },
  quotesEditor: {
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    alignSelf: "stretch",
    gap: spacing.md,
  },
  quotesEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quotesEditorBackButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  quotesEditorBackButtonPressed: {
    opacity: 0.85,
  },
  quotesEditorBackLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  quotesEditorHeaderSpacer: {
    width: spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.md,
    padding: spacing.md,
    minHeight: 72,
    textAlign: "center",
    color: colors.textPrimary,
  },
  fontControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  fontButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fontButtonPressed: {
    opacity: 0.85,
  },
  fontButtonLabel: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  fontSizeLabel: {
    color: colors.textPrimary,
    fontWeight: "600",
    textAlign: "center",
  },
  removeTextButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.danger,
  },
  removeTextButtonPressed: {
    opacity: 0.85,
  },
  removeTextButtonLabel: {
    color: colors.background,
    fontWeight: "600",
    textAlign: "center",
  },
});
