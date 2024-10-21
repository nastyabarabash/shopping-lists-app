import * as itemService from "../services/itemService.js";
import * as requestUtils from "../utils/requestUtils.js";

const addItem = async (request) => {
  const formData = await request.formData();
  const shoppingListId = formData.get("shopping_list_id")?.trim(); 
  const name = formData.get("name")?.trim();

  await itemService.addItemToDB(shoppingListId, name);

  return requestUtils.redirectTo(`/lists/${ shoppingListId }`);
};

const collectedItem = async (request) => {
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");
  const shoppingListId = urlParts[2];
  const itemId = urlParts[4];

  if (!shoppingListId || !itemId) {
    return new Response("Invalid request", { status: 400 });
  }

  await itemService.collectItem(itemId);
  
  return requestUtils.redirectTo(`/lists/${ shoppingListId }`);
}

export { addItem, collectedItem };