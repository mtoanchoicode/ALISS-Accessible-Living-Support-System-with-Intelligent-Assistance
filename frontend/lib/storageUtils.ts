import { RegisteredItem } from "@/types/detection";

/**
 * Saves a registered item to local storage.
 * In a real application, this would interface with a backend API or database.
 */
export const saveRegisteredItem = (itemData: Omit<RegisteredItem, "id" | "createdAt">): RegisteredItem => {
  const newItem: RegisteredItem = {
    ...itemData,
    id: `item-${Date.now()}`,
    createdAt: Date.now(),
  };

  try {
    const existingItems = JSON.parse(localStorage.getItem("registered_items") || "[]");
    localStorage.setItem("registered_items", JSON.stringify([newItem, ...existingItems]));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }

  return newItem;
};
