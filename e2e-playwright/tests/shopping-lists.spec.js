const { test, expect } = require("@playwright/test");

test("Lists page has expected headings.", async ({ page }) => {
  await page.goto("/lists");
  await expect(page.locator("h2")).toHaveText(["Add a list", "Active Lists", "Inactive Lists"]);
});

test('You can add shopping lists', async ({ page }) => {
  await page.goto('/lists'); 
  const newListName = 'Fruits';
  await page.fill('input[name="name"]', newListName);
  const listForm = 'form#add-list-form input[type="submit"]';
  await page.waitForSelector(listForm, { timeout: 20000 });
  await page.click(listForm); 
  await page.waitForURL('/lists'); 
  const listItems = await page.locator('ul > li');
  const itemsCount = await listItems.count();
  expect(itemsCount).toBeGreaterThan(0);
  const listContainsNewList = await listItems.locator(`a:text("${newListName}")`).count();
  expect(listContainsNewList).toBeGreaterThan(0);
});

test('You can view a shopping list', async ({ page }) => {
  await page.goto('/lists');
  const newListName = "Vegetables";
  await page.fill('input[name="name"]', newListName);
  await page.waitForSelector('form#add-list-form input[type="submit"]', { timeout: 20000 });
  await page.click('form#add-list-form input[type="submit"]'); 
  await page.waitForURL('/lists');
  const listLink = await page.locator(`a:text("${newListName}")`);
  await listLink.click();
  const listHeader = await page.locator('h1');
  const headerText = await listHeader.textContent();
  expect(headerText).toContain(newListName);
});

test('You can add and list items for a single shopping list', async ({ page }) => {
  await page.goto('/lists');
  const newListName = "Hygiene";
  await page.fill('input[name="name"]', newListName);
  await page.click('form#add-list-form input[type="submit"]');
  await page.waitForURL('/lists');
  const listLink = await page.locator(`a:text("${newListName}")`);
  await listLink.click();
  const newItemName = `Washing liquid`;
  await page.fill('input#itemName', newItemName); 
  await page.click('form#add-list-item input[type="submit"]');
  const itemLocator = await page.locator(`ul > li:has-text("${newItemName}")`);
  const itemCount = await itemLocator.count();
  expect(itemCount).toBeGreaterThan(0);
});

test('You can mark an item as collected', async ({ page }) => {
  const listId = 3;
  await page.goto(`/lists/${listId}`);
  const items = await page.locator('ul > li');
  const itemCount = await items.count();
  expect(itemCount).toBeGreaterThan(0);
  const firstItem = items.first();
  const itemName = await firstItem.innerText();
  const markCollectedButton = firstItem.locator('form#collected input[type="submit"]');
  await markCollectedButton.click();
  await page.waitForURL(/\/lists\/\d+/);
  const updatedItem = await page.locator(`ul li:has-text("${itemName}")`);
  await expect(updatedItem).toBeVisible();
  expect(await updatedItem.count()).toBeGreaterThan(0); 
});

