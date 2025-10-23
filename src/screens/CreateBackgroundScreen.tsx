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
  Keyboard,
  useWindowDimensions,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ViewShot from "react-native-view-shot";
import * as FileSystem from "expo-file-system";
import { ScreenContainer } from "../components/ScreenContainer";
import { PrimaryButton } from "../components/PrimaryButton";
import {
  BackgroundSelectionParam,
  RootStackParamList,
} from "../navigation/RootNavigator";
import { Background, Quote } from "../api/types";
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
  showEditingChrome: boolean;
  editing: boolean;
  onChangeContent(id: string, content: string): void;
  onFinishEditing(id: string): void;
};

type TextPanel = "font" | "color" | "size" | null;

const TEXT_ICON_BAR_WIDTH = 40;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 110;
const TEXT_BOUNDARY_MARGIN = 48;
const RESIZE_HANDLE_SIZE = 18;
const RESIZE_HANDLE_OFFSET = RESIZE_HANDLE_SIZE / 2;
const RESIZE_SCALE_FACTOR = 0.35;

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

const DraggableText: React.FC<DraggableTextProps> = ({
  item,
  selected,
  onSelect,
  onMove,
  onEdit,
  onResize,
  canvasWidth,
  canvasHeight,
  showEditingChrome,
  editing,
  onChangeContent,
  onFinishEditing,
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

  const applySizeDelta = useCallback(
    (delta: number) => {
      const next = Math.max(
        MIN_FONT_SIZE,
        Math.min(
          MAX_FONT_SIZE,
          initialFontRef.current + delta * RESIZE_SCALE_FACTOR
        )
      );
      onResize(item.id, next);
    },
    [item.id, onResize]
  );

  const createEdgeResponder = useCallback(
    (direction: "left" | "right" | "top" | "bottom") =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          initialFontRef.current = item.fontSize;
          onSelect(item.id);
        },
        onPanResponderMove: (_, gestureState) => {
          const delta =
            direction === "left"
              ? -gestureState.dx
              : direction === "right"
              ? gestureState.dx
              : direction === "top"
              ? -gestureState.dy
              : gestureState.dy;
          applySizeDelta(delta);
        },
        onPanResponderRelease: (_, gestureState) => {
          const delta =
            direction === "left"
              ? -gestureState.dx
              : direction === "right"
              ? gestureState.dx
              : direction === "top"
              ? -gestureState.dy
              : gestureState.dy;
          applySizeDelta(delta);
        },
      }),
    [applySizeDelta, item.fontSize, item.id, onSelect]
  );

  const leftResizeResponder = useMemo(
    () => createEdgeResponder("left"),
    [createEdgeResponder]
  );
  const rightResizeResponder = useMemo(
    () => createEdgeResponder("right"),
    [createEdgeResponder]
  );
  const topResizeResponder = useMemo(
    () => createEdgeResponder("top"),
    [createEdgeResponder]
  );
  const bottomResizeResponder = useMemo(
    () => createEdgeResponder("bottom"),
    [createEdgeResponder]
  );

  const showHighlight = showEditingChrome && selected;
  const showHandles = showHighlight && !editing;

  return (
    <View
      style={[
        styles.draggableText,
        {
          left: item.position.x,
          top: item.position.y,
          borderColor: showHighlight ? colors.accent : "transparent",
          backgroundColor: showHighlight
            ? "rgba(255, 255, 255, 0.35)"
            : "transparent",
        },
      ]}
      {...(showEditingChrome && !editing ? moveResponder.panHandlers : {})}
    >
      {editing ? (
        <TextInput
          value={item.content}
          onChangeText={(value) => onChangeContent(item.id, value)}
          autoFocus
          multiline
          blurOnSubmit
          style={[
            styles.draggableTextContent,
            styles.draggableTextInput,
            {
              fontFamily: item.fontFamily,
              fontSize: item.fontSize,
              color: item.color,
            },
          ]}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          onBlur={() => onFinishEditing(item.id)}
          onSubmitEditing={() => onFinishEditing(item.id)}
          underlineColorAndroid="transparent"
        />
      ) : (
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
      )}
      {showHandles ? (
        <>
          <View
            style={[styles.resizeHandle, styles.resizeHandleTop]}
            {...topResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleBottom]}
            {...bottomResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleLeft]}
            {...leftResizeResponder.panHandlers}
          />
          <View
            style={[styles.resizeHandle, styles.resizeHandleRight]}
            {...rightResizeResponder.panHandlers}
          />
        </>
      ) : null}
    </View>
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
  route,
}) => {
  const { initialBackground } = route.params;

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [texts, setTexts] = useState<EditableText[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [canvasBackgroundUri, setCanvasBackgroundUri] = useState<string | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [showQuoteLibrary, setShowQuoteLibrary] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeTextPanel, setActiveTextPanel] = useState<TextPanel>(null);
  const [showEditingChrome, setShowEditingChrome] = useState(true);
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);

  const viewShotRef = React.useRef<ViewShot>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const canvasDimensions = useMemo(() => {
    const phoneAspectRatio = 19.5 / 9;
    const availableWidth = windowWidth - TEXT_ICON_BAR_WIDTH - spacing.xl * 2;
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

  useEffect(() => {
    if (initialBackground.type === "clean") {
      setCanvasBackgroundUri(initialBackground.background.imageUrl);
    } else {
      setCanvasBackgroundUri(initialBackground.uri);
    }
  }, [initialBackground]);

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
    void loadQuotes();
  }, [loadQuotes]);

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
      setEditingTextId(id);
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

  const handleStartEditing = useCallback((id: string) => {
    setSelectedTextId(id);
    setActiveTextPanel(null);
    setEditingTextId(id);
  }, []);

  const handleFinishEditing = useCallback(
    (id: string) => {
      setEditingTextId((current) => (current === id ? null : current));
      Keyboard.dismiss();
    },
    []
  );

  const handleCanvasPress = useCallback(() => {
    if (editingTextId !== null) {
      setEditingTextId(null);
      Keyboard.dismiss();
    }
    setSelectedTextId(null);
    setActiveTextPanel(null);
  }, [editingTextId]);

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
      setActiveTextPanel(null);
      setSelectedTextId(null);
      setEditingTextId(null);
      setShowEditingChrome(false);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
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
      setShowEditingChrome(true);
      setSaving(false);
    }
  }, [navigation, saving]);

  const handleBackToLibrary = useCallback(() => {
    setConfirmExitVisible(true);
  }, []);

  const handleCancelExit = useCallback(() => {
    setConfirmExitVisible(false);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setConfirmExitVisible(false);
    navigation.goBack();
  }, [navigation]);

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
    <ScreenContainer withScroll={false} avoidKeyboard={false}>
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
              <Pressable
                style={styles.canvasTouchOverlay}
                onPress={handleCanvasPress}
              />
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
                  showEditingChrome={showEditingChrome}
                  editing={editingTextId === text.id}
                  onChangeContent={handleChangeTextContent}
                  onFinishEditing={handleFinishEditing}
                />
              ))}
            </View>
          </ViewShot>
          {renderTextPanel()}
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
          <Text style={styles.footerSecondaryLabel}>חזרה לבחירת רקע</Text>
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
        visible={confirmExitVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>לעזוב ללא שמירה</Text>
            <Text style={styles.confirmMessage}>
              {"הרקע האישי לא יישמר. האם לחזור לבחירת הרקע?"}
            </Text>
            <PrimaryButton
              label="חזרה לבחירת הרקע"
              onPress={handleConfirmExit}
            />
            <Pressable
              accessibilityRole="button"
              onPress={handleCancelExit}
              style={({ pressed }) => [
                styles.confirmSecondaryButton,
                pressed ? styles.confirmSecondaryButtonPressed : null,
              ]}
            >
              <Text style={styles.confirmSecondaryLabel}>המשך עריכה</Text>
            </Pressable>
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
  canvasTouchOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  resizeHandle: {
    position: "absolute",
    width: RESIZE_HANDLE_SIZE,
    height: RESIZE_HANDLE_SIZE,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  resizeHandleTop: {
    top: -RESIZE_HANDLE_OFFSET,
    left: "50%",
    marginLeft: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleBottom: {
    bottom: -RESIZE_HANDLE_OFFSET,
    left: "50%",
    marginLeft: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleLeft: {
    left: -RESIZE_HANDLE_OFFSET,
    top: "50%",
    marginTop: -RESIZE_HANDLE_SIZE / 2,
  },
  resizeHandleRight: {
    right: -RESIZE_HANDLE_OFFSET,
    top: "50%",
    marginTop: -RESIZE_HANDLE_SIZE / 2,
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
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: "center",
  },
  confirmMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  confirmSecondaryButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSecondaryButtonPressed: {
    opacity: 0.85,
  },
  confirmSecondaryLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.accent,
    textAlign: "center",
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
  draggableTextInput: {
    padding: 0,
    backgroundColor: "transparent",
  },
});
