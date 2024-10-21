import { renderFile } from "https://deno.land/x/eta@v2.2.0/mod.ts";
import * as listService from "../services/listService.js";
import * as itemService from "../services/itemService.js";
import * as requestUtils from "../utils/requestUtils.js";

const responseDetails = {
  headers: { "Content-Type": "text/html;charset=UTF-8" },
};

const viewMainPage = async (request) => {
  const data = {
    lists: await listService.getAllLists(),
    items: await itemService.getAllItems(),
  }

  return new Response(await renderFile("mainPage.eta", data), responseDetails);
}

const addList = async (request) => {
  // if (process.env.DISABLE_LIST_CREATION) {
  //   return requestUtils.error('List creation is disabled in test mode');
  // }

  const formData = await request.formData();
  const name = formData.get("name");

  await listService.create(name);

  return requestUtils.redirectTo("/lists");
};

const viewLists = async (request) => {
  const data = {
    lists: await listService.getAllLists(),
  };

  return new Response(await renderFile("lists.eta", data), responseDetails);
};

const viewList = async (request) => {
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");
  const shoppingListId = urlParts[2];

  const list = await listService.findListById(shoppingListId);
  const items = await itemService.findItemsByListId(shoppingListId);

  if (!list) {
    return new Response("Shopping list not found", { status: 404 });
  }

  const data = {
    list,
    items,
    shoppingListId
  };

  if (!data.list) {
    return new Response("Shopping list not found", { status: 404 });
  }

  return new Response(await renderFile("list.eta", data), responseDetails);
};


const deactivateList = async (request) => {
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");

  await listService.deactivateList({ id: urlParts[2] });

  return requestUtils.redirectTo("/lists");
};

const deleteList = async (request) => {
  const url = new URL(request.url);
  const urlParts = url.pathname.split("/");

  await listService.deleteList({ id: urlParts[2] });

  return requestUtils.redirectTo("/lists");
};

export { deleteList, viewMainPage, addList, viewLists, viewList, deactivateList };