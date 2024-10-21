import { sql } from "../database/database.js";

const create = async (name) => {
  await sql`INSERT INTO shopping_lists (name) VALUES (${ name }) RETURNING *`;
};

const findListById = async (id) => {
  const result = await sql`
    SELECT *
    FROM shopping_lists
    WHERE id = ${id}
  `;
  return result.length > 0 ? result[0] : null;
};

const getAllLists = async () => {
  return await sql`SELECT * FROM shopping_lists`;
};

const deactivateList = async ({ id }) => {
  await sql`UPDATE shopping_list_items SET collected = false WHERE id = ${ id }`;
  
  await sql`UPDATE shopping_lists SET active = false WHERE id = ${ id }`;
};

const deleteList = async ({ id }) => {
  await sql`DELETE FROM shopping_list_items WHERE shopping_list_id = ${id}`;
  
  await sql`DELETE FROM shopping_lists WHERE id = ${id}`;
};

export { deleteList, create, findListById, getAllLists, deactivateList };