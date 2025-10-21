import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Platform,
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

type Position = {
  x: number;
  y: number;
};

type EditableText = {
  id: string;
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  position: Position;
};

type DraggableTextProps = {
  item: EditableText;
  selected: boolean;
  onSelect(id: string): void;
  onMove(id: string, position: Position): void;
  onEdit(id: string): void;
  onResize(id: string, nextSize: number): void;
  canvasWidth: number;
  canvasHeight: number;
};

type TextPanel = "font" | "color" | "size" | null;

const TEXT_ICON_BAR_WIDTH = 40;
const BACKGROUND_ICON_BAR_WIDTH = 40;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 110;
const TEXT_BOUNDARY_MARGIN = 48;

const FONT_OPTIONS: Array<{ label: string; value: string }> = [
  {
    label: "אלגנטי",
    value: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }) as string,
  },
  {
    label: "מודרני",
    value:
      Platform.select({
        ios: "Avenir Next",
        android: "sans-serif-medium",
        default: "System",
      }) ?? "System",
  },
  {
    label: "כתב יד",
    value: Platform.select({
      ios: "Snell Roundhand",
      android: "casual",
      default: "cursive",
    }) as string,
  },
  {
    label: "קלאסי",
    value: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }) as string,
  },
];

const COLOR_SWATCHES = [
  "#3A2016",
  "#8C4A35",
  "#B98568",
  "#FFFFFF",
  "#2D4B73",
  "#3FA796",
  "#C94C4C",
];

const TEXT_ICON_BUTTONS: Array<{
  key: "add" | "quotes" | "font" | "color" | "size" | "delete";
  label: string;
  icon: string;
}> = [
  { key: "add", label: "הוספת טקסט", icon: "＋" },
  { key: "quotes", label: "ציטוטים", icon: "📜" },
  { key: "font", label: "גופנים", icon: "A" },
  { key: "color", label: "צבע", icon: "🎨" },
  { key: "size", label: "גודל", icon: "↕" },
  { key: "delete", label: "מחיקה", icon: "🗑️" },
];

const BACKGROUND_ICON_BUTTONS: Array<{
  key: "gallery" | "import";
  label: string;
  icon: string;
}> = [
  { key: "gallery", label: "רקעים של אמונה", icon: "🖼️" },
  { key: "import", label: "ייבוא מהטלפון", icon: "📱" },
];

const DraggableText: React.FC<DraggableTextProps> = ({
  item,
  selected,
  onSelect,
  onMove,
  onEdit,
  onResize,
  canvasWidth,
  canvasHeight,
}) => {
  const startPositionRef = React.useRef(item.position);
  const lastTapRef = React.useRef<number>(0);
  const initialFontRef = React.useRef(item.fontSize);

  useEffect(() => {
    startPositionRef.current = item.position;
  }, [item.position]);

  useEffect(() => {
    initialFontRef.current = item.fontSize;
  }, [item.fontSize]);

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasWidth - TEXT_BOUNDARY_MARGIN);
      const maxY = Math.max(0, canvasHeight - TEXT_BOUNDARY_MARGIN);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasHeight, canvasWidth]
  );

  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          onSelect(item.id);
          startPositionRef.current = item.position;
        },
        onPanResponderMove: (_, gestureState) => {
          const nextPosition = clampPosition({
            x: startPositionRef.current.x + gestureState.dx,
            y: startPositionRef.current.y + gestureState.dy,
          });
          onMove(item.id, nextPosition);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextPosition = clampPosition({
            x: startPositionRef.current.x + gestureState.dx,
            y: startPositionRef.current.y + gestureState.dy,
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
    [clampPosition, item.id, item.position, onEdit, onMove, onSelect]
  );

  const resizeResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          initialFontRef.current = item.fontSize;
          onSelect(item.id);
        },
        onPanResponderMove: (_, gestureState) => {
          const delta = Math.max(gestureState.dx, gestureState.dy);
          const next = Math.max(
            MIN_FONT_SIZE,
            Math.min(MAX_FONT_SIZE, initialFontRef.current + delta * 0.35)
          );
          onResize(item.id, next);
        },
        onPanResponderRelease: (_, gestureState) => {
          const delta = Math.max(gestureState.dx, gestureState.dy);
          const next = Math.max(
            MIN_FONT_SIZE,
            Math.min(MAX_FONT_SIZE, initialFontRef.current + delta * 0.35)
          );
          onResize(item.id, next);
        },
      }),
    [item.fontSize, item.id, onResize, onSelect]
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
      {...moveResponder.panHandlers}
    >
      <Text
        style={[
          styles.draggableTextContent,
          {
            fontFamily: item.fontFamily,
            fontSize: item.fontSize,
            color: item.color,
          },
        ]}
      >
        {item.content}
      </Text>
      {selected ? (
        <View style={styles.resizeHandleContainer}>
          <View style={styles.resizeHandle} {...resizeResponder.panHandlers} />
        </View>
      ) : null}
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

