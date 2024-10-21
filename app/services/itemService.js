import { sql } from "../database/database.js";

const addItemToDB = async (shoppingListId, name) => {
  if (!shoppingListId) {
    throw new Error("shoppingListId is required.");
  }
  if (!name) {
    throw new Error("name is required.");
  }

  await sql`
    INSERT INTO shopping_list_items (shopping_list_id, name)
    VALUES (${shoppingListId}, ${name})`;
};

const getAllItems = async () => {
  return await sql`SELECT * FROM shopping_list_items`;
};

const findItemsByListId = async (shoppingListId) => {
  return await sql`SELECT * FROM shopping_list_items WHERE shopping_list_id = ${shoppingListId} ORDER BY collected ASC, name ASC`;
};

const collectItem = async (id) => {
  await sql`
    UPDATE shopping_list_items SET collected = TRUE WHERE id = ${id}`;
};

export { addItemToDB, getAllItems, findItemsByListId, collectItem };