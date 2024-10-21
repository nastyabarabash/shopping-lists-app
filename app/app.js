import { serve } from "./deps.js";
import { configure } from "./deps.js";
import * as requestUtils from "./utils/requestUtils.js";
import * as listController from "./controllers/listController.js";
import * as itemController from "./controllers/itemController.js";

configure({
  views: `${Deno.cwd()}/views/`,
});

const handleRequest = async (request) => {
  try {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "POST") {
      return requestUtils.redirectTo("/lists");
    } else if (url.pathname === "/" && request.method === "GET") {
      return await listController.viewMainPage(request);
    } else if (url.pathname === "/lists" && request.method === "POST") {
      return await listController.addList(request);
    } else if (url.pathname === "/lists" && request.method === "GET") {
      return await listController.viewLists(request);
    } else if (url.pathname.match("lists/[0-9]+") && request.method === "GET") {
      return await listController.viewList(request);
    } else if (url.pathname.match("lists/[0-9]+/deactivate") && request.method === "POST") {
      return await listController.deactivateList(request);
    } else if (url.pathname.match("lists/[0-9]+/delete") && request.method === "POST") {
      return await listController.deleteList(request);
    } else if (url.pathname.match("lists/[0-9]+/items/[0-9]+/collect") && request.method === "POST") {
      return await itemController.collectedItem (request);
    } else if (url.pathname.match("lists/[0-9]+/items") && request.method === "POST") {
      return await itemController.addItem(request);
    } else {
      return new Response("Not found", { status: 404 });
    }

  } catch (error) {
    console.error('Error handling request:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

serve(handleRequest, { port: 7777 });
