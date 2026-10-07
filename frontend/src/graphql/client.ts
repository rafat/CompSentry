import { COMPSENTRY } from "@/config/compsentry";

/**
 * Execute a GraphQL query against the Envio indexer endpoint
 */
export async function fetchGraphQL<T = any>(query: string, variables?: Record<string, any>): Promise<T | null> {
  try {
    const res = await fetch(COMPSENTRY.indexer.graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`GraphQL HTTP Error: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      console.warn("GraphQL Query Errors:", json.errors);
      return null;
    }

    return json.data as T;
  } catch (err) {
    console.warn("Failed to fetch from Envio GraphQL:", err);
    return null;
  }
}
