import type { SupabaseClient } from "@supabase/supabase-js";

type ProductRequestInput = {
  userId: string;
  productName: string;
  category?: string | null;
  notes?: string | null;
  quantity?: number | null;
  desiredPrice?: number | null;
  priorityFlag?: boolean;
};

export async function createProductRequestRecord(
  supabase: SupabaseClient,
  input: ProductRequestInput,
) {
  const { error } = await supabase.from("product_reservation_requests").insert({
    user_id: input.userId,
    product_name: input.productName,
    category: input.category ?? null,
    notes: input.notes ?? null,
    quantity: input.quantity ?? null,
    desired_price: input.desiredPrice ?? null,
    priority_flag: input.priorityFlag ?? false,
  });

  if (error) {
    throw new Error(error.message);
  }
}