const QuoteCard: React.FC<{ quote: Quote; onSelect(): void }> = ({
  quote,
  onSelect,
}) => (
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

export const CreateBackgroundScreen: React.FC<CreateBackgroundScreenProps> = ({
  navigation,
}) => {
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
  const [selectedGalleryBackgroundId, setSelectedGalleryBackgroundId] =
    useState<string | null>(null);
  const [importedUri, setImportedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showQuoteLibrary, setShowQuoteLibrary] = useState(false);
  const [showBackgroundGallery, setShowBackgroundGallery] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [activeTextPanel, setActiveTextPanel] = useState<TextPanel>(null);

  const viewShotRef = React.useRef<ViewShot>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const canvasDimensions = useMemo(() => {
    const phoneAspectRatio = 19.5 / 9;
    const availableWidth =
      windowWidth -
      TEXT_ICON_BAR_WIDTH -
      BACKGROUND_ICON_BAR_WIDTH -
      spacing.xl * 2;
    const maxWidth = Math.max(260, availableWidth);
    let width = maxWidth;
    let height = width * phoneAspectRatio;
    const maxHeight = windowHeight * 0.7;
    if (height > maxHeight) {
      height = maxHeight;
      width = height / phoneAspectRatio;
    }
    return { width, height };
  }, [windowHeight, windowWidth]);

  const selectedText = useMemo(
    () =>
      selectedTextId
        ? texts.find((item) => item.id === selectedTextId) ?? null
        : null,
    [selectedTextId, texts]
  );

  useEffect(() => {
    if (!selectedText) {
      setActiveTextPanel(null);
    }
  }, [selectedText]);

  const updateText = useCallback(
    (id: string, updater: (current: EditableText) => EditableText) => {
      setTexts((items) =>
        items.map((item) => (item.id === id ? updater(item) : item))
      );
    },
    []
  );

  const clampPosition = useCallback(
    (position: Position): Position => {
      const maxX = Math.max(0, canvasDimensions.width - TEXT_BOUNDARY_MARGIN);
      const maxY = Math.max(0, canvasDimensions.height - TEXT_BOUNDARY_MARGIN);
      return {
        x: Math.max(0, Math.min(position.x, maxX)),
        y: Math.max(0, Math.min(position.y, maxY)),
      };
    },
    [canvasDimensions.height, canvasDimensions.width]
  );

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
    void loadQuotes();
  }, [loadBackgrounds, loadQuotes]);

  const handleSelectBackground = useCallback((background: Background) => {
    setCanvasBackgroundUri(background.imageUrl);
    setSelectedBackgroundId(background._id);
    setSelectedGalleryBackgroundId(background._id);
    setImportedUri(null);
    setShowBackgroundGallery(false);
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
      setShowBackgroundGallery(false);
    } catch (error) {
      console.warn("Error importing background", error);
    }
  }, []);

  const handleAddQuote = useCallback(
    (quote: Quote) => {
      const id = `quote-${quote._id}-${Date.now()}`;
      const basePosition = clampPosition({
        x: canvasDimensions.width * 0.1,
        y: canvasDimensions.height * 0.2,
      });
      setTexts((items) => [
        ...items,
        {
          id,
          content: quote.quote,
          fontSize: 30,
          fontFamily:
            FONT_OPTIONS[0]?.value ??
            (Platform.OS === "ios" ? "Georgia" : "serif"),
          color: colors.textPrimary,
          position: basePosition,
        },
      ]);
      setSelectedTextId(id);
      setShowQuoteLibrary(false);
    },
    [canvasDimensions.height, canvasDimensions.width, clampPosition]
  );

  const handleAddCustomText = useCallback(() => {
    const id = `custom-${Date.now()}`;
    const basePosition = clampPosition({
      x: canvasDimensions.width * 0.2,
      y: canvasDimensions.height * 0.35,
    });
    const content = "טקסט חדש";
    const fontFamily =
      FONT_OPTIONS[1]?.value ??
      (Platform.OS === "ios" ? "Avenir Next" : "sans-serif-medium");
    setTexts((items) => [
      ...items,
      {
        id,
        content,
        fontSize: 34,
        fontFamily,
        color: colors.textPrimary,
        position: basePosition,
      },
    ]);
    setSelectedTextId(id);
    setEditingTextId(id);
    setEditingValue(content);
  }, [canvasDimensions.height, canvasDimensions.width, clampPosition]);

  const handleMoveText = useCallback(
    (id: string, position: Position) => {
      updateText(id, (item) => ({
        ...item,
        position: clampPosition(position),
      }));
    },
    [clampPosition, updateText]
  );

  const handleChangeTextContent = useCallback(
    (id: string, content: string) => {
      updateText(id, (item) => ({
        ...item,
        content,
      }));
    },
    [updateText]
  );

  const handleChangeFont = useCallback(
    (id: string, fontFamily: string) => {
      updateText(id, (item) => ({
        ...item,
        fontFamily,
      }));
    },
    [updateText]
  );

  const handleChangeColor = useCallback(
    (id: string, colorValue: string) => {
      updateText(id, (item) => ({
        ...item,
        color: colorValue,
      }));
    },
    [updateText]
  );

  const handleAdjustFontSize = useCallback(
    (id: string, delta: number) => {
      updateText(id, (item) => ({
        ...item,
        fontSize: Math.max(
          MIN_FONT_SIZE,
          Math.min(MAX_FONT_SIZE, item.fontSize + delta)
        ),
      }));
    },
    [updateText]
  );

  const handleResizeText = useCallback(
    (id: string, nextSize: number) => {
      updateText(id, (item) => ({
        ...item,
        fontSize: Math.max(
          MIN_FONT_SIZE,
          Math.min(MAX_FONT_SIZE, Math.round(nextSize))
        ),
      }));
    },
    [updateText]
  );

  const handleRemoveText = useCallback((id: string) => {
    setTexts((items) => items.filter((item) => item.id !== id));
    setSelectedTextId((current) => (current === id ? null : current));
  }, []);

  const handleStartEditing = useCallback(
    (id: string) => {
      const text = texts.find((item) => item.id === id);
      if (!text) {
        return;
      }
      setSelectedTextId(id);
      setEditingTextId(id);
      setEditingValue(text.content);
    },
    [texts]
  );

  const handleConfirmEdit = useCallback(() => {
    if (!editingTextId) {
      return;
    }
    handleChangeTextContent(editingTextId, editingValue.trim());
    setEditingTextId(null);
  }, [editingTextId, editingValue, handleChangeTextContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingTextId(null);
  }, []);

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
        // Directory may already exist; ignore.
      }
      const identifier = `custom-${Date.now()}`;
      const targetPath = `${targetDir}/${identifier}.jpg`;
      await FileSystem.copyAsync({ from: captureUri, to: targetPath });
      try {
        await FileSystem.deleteAsync(captureUri, { idempotent: true });
      } catch (cleanupError) {
        console.warn("Failed to delete captured temp file", cleanupError);
      }

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

  const handleBackToLibrary = useCallback(() => {
    Alert.alert(
      "לעזוב ללא שמירה",
      "הרקע האישי לא יישמר. האם לחזור לספריית הרקעים?",
      [
        { text: "ביטול", style: "cancel" },
        {
          text: "חזרה",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }, [navigation]);

  const handleConfirmGallerySelection = useCallback(() => {
    if (!selectedGalleryBackgroundId) {
      setShowBackgroundGallery(false);
      return;
    }
    const background = cleanBackgrounds.find(
      (item) => item._id === selectedGalleryBackgroundId
    );
    if (background) {
      handleSelectBackground(background);
    }
    setShowBackgroundGallery(false);
  }, [cleanBackgrounds, handleSelectBackground, selectedGalleryBackgroundId]);

  const disableTextTools = !selectedText;

  const renderTextPanel = () => {
    if (!selectedText || !activeTextPanel) {
      return null;
    }
    if (activeTextPanel === "font") {
      return (
        <View style={styles.floatingPanel}>
          <Text style={styles.panelTitle}>בחירת גופן</Text>
          {FONT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={({ pressed }) => [
                styles.panelOption,
                selectedText.fontFamily === option.value
                  ? styles.panelOptionSelected
                  : null,
                pressed ? styles.panelOptionPressed : null,
              ]}
              onPress={() => handleChangeFont(selectedText.id, option.value)}
            >
              <Text
                style={[styles.panelOptionLabel, { fontFamily: option.value }]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    if (activeTextPanel === "color") {
      return (
        <View style={styles.floatingPanel}>
          <Text style={styles.panelTitle}>צבע הטקסט</Text>
          <View style={styles.colorRow}>
            {COLOR_SWATCHES.map((colorValue) => (
              <Pressable
                key={colorValue}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: colorValue },
                  selectedText.color === colorValue
                    ? styles.colorSwatchSelected
                    : null,
                ]}
                onPress={() => handleChangeColor(selectedText.id, colorValue)}
              />
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    if (activeTextPanel === "size") {
      return (
        <View style={styles.floatingPanel}>
          <Text style={styles.panelTitle}>גודל הטקסט</Text>
          <View style={styles.fontControls}>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                pressed ? styles.fontButtonPressed : null,
              ]}
              onPress={() => handleAdjustFontSize(selectedText.id, -2)}
            >
              <Text style={styles.fontButtonLabel}>A-</Text>
            </Pressable>
            <Text style={styles.fontSizeLabel}>
              {Math.round(selectedText.fontSize)}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.fontButton,
                pressed ? styles.fontButtonPressed : null,
              ]}
              onPress={() => handleAdjustFontSize(selectedText.id, 2)}
            >
              <Text style={styles.fontButtonLabel}>A+</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            ניתן גם לגרור את הידית בטקסט כדי לשנות גודל.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.panelCloseButton,
              pressed ? styles.panelCloseButtonPressed : null,
            ]}
            onPress={() => setActiveTextPanel(null)}
          >
            <Text style={styles.panelCloseLabel}>סגירה</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  return (
    <ScreenContainer withScroll={false}>
      <View style={styles.editorRow}>
        <View style={[styles.iconBar, styles.iconBarLeft]}>
          {TEXT_ICON_BUTTONS.map((button) => {
            const disabled =
              disableTextTools &&
              ["font", "color", "size", "delete"].includes(button.key);
            const handlePress = () => {
              if (button.key === "add") {
                handleAddCustomText();
              } else if (button.key === "quotes") {
                setShowQuoteLibrary(true);
              } else if (!selectedText) {
                return;
              } else if (button.key === "font") {
                setActiveTextPanel("font");
              } else if (button.key === "color") {
                setActiveTextPanel("color");
              } else if (button.key === "size") {
                setActiveTextPanel("size");
              } else if (button.key === "delete" && selectedText) {
                handleRemoveText(selectedText.id);
              }
            };
            return (
              <Pressable
                key={button.key}
                accessibilityLabel={button.label}
                style={({ pressed }) => [
                  styles.iconButton,
                  disabled ? styles.iconButtonDisabled : null,
                  pressed && !disabled ? styles.iconButtonPressed : null,
                ]}
                disabled={disabled}
                onPress={handlePress}
              >
                <Text style={styles.iconLabel}>{button.icon}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.canvasSection}>
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
                  onSelect={(id) => {
                    setSelectedTextId(id);
                    setActiveTextPanel(null);
                  }}
                  onMove={handleMoveText}
                  onEdit={handleStartEditing}
                  onResize={handleResizeText}
                  canvasWidth={canvasDimensions.width}
                  canvasHeight={canvasDimensions.height}
                />
              ))}
            </View>
          </ViewShot>
          {renderTextPanel()}
        </View>

        <View style={[styles.iconBar, styles.iconBarRight]}>
          {BACKGROUND_ICON_BUTTONS.map((button) => {
            const handlePress =
              button.key === "gallery"
                ? () => setShowBackgroundGallery(true)
                : handleImportBackground;
            return (
              <Pressable
                key={button.key}
                accessibilityLabel={button.label}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed ? styles.iconButtonPressed : null,
                ]}
                onPress={handlePress}
              >
                <Text style={styles.iconLabel}>{button.icon}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={handleBackToLibrary}
          style={({ pressed }) => [
            styles.footerSecondaryButton,
            pressed ? styles.footerSecondaryButtonPressed : null,
          ]}
        >
          <Text style={styles.footerSecondaryLabel}>חזרה לספריית הרקעים</Text>
        </Pressable>
        <PrimaryButton
          label="הרקע מוכן"
          onPress={handleSaveBackground}
          loading={saving}
          disabled={saving}
        />
      </View>

      <Modal
        visible={showQuoteLibrary}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuoteLibrary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>בחרו ציטוט</Text>
            {quotesLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={quotes}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <QuoteCard
                    quote={item}
                    onSelect={() => handleAddQuote(item)}
                  />
                )}
              />
            )}
            <Pressable
              style={({ pressed }) => [
                styles.panelCloseButton,
                pressed ? styles.panelCloseButtonPressed : null,
              ]}
              onPress={() => setShowQuoteLibrary(false)}
            >
              <Text style={styles.panelCloseLabel}>סגירה</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBackgroundGallery}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBackgroundGallery(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>בחרו רקע נקי</Text>
            {backgroundsLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={cleanBackgrounds}
                keyExtractor={(item) => item._id}
                numColumns={2}
                columnWrapperStyle={styles.backgroundRow}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <BackgroundOption
                    background={item}
                    selected={selectedGalleryBackgroundId === item._id}
                    onSelect={() => setSelectedGalleryBackgroundId(item._id)}
                  />
                )}
              />
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSecondaryButton,
                  pressed ? styles.modalSecondaryButtonPressed : null,
                ]}
                onPress={() => setShowBackgroundGallery(false)}
              >
                <Text style={styles.modalSecondaryLabel}>ביטול</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalPrimaryButton,
                  !selectedGalleryBackgroundId
                    ? styles.modalPrimaryButtonDisabled
                    : null,
                  pressed && selectedGalleryBackgroundId
                    ? styles.modalPrimaryButtonPressed
                    : null,
                ]}
                disabled={!selectedGalleryBackgroundId}
                onPress={handleConfirmGallerySelection}
              >
                <Text
                  style={[
                    styles.modalPrimaryLabel,
                    !selectedGalleryBackgroundId
                      ? styles.modalPrimaryLabelDisabled
                      : null,
                  ]}
                >
                  שמירה כרקע
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={editingTextId !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.modalTitle}>עריכת טקסט</Text>
            <TextInput
              value={editingValue}
              onChangeText={setEditingValue}
              multiline
              autoFocus
              textAlignVertical="top"
              placeholder="הקלידו את הטקסט שלכם..."
              placeholderTextColor={colors.textSecondary}
              style={styles.editModalInput}
            />
            <View style={styles.editModalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.editModalButton,
                  pressed ? styles.modalSecondaryButtonPressed : null,
                ]}
                onPress={handleCancelEdit}
              >
                <Text style={styles.modalSecondaryLabel}>ביטול</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.editModalButtonPrimary,
                  pressed ? styles.editModalButtonPrimaryPressed : null,
                ]}
                onPress={handleConfirmEdit}
              >
                <Text style={styles.editModalButtonLabel}>שמירה</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  editorRow: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
  },
  iconBar: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  iconBarLeft: {
    width: TEXT_ICON_BAR_WIDTH,
  },
  iconBarRight: {
    width: BACKGROUND_ICON_BAR_WIDTH,
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 2,
  },
  iconButtonPressed: {
    opacity: 0.85,
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  iconLabel: {
    fontSize: 22,
  },
  canvasSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: spacing.sm,
  },
  canvasShot: {
    borderRadius: spacing.xl,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
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
  footer: {
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    gap: spacing.sm,
    marginBottom: 50,
  },
  footerSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  footerSecondaryButtonPressed: {
    opacity: 0.85,
  },
  footerSecondaryLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  floatingPanel: {
    position: "absolute",
    top: spacing.lg,
    left: spacing.lg,
    width: 220,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  panelOption: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  panelOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  panelOptionPressed: {
    opacity: 0.85,
  },
  panelOptionLabel: {
    color: colors.textPrimary,
    textAlign: "center",
  },
  panelCloseButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  panelCloseButtonPressed: {
    opacity: 0.85,
  },
  panelCloseLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchSelected: {
    borderColor: colors.accent,
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
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.card,
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
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
  },
  draggableText: {
    position: "absolute",
    padding: spacing.xs,
    borderWidth: 1.5,
    borderRadius: spacing.sm,
  },
  draggableTextContent: {
    textAlign: "center",
  },
  resizeHandleContainer: {
    position: "absolute",
    right: -spacing.xs,
    bottom: -spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(58, 32, 22, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  resizeHandle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  backgroundOption: {
    width: 110,
    height: 150,
    borderRadius: spacing.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
    margin: spacing.xs,
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
  backgroundRow: {
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  quoteCard: {
    padding: spacing.sm,
    borderRadius: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: spacing.sm,
  },
  quoteCardPressed: {
    opacity: 0.9,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  quoteAuthor: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "80%",
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  saveAsBackgroundButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    width: 50,
    height: 50,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  modalSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  modalSecondaryButtonPressed: {
    opacity: 0.85,
  },
  modalSecondaryLabel: {
    color: colors.accent,
    fontWeight: "600",
  },
  modalPrimaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.accent,
  },
  modalPrimaryButtonPressed: {
    opacity: 0.9,
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: colors.accentSoft,
  },
  modalPrimaryLabel: {
    color: colors.background,
    fontWeight: "600",
  },
  modalPrimaryLabelDisabled: {
    color: colors.textSecondary,
  },
  editModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  editModalInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: spacing.lg,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  editModalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  editModalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  editModalButtonPrimary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    backgroundColor: colors.accent,
  },
  editModalButtonPrimaryPressed: {
    opacity: 0.9,
  },
  editModalButtonLabel: {
    color: colors.background,
    fontWeight: "600",
  },
});
